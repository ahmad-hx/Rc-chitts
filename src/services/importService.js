import * as XLSX from 'xlsx';
import { doc, setDoc, writeBatch, getDocs, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase.js';

// ─────────────────────────────────────────────────────────────────────────────
// 1. HELPERS & REGEX PARSERS
// ─────────────────────────────────────────────────────────────────────────────

// Phone normalization (Indian mobile: 10 digits -> 919XXXXXXXXX)
export function normalizePhone(value = '') {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  if (digits.length > 10) return `91${digits.slice(-10)}`;
  return digits;
}

// Generate Member Key: normalizedName + '_' + primaryPhone
export function generateMemberKey(cleanName = '', primaryPhone = '') {
  const normName = cleanName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  const normPhone = normalizePhone(primaryPhone);
  return `${normName}_${normPhone}`;
}

// Extract multiple phone numbers from text (comma or space separated)
export function parsePhoneNumbers(rawPhoneStr = '') {
  if (!rawPhoneStr) return { primaryPhone: '', phoneNumbers: [], rawPhone: '' };

  const rawPhone = String(rawPhoneStr).trim();
  if (!rawPhone) return { primaryPhone: '', phoneNumbers: [], rawPhone: '' };

  // Match 10-digit Indian mobile numbers starting with 6-9
  const matches = rawPhone.match(/(?:\+?91[\s-]*)?[6-9]\d{9}/g) || [];

  const normalizedSet = new Set();
  const phoneNumbers = [];

  matches.forEach((p) => {
    const clean = normalizePhone(p);
    if (clean.length === 12 && !normalizedSet.has(clean)) {
      normalizedSet.add(clean);
      phoneNumbers.push(clean);
    }
  });

  // Fallback regex if standard mobile prefix missed a 10-digit sequence
  if (phoneNumbers.length === 0) {
    const fallbackDigits = rawPhone.replace(/\D/g, '');
    if (fallbackDigits.length >= 10) {
      const clean = `91${fallbackDigits.slice(-10)}`;
      phoneNumbers.push(clean);
    }
  }

  const primaryPhone = phoneNumbers[0] || '';

  return {
    primaryPhone,
    phoneNumbers,
    rawPhone,
  };
}

// Extract clean member name and +N holdings calculation
export function parseNameAndHoldings(rawNameStr = '') {
  if (!rawNameStr) return { cleanName: '', additionalHoldings: 0, totalHoldings: 1, sourceName: '' };

  const sourceName = String(rawNameStr).trim();

  // Match +N notation (e.g. +1, + 2, +3)
  const plusMatch = sourceName.match(/\+\s*(\d+)/);

  let additionalHoldings = 0;
  if (plusMatch) {
    additionalHoldings = parseInt(plusMatch[1], 10);
  }

  // Clean name without +N suffix (preserving commas inside name string)
  let cleanName = sourceName
    .replace(/\+\s*\d+/, '')
    .trim()
    .replace(/,\s*$/, '')
    .replace(/\s+/g, ' ');

  const totalHoldings = additionalHoldings + 1;

  return {
    sourceName,
    cleanName,
    additionalHoldings,
    totalHoldings,
  };
}

// Parse Group Headers: lakh-(XI), 2L-A, 5L-C, etc.
export function parseGroupHeader(cellStr = '') {
  if (!cellStr) return null;
  const s = String(cellStr).trim();

  // 1. ₹1 Lakh Roman numeral group: lakh-(XI), lakh-(I), lakh-XI, Lakh (XI), Group XI
  const lakhMatch = s.match(/lakh\s*[-_\(]*\s*([IVXLCDM]+)\s*[\)]*/i);
  if (lakhMatch) {
    const roman = lakhMatch[1].toUpperCase();
    return {
      groupId: roman,
      groupName: `Group ${roman}`,
      chitValue: 100000,
      category: '₹1,00,000',
      rawGroup: s,
    };
  }

  // 2. ₹2 Lakh group: 2L-A, 2L-B, 2L-(A), 2L A, 2L_A
  const lakh2Match = s.match(/2L\s*[-_\(]*\s*([A-Z0-9]+)\s*[\)]*/i);
  if (lakh2Match) {
    const subGrp = lakh2Match[1].toUpperCase();
    return {
      groupId: subGrp,
      groupName: `Group ${subGrp} (2L)`,
      chitValue: 200000,
      category: '₹2,00,000',
      rawGroup: s,
    };
  }

  // 3. ₹5 Lakh group: 5L-A, 5L-B, 5L-(A), 5L A, 5L_A
  const lakh5Match = s.match(/5L\s*[-_\(]*\s*([A-Z0-9]+)\s*[\)]*/i);
  if (lakh5Match) {
    const subGrp = lakh5Match[1].toUpperCase();
    return {
      groupId: subGrp,
      groupName: `Group ${subGrp} (5L)`,
      chitValue: 500000,
      category: '₹5,00,000',
      rawGroup: s,
    };
  }

  // 4. Standalone Roman numeral group e.g. "Group XI"
  const genericGroupMatch = s.match(/^group\s*([IVXLCDM0-9A-Z]+)$/i);
  if (genericGroupMatch) {
    const grp = genericGroupMatch[1].toUpperCase();
    return {
      groupId: grp,
      groupName: `Group ${grp}`,
      chitValue: 100000,
      category: '₹1,00,000',
      rawGroup: s,
    };
  }

  return null;
}

// Parse an individual chit token (e.g. "XIV", "2L-F", "5L-B+2", "5L-A+1", "2L-D+3", "XII + 1")
export function parseChitToken(tokenStr = '') {
  if (!tokenStr) return null;
  const raw = String(tokenStr).trim();
  if (!raw) return null;

  // Extract +N notation e.g. "5L-B+2" or "XII + 1" or "5L-B + 2"
  const plusMatch = raw.match(/\+\s*(\d+)/);
  let additionalQty = 0;
  if (plusMatch) {
    additionalQty = parseInt(plusMatch[1], 10);
  }

  // Clean token without +N suffix
  const cleanToken = raw.replace(/\+\s*\d+/, '').trim();
  if (!cleanToken) return null;

  // 1. ₹5 Lakh group: 5L-A, 5L-B, 5LA, 5L B, 5L_C
  const m5L = cleanToken.match(/^(?:5L|₹?5\s*Lakh)\s*[-_\(]*\s*([A-Z0-9]+)\s*[\)]*$/i);
  if (m5L) {
    const grp = m5L[1].toUpperCase();
    return {
      groupId: grp,
      groupName: `Group ${grp} (5L)`,
      chitValue: 500000,
      quantity: 1 + additionalQty,
      rawToken: raw,
    };
  }

  // 2. ₹2 Lakh group: 2L-A, 2L-B, 2LA, 2L B, 2L_F
  const m2L = cleanToken.match(/^(?:2L|₹?2\s*Lakh)\s*[-_\(]*\s*([A-Z0-9]+)\s*[\)]*$/i);
  if (m2L) {
    const grp = m2L[1].toUpperCase();
    return {
      groupId: grp,
      groupName: `Group ${grp} (2L)`,
      chitValue: 200000,
      quantity: 1 + additionalQty,
      rawToken: raw,
    };
  }

  // 3. ₹1 Lakh Roman Numeral group: I, II, III, IV, V, VI, VII, VIII, IX, X, XI, XII, XIII, XIV, XV, XVI, XVII, XVIII
  const mRoman = cleanToken.match(/^(?:lakh|₹?1\s*Lakh)?\s*[-_\(]*\s*([IVXLCDM]+)\s*[\)]*$/i);
  if (mRoman) {
    const roman = mRoman[1].toUpperCase();
    return {
      groupId: roman,
      groupName: `Group ${roman}`,
      chitValue: 100000,
      quantity: 1 + additionalQty,
      rawToken: raw,
    };
  }

  // 4. Generic Group fallback e.g. "RC-01" or "Group A"
  const mGeneric = cleanToken.match(/^(?:group\s*)?([A-Z0-9-_]+)$/i);
  if (mGeneric) {
    const grp = mGeneric[1].toUpperCase();
    const is2L = grp.startsWith('2L');
    const is5L = grp.startsWith('5L');
    const chitValue = is5L ? 500000 : (is2L ? 200000 : 100000);
    const cleanGrp = grp.replace(/^[25]L[-_]?/, '');

    return {
      groupId: cleanGrp,
      groupName: `Group ${cleanGrp}`,
      chitValue,
      quantity: 1 + additionalQty,
      rawToken: raw,
    };
  }

  return null;
}

export function parseChitsTokenString(chitsStr = '') {
  if (!chitsStr) return [];
  const parts = String(chitsStr).split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
  const parsedHoldings = [];

  parts.forEach((part) => {
    const parsed = parseChitToken(part);
    if (parsed) {
      parsedHoldings.push(parsed);
    }
  });

  return parsedHoldings;
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CONTENT-BASED ROW PARSER WITH GROUP STATE PROPAGATION
// ─────────────────────────────────────────────────────────────────────────────

export function parseRowContent(rowCells = [], activeState = {}) {
  let { currentGroup = 'I', currentChitValue = 100000, currentCategory = '₹1,00,000', currentGroupName = 'Group I' } = activeState;

  if (!Array.isArray(rowCells) || rowCells.length === 0) {
    return { isGroupHeaderOnly: false, memberRecord: null, newState: activeState };
  }

  // Combine row cells into trimmed strings
  const strCells = rowCells.map((c) => String(c || '').trim());
  const rowText = strCells.filter(Boolean).join(' ');

  if (!rowText) {
    return { isGroupHeaderOnly: false, memberRecord: null, newState: activeState };
  }

  // 1. Check if any cell contains a Group Header
  let groupMatch = null;
  for (const cell of strCells) {
    if (cell) {
      const match = parseGroupHeader(cell);
      if (match) {
        groupMatch = match;
        break;
      }
    }
  }

  if (!groupMatch) {
    groupMatch = parseGroupHeader(rowText);
  }

  if (groupMatch) {
    currentGroup = groupMatch.groupId;
    currentChitValue = groupMatch.chitValue;
    currentCategory = groupMatch.category;
    currentGroupName = groupMatch.groupName;
  }

  const newState = { currentGroup, currentChitValue, currentCategory, currentGroupName };

  // 2. Extract Phone numbers from anywhere in the row
  const phoneResult = parsePhoneNumbers(rowText);
  const primaryPhone = phoneResult.primaryPhone;
  const phoneNumbers = phoneResult.phoneNumbers;

  // 3. Check for multi-chit tokens cell (e.g. "XIV, XVI, 2L-F, 5L-B" or "5L-B+2, 5L-A+1")
  let parsedChitTokens = [];
  let multiChitCellIndex = -1;

  for (let idx = 0; idx < strCells.length; idx++) {
    const cell = strCells[idx];
    if (!cell) continue;

    if (cell.includes(',') || cell.includes('+') || /\b(?:[IVXLCDM]{1,6}|2L-[A-Z0-9]|5L-[A-Z0-9])\b/i.test(cell)) {
      const tokens = parseChitsTokenString(cell);
      if (tokens.length > 0) {
        parsedChitTokens = tokens;
        multiChitCellIndex = idx;
        break;
      }
    }
  }

  // 4. Extract Member Name from remaining text
  const potentialNameParts = [];

  for (let idx = 0; idx < strCells.length; idx++) {
    const cell = strCells[idx];
    if (!cell) continue;

    // Skip if cell is a group header or the multi-chit tokens cell
    if (parseGroupHeader(cell)) continue;
    if (idx === multiChitCellIndex) continue;

    let textOnly = cell;
    if (primaryPhone) {
      // Strip out 10+ digit sequences
      textOnly = textOnly.replace(/(?:\+?91[\s-]*)?[6-9]\d{9}/g, '').trim();
    }

    // Strip out group text if embedded (e.g. lakh-(XI), 2L-A, 5L-C)
    textOnly = textOnly
      .replace(/lakh\s*[-_\(]*\s*[IVXLCDM]+\s*[\)]*/gi, '')
      .replace(/[25]L\s*[-_\(]*\s*[A-Z0-9]+\s*[\)]*/gi, '')
      .trim();

    if (textOnly && textOnly.length >= 2 && !/^(name|phone|mobile|whatsapp|group|sl|no|sl\.no|sl\.\s*no|chits|chit)$/i.test(textOnly)) {
      potentialNameParts.push(textOnly);
    }
  }

  const rawNameStr = potentialNameParts.join(' ').trim();

  // If no name and no phone, this was purely a group header or spacer row
  if (!rawNameStr && !primaryPhone) {
    return { isGroupHeaderOnly: true, memberRecord: null, newState };
  }

  // 5. Parse +N holdings from rawNameStr
  const { cleanName, additionalHoldings, totalHoldings, sourceName } = parseNameAndHoldings(rawNameStr);

  const isValidPhone = Boolean(primaryPhone && primaryPhone.length === 12);
  const isValidName = Boolean(cleanName && cleanName.length >= 2);

  const calculatedTotalHoldings = parsedChitTokens.length > 0
    ? parsedChitTokens.reduce((s, t) => s + t.quantity, 0)
    : totalHoldings;

  const memberRecord = {
    sourceName: sourceName || rawNameStr,
    cleanName,
    rawPhone: phoneResult.rawPhone,
    primaryPhone,
    phoneNumbers,
    group: currentGroup,
    chitValue: currentChitValue,
    category: currentCategory,
    additionalHoldings,
    totalHoldings: calculatedTotalHoldings,
    parsedChitTokens,
    isValid: isValidName && isValidPhone,
    invalidReason: !isValidName ? 'Missing Name' : (!isValidPhone ? 'Missing or Invalid Phone Number' : null),
  };

  return { isGroupHeaderOnly: false, memberRecord, newState };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. PARSE EXCEL WORKBOOK ENGINE
// ─────────────────────────────────────────────────────────────────────────────

export async function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        let allParsedRows = [];
        const sheetDiagnostics = [];

        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName];
          const refRange = worksheet['!ref'] || 'A1:Z100';
          const rawGrid = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          
          const { parsedRows, groupHeadersCount } = processSheetGrid(rawGrid, sheetName);
          
          sheetDiagnostics.push({
            sheetName,
            refRange,
            physicalRows: rawGrid.length,
            parsedMemberRows: parsedRows.length,
            groupHeadersCount,
          });

          allParsedRows = allParsedRows.concat(parsedRows);
        });

        resolve({
          totalRows: allParsedRows.length,
          sheetDiagnostics,
          rows: allParsedRows,
        });
      } catch (err) {
        reject(new Error(`Failed to parse Excel file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

// Process 2D sheet grid with Group State Propagation
export function processSheetGrid(grid = [], sheetName = 'Sheet1') {
  const parsedRows = [];
  let groupHeadersCount = 0;

  let state = {
    currentGroup: 'I',
    currentChitValue: 100000,
    currentCategory: '₹1,00,000',
    currentGroupName: 'Group I',
  };

  grid.forEach((rowCells, rIdx) => {
    const { isGroupHeaderOnly, memberRecord, newState } = parseRowContent(rowCells, state);
    state = newState;

    if (isGroupHeaderOnly) {
      groupHeadersCount++;
      return;
    }

    if (memberRecord) {
      parsedRows.push({
        ...memberRecord,
        sheetName,
        rowIndex: rIdx + 1,
      });
    }
  });

  return { parsedRows, groupHeadersCount };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. GENERATE PREVIEW & MULTI-MEMBER SHARED-PHONE DEDUPLICATION
// ─────────────────────────────────────────────────────────────────────────────

export function generateImportPreview(parsedRows, overrideChitValue = 0) {
  const normalizedRecords = parsedRows.map((r) => {
    const val = overrideChitValue > 0 ? overrideChitValue : r.chitValue;
    const cat = val === 500000 ? '₹5,00,000' : (val === 200000 ? '₹2,00,000' : '₹1,00,000');
    return { ...r, chitValue: val, category: cat };
  });

  const memberMap = new Map(); // memberKey (cleanName_phone) -> Member Document object
  const manualReviewRecords = [];
  const conflicts = [];
  let duplicateRowsSkipped = 0;
  let crossCategoryMatches = 0;

  const categoryBreakdown = { lakh1: 0, lakh2: 0, lakh5: 0 };

  normalizedRecords.forEach((rec, idx) => {
    // Collect invalid records
    if (!rec.isValid) {
      manualReviewRecords.push({
        row: rec.rowIndex || idx + 1,
        sheet: rec.sheetName || 'Sheet1',
        record: rec,
        reason: rec.invalidReason,
      });
      return;
    }

    // UNIQUE MEMBER KEY: cleanName + '_' + primaryPhone
    // Ensures Prapul c/o Ravindra and Mulakala Ravindra on 8897315732 get SEPARATE MEMBER DOCUMENTS!
    const memberKey = generateMemberKey(rec.cleanName, rec.primaryPhone);

    if (!memberMap.has(memberKey)) {
      memberMap.set(memberKey, {
        id: `mem_${memberKey}`,
        memberKey,
        name: rec.cleanName,
        phone: rec.primaryPhone,
        whatsapp: rec.primaryPhone,
        phoneNumbers: [...rec.phoneNumbers],
        sourceNames: [rec.sourceName],
        holdings: [],
        sharedPhone: false,
        sharedPhoneWith: [],
      });
    } else {
      // Same person & same phone!
      const existingMember = memberMap.get(memberKey);
      rec.phoneNumbers.forEach((p) => {
        if (!existingMember.phoneNumbers.includes(p)) {
          existingMember.phoneNumbers.push(p);
        }
      });
    }

    const member = memberMap.get(memberKey);

    // Process holdings (either multi-chit tokens or single group row)
    const holdingsToAdd = rec.parsedChitTokens && rec.parsedChitTokens.length > 0
      ? rec.parsedChitTokens
      : [{ groupId: rec.group, chitValue: rec.chitValue, quantity: rec.totalHoldings }];

    holdingsToAdd.forEach((item) => {
      const grp = item.groupId || rec.group;
      const val = item.chitValue || rec.chitValue;
      const qty = item.quantity || 1;

      const existingHoldingIndex = member.holdings.findIndex(
        (h) => h.groupId === grp && h.totalChitValue === val
      );

      if (existingHoldingIndex >= 0) {
        member.holdings[existingHoldingIndex].quantity += qty;
        duplicateRowsSkipped++;
      } else {
        if (member.holdings.length > 0) {
          crossCategoryMatches++;
        }

        member.holdings.push({
          id: `chit_${memberKey}_${grp}_${val}`,
          name: `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${grp})`,
          groupId: grp,
          totalChitValue: val,
          amountToPay: Math.floor(val / 20),
          balanceAmount: val,
          quantity: qty,
          status: 'ACTIVE',
        });
      }

      // Category breakdown
      if (val === 500000) categoryBreakdown.lakh5 += qty;
      else if (val === 200000) categoryBreakdown.lakh2 += qty;
      else categoryBreakdown.lakh1 += qty;
    });
  });

  const allMembers = Array.from(memberMap.values());

  // Detect Shared Phone Numbers across distinct members (e.g. Prapul c/o Ravindra & Mulakala Ravindra)
  const phoneToMembersMap = new Map();
  allMembers.forEach((m) => {
    if (!phoneToMembersMap.has(m.phone)) {
      phoneToMembersMap.set(m.phone, []);
    }
    phoneToMembersMap.get(m.phone).push(m);
  });

  let sharedPhoneMembersCount = 0;

  phoneToMembersMap.forEach((mList, phone) => {
    if (mList.length > 1) {
      sharedPhoneMembersCount += mList.length;
      const namesList = mList.map((m) => m.name);
      mList.forEach((m) => {
        m.sharedPhone = true;
        m.sharedPhoneWith = namesList.filter((n) => n !== m.name);
      });
      conflicts.push({
        phone,
        reason: `Shared phone number (${phone}) shared by ${mList.length} distinct members: ${namesList.join(', ')}`,
      });
    }
  });

  const uniqueMembers = allMembers.map((m) => {
    const totalHoldings = m.holdings.reduce((sum, h) => sum + h.quantity, 0);
    const classification = totalHoldings > 1 ? 'MULTIPLE' : 'SINGLE';
    return { ...m, totalHoldings, classification };
  });

  const totalHoldingsCount = uniqueMembers.reduce((sum, m) => sum + m.totalHoldings, 0);
  const singleChitMembers = uniqueMembers.filter((m) => m.classification === 'SINGLE').length;
  const multipleChitMembers = uniqueMembers.filter((m) => m.classification === 'MULTIPLE').length;

  const missingNamesCount = manualReviewRecords.filter((r) => r.reason === 'Missing Name').length;
  const missingPhonesCount = manualReviewRecords.filter((r) => r.reason.includes('Phone')).length;

  return {
    totalExcelRows: parsedRows.length,
    validMemberRows: normalizedRecords.filter((r) => r.isValid).length,
    uniqueMembersCount: uniqueMembers.length,                   // Distinct Member Documents
    uniqueWhatsAppPhonesCount: phoneToMembersMap.size,           // WhatsApp Recipient Deduplicated Phones
    totalHoldings: totalHoldingsCount,
    categoryBreakdown,
    singleChitMembers,
    multipleChitMembers,
    sharedPhoneMembersCount,
    duplicateRowsSkipped,
    crossCategoryMatches,
    nameConflictsCount: conflicts.length,
    missingNamesCount,
    missingPhonesCount,
    invalidPhonesCount: missingPhonesCount,
    manualReviewRecords,
    conflicts,
    uniqueMembers,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. FIRESTORE PRODUCTION BATCHED IMPORT EXECUTION & POST-WRITE VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

export async function importToFirestore(previewData, onProgress = () => {}) {
  if (!previewData || !Array.isArray(previewData.uniqueMembers)) {
    throw new Error('Invalid preview data provided for import.');
  }

  const authUserEmail = auth.currentUser?.email || 'NOT_SIGNED_IN';
  const authUserUid = auth.currentUser?.uid || 'NONE';

  // REQUIREMENT 3 & 4: Diagnostic logging immediately before first write
  console.log('[PRODUCTION IMPORT DIAGNOSTIC START]', {
    firebaseProject: 'raghavendra-chitts-c0822',
    database: '(default)',
    collection: 'members',
    authenticatedUserEmail: authUserEmail,
    authenticatedUserUid: authUserUid,
    uniqueMembersToWrite: previewData.uniqueMembers.length,
  });

  const { uniqueMembers } = previewData;
  let membersCreated = 0;
  let holdingsCreated = 0;
  const failedRecords = [];

  const BATCH_SIZE = 50;

  for (let i = 0; i < uniqueMembers.length; i += BATCH_SIZE) {
    const batchMembers = uniqueMembers.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);

    batchMembers.forEach((m) => {
      const docRef = doc(db, 'members', m.id);
      batch.set(
        docRef,
        {
          id: m.id,
          memberKey: m.memberKey || m.id,
          name: m.name,
          phone: m.phone,
          whatsapp: m.whatsapp,
          sharedPhone: Boolean(m.sharedPhone),
          sharedPhoneWith: m.sharedPhoneWith || [],
          phoneNumbers: m.phoneNumbers || [m.phone],
          sourceNames: m.sourceNames || [m.name],
          status: 'active',
          chits: m.holdings.map((h) => ({
            id: h.id,
            name: h.name,
            groupId: h.groupId,
            totalChitValue: h.totalChitValue,
            amountToPay: h.amountToPay,
            balanceAmount: h.balanceAmount,
            quantity: h.quantity,
            status: h.status,
          })),
          totalHoldings: m.totalHoldings,
          classification: m.classification,
          updatedAt: serverTimestamp(),
        },
        { merge: true } // SAFE UPSERT RECONCILIATION — NEVER DELETES EXISTING DOCUMENTS
      );
    });

    try {
      await batch.commit();
      membersCreated += batchMembers.length;
      batchMembers.forEach((m) => {
        holdingsCreated += m.totalHoldings;
      });

      // REQUIREMENT 5: Log after every successful batch commit
      console.log({
        batchCommitted: true,
        batchSize: batchMembers.length,
        totalImported: membersCreated,
      });
    } catch (err) {
      // REQUIREMENT 6: Log actual Firebase error and STOP (Do NOT swallow errors!)
      console.error('[FIRESTORE BATCH COMMIT ERROR]', {
        code: err.code || 'unknown',
        message: err.message || String(err),
        batchSize: batchMembers.length,
        authUserEmail,
      });
      throw new Error(`Firestore batch write failed (code: ${err.code || 'unknown'}): ${err.message}`);
    }

    const processedCount = Math.min(i + BATCH_SIZE, uniqueMembers.length);
    onProgress(processedCount, uniqueMembers.length);
  }

  // REQUIREMENT 7: Perform actual Firestore verification query with getDocs
  console.log('[FIRESTORE POST-IMPORT VERIFICATION QUERY]', {
    firebaseProject: 'raghavendra-chitts-c0822',
    database: '(default)',
    collection: 'members',
    authUserEmail,
  });

  let verifiedDocsCount = 0;
  try {
    const snapshot = await getDocs(collection(db, 'members'));
    verifiedDocsCount = snapshot.docs.length;
    console.log('[FIRESTORE POST-IMPORT VERIFICATION QUERY RESULT]', {
      verifiedDocsCount,
      membersWritten: membersCreated,
    });
  } catch (verifyErr) {
    console.error('[FIRESTORE POST-IMPORT VERIFICATION ERROR]', {
      code: verifyErr.code,
      message: verifyErr.message,
    });
    throw new Error(`Post-import Firestore verification query failed (code: ${verifyErr.code}): ${verifyErr.message}`);
  }

  if (verifiedDocsCount === 0 && membersCreated > 0) {
    throw new Error('Firestore verification failed: 0 documents returned by getDocs(collection(db, "members")). Writes were not committed.');
  }

  // REQUIREMENT 8: Return full verified import summary
  return {
    firebaseProject: 'raghavendra-chitts-c0822',
    firestoreDatabase: '(default)',
    rowsProcessed: previewData.totalExcelRows,
    uniqueMembersProcessed: uniqueMembers.length,
    membersWritten: membersCreated,
    membersVerified: verifiedDocsCount,
    holdingsWritten: holdingsCreated,
    duplicatesSkipped: previewData.duplicateRowsSkipped,
    conflictsDetected: previewData.conflicts.length,
    rejectedRowsCount: previewData.manualReviewRecords ? previewData.manualReviewRecords.length : 0,
    errors: failedRecords,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. COMPREHENSIVE ALGORITHM TEST SUITE WITH SHARED PHONE TESTS
// ─────────────────────────────────────────────────────────────────────────────

export async function testImportPipeline() {
  console.log('=== RUNNING ALGORITHM TEST SUITE WITH SHARED-PHONE & MEMBER SEPARATION TESTS ===');

  const rawGrid = [
    // ₹1 Lakh Group XI
    ['lakh-(XI)', '', ''],
    ['', 'AW Rani', '8466832245, 9912452245'],
    ['', 'Durga MLHP', '8639520096'],
    ['', 'Mummadi Ramu ,Bhaskarao +3', '9951050874'],           // Critical Mummadi Ramu +3 = 4 holdings

    // SHARED PHONE TEST PAIR 1: Prapul c/o Ravindra vs Mulakala Ravindra (same phone 8897315732)
    ['', 'Prapul c/o Ravindra', '8897315732'],
    ['', 'Mulakala Ravindra', '8897315732'],

    // SHARED PHONE TEST PAIR 2: Nuli Rajeswari vs Nuli Muthyalarao (same phone 8341448274)
    ['', 'Nuli Rajeswari', '8341448274'],
    ['', 'Nuli Muthyalarao', '8341448274'],

    // ₹1 Lakh Group I
    ['lakh-(I)', '', ''],
    ['', 'Nalla Shankar', '9705691133'],
    ['', 'Adam Raju, vro +1', '9398442848'],

    // ₹2 Lakh Group A
    ['2L-A', '', ''],
    ['', 'Sattibabu MLHP +2', '9515733639'],

    // ₹5 Lakh Group C
    ['5L-C', '', ''],
    ['', 'HV Jyothi +2', '9491171580'],
    ['', 'Nalla Shankar', '9705691133'],                       // Same member (Nalla Shankar) across 1L and 5L

    // MULTI-CHIT EXCEL TEST ROWS
    ['', 'G. Ravi', '9701399089', 'XIV, XVI, 2L-F, 5L-B'],
    ['', 'Petrol Bunk', '9765432155', '5L-B+2, 5L-A+1, 5L-C+1, 5L-D+1'],
    ['', 'Marlapati Venkataramana', '9550359855', '2L-F, 2L-F, 2L-F, 2L-F, 5L-D'],

    // Invalid & Blank Rows
    ['', 'Missing Phone Member', ''],
    ['', '', '9988776655'],
    ['', '', ''],
  ];

  const { parsedRows } = processSheetGrid(rawGrid, 'TestSheet');
  const preview = generateImportPreview(parsedRows);

  // Test 1: Prapul c/o Ravindra != Mulakala Ravindra (2 member docs, same phone)
  const prapul = preview.uniqueMembers.find((m) => m.name === 'Prapul c/o Ravindra' && m.phone === '918897315732');
  const mulakala = preview.uniqueMembers.find((m) => m.name === 'Mulakala Ravindra' && m.phone === '918897315732');
  const t_sharedPair1Passed = Boolean(prapul && mulakala && prapul.id !== mulakala.id && prapul.sharedPhone && mulakala.sharedPhone);

  // Test 2: Nuli Rajeswari != Nuli Muthyalarao (2 member docs, same phone)
  const rajeswari = preview.uniqueMembers.find((m) => m.name === 'Nuli Rajeswari' && m.phone === '918341448274');
  const muthyalarao = preview.uniqueMembers.find((m) => m.name === 'Nuli Muthyalarao' && m.phone === '918341448274');
  const t_sharedPair2Passed = Boolean(rajeswari && muthyalarao && rajeswari.id !== muthyalarao.id && rajeswari.sharedPhone && muthyalarao.sharedPhone);

  // Test 3: Individual holdings retained
  const t_holdingsRetainedPassed = prapul && mulakala && prapul.totalHoldings === 1 && mulakala.totalHoldings === 1;

  // Test 4: WhatsApp recipient deduplication (shared phone 8897315732 yields 1 WhatsApp phone)
  const t_whatsappDedupePassed = preview.uniqueWhatsAppPhonesCount < preview.uniqueMembersCount;

  // Test 5: Critical Mummadi Ramu +3 = 4 holdings, 1 member doc
  const mummadi = preview.uniqueMembers.find((m) => m.phone === '919951050874');
  const t_mummadiPassed = mummadi && mummadi.name === 'Mummadi Ramu ,Bhaskarao' && mummadi.totalHoldings === 4 && mummadi.classification === 'MULTIPLE';

  // Test 6: Multi-Chit parsing (G. Ravi 4, Petrol Bunk 9, Marlapati 5)
  const gRavi = preview.uniqueMembers.find((m) => m.name === 'G. Ravi' && m.phone === '919701399089');
  const petrolBunk = preview.uniqueMembers.find((m) => m.name === 'Petrol Bunk' && m.phone === '919765432155');
  const marlapati = preview.uniqueMembers.find((m) => m.name === 'Marlapati Venkataramana' && m.phone === '919550359855');
  const t_multiChitPassed = Boolean(
    gRavi && gRavi.totalHoldings === 4 && gRavi.classification === 'MULTIPLE' &&
    petrolBunk && petrolBunk.totalHoldings === 9 && petrolBunk.classification === 'MULTIPLE' &&
    marlapati && marlapati.totalHoldings === 5 && marlapati.classification === 'MULTIPLE'
  );

  const allPassed =
    Boolean(t_sharedPair1Passed) &&
    Boolean(t_sharedPair2Passed) &&
    Boolean(t_holdingsRetainedPassed) &&
    Boolean(t_whatsappDedupePassed) &&
    Boolean(t_mummadiPassed) &&
    Boolean(t_multiChitPassed);

  console.log('=== TEST RESULTS SUMMARY ===');
  console.log('1. Prapul c/o Ravindra != Mulakala Ravindra (2 Separate Member Docs):', t_sharedPair1Passed ? 'PASS ✅' : 'FAIL ❌');
  console.log('2. Nuli Rajeswari != Nuli Muthyalarao (2 Separate Member Docs):', t_sharedPair2Passed ? 'PASS ✅' : 'FAIL ❌');
  console.log('3. Individual Holdings Retained for Shared Phone Members:', t_holdingsRetainedPassed ? 'PASS ✅' : 'FAIL ❌');
  console.log('4. WhatsApp Recipients Deduplicated by Phone (1 Recipient per Phone):', t_whatsappDedupePassed ? 'PASS ✅' : 'FAIL ❌');
  console.log('5. Critical Mummadi Ramu +3 = 4 Holdings, 1 Member Doc:', t_mummadiPassed ? 'PASS ✅' : 'FAIL ❌');
  console.log('6. Multi-Chit Parsing (G.Ravi=4, PetrolBunk=9, Marlapati=5):', t_multiChitPassed ? 'PASS ✅' : 'FAIL ❌');

  return {
    success: allPassed,
    preview,
    t_sharedPair1Passed,
    t_sharedPair2Passed,
    t_holdingsRetainedPassed,
    t_whatsappDedupePassed,
    t_mummadiPassed,
    t_multiChitPassed,
  };
}
