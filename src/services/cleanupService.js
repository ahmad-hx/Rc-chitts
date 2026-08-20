import {
  collection,
  getDocs,
  doc,
  updateDoc,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { historyService } from './historyService';

function normalizePhone(value = '') {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits;
}

// ─── 1. INSPECT FIRESTORE AND BUILD CLEANUP PREVIEW ───────────────────────────
export async function generateCleanupPreview() {
  const membersRef = collection(db, 'members');
  const chitsRef = collection(db, 'chits');
  const msgHistoryRef = collection(db, 'messageHistory');
  const paymentsRef = collection(db, 'payments');

  const [membersSnap, chitsSnap, msgSnap, paymentsSnap] = await Promise.all([
    getDocs(membersRef).catch(() => ({ docs: [] })),
    getDocs(chitsRef).catch(() => ({ docs: [] })),
    getDocs(msgHistoryRef).catch(() => ({ docs: [] })),
    getDocs(paymentsRef).catch(() => ({ docs: [] })),
  ]);

  const rawMembers = membersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rawChits = chitsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rawMsgs = msgSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const rawPayments = paymentsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  const testMembers = [];
  const duplicateMembers = [];
  const legitimateMembers = [];

  const testPhones = ['918125737275', '8125737275', '917674937363', '7674937363'];

  // Map to track canonical records for deduplication
  const phoneMap = new Map();
  const waMap = new Map();

  rawMembers.forEach((m) => {
    // Skip already archived or soft-deleted members
    if (m.status === 'archived' || m.isDeleted) return;

    const normP = normalizePhone(m.phone);
    const normW = normalizePhone(m.whatsapp || m.phone);
    const nameLower = (m.name || '').toLowerCase().trim();

    // Check if test member
    const isAhmad = nameLower.includes('ahmad') || testPhones.includes(normP) || testPhones.includes(normW);
    const isSandeep = nameLower.includes('sandeep') || testPhones.includes(normP) || testPhones.includes(normW);
    const isExplicitTest = m.isTestRecord || m.status === 'TEST' || (m.notes && m.notes.toLowerCase().includes('test record'));

    if (isAhmad || isSandeep || isExplicitTest) {
      testMembers.push({
        ...m,
        reason: isAhmad ? 'TEST_MEMBER_AHMAD' : isSandeep ? 'TEST_MEMBER_SANDEEP' : 'TEST_RECORD_FLAG',
        details: `Test member created for messaging tests (${m.name} - ${m.phone || 'No phone'})`,
      });
      return;
    }

    // Check duplicate logic (only based on same normalized phone or same WhatsApp + same name)
    const existingByPhone = phoneMap.get(normP);
    const existingByWa = waMap.get(normW);

    if (normP && existingByPhone) {
      duplicateMembers.push({
        ...m,
        canonicalId: existingByPhone.id,
        canonicalName: existingByPhone.name,
        reason: 'DUPLICATE_PHONE',
        details: `Duplicate of canonical record "${existingByPhone.name}" (${existingByPhone.id}) with same phone +${normP}`,
      });
    } else if (normW && existingByWa && normW !== normP) {
      duplicateMembers.push({
        ...m,
        canonicalId: existingByWa.id,
        canonicalName: existingByWa.name,
        reason: 'DUPLICATE_WHATSAPP',
        details: `Duplicate of canonical record "${existingByWa.name}" (${existingByWa.id}) with same WhatsApp +${normW}`,
      });
    } else {
      legitimateMembers.push(m);
      if (normP) phoneMap.set(normP, m);
      if (normW) waMap.set(normW, m);
    }
  });

  // Test & Duplicate Message History
  const testMessageRecords = [];
  const duplicateMessageRecords = [];
  const legitimateMessages = [];

  rawMsgs.forEach((msg) => {
    if (msg.isDeleted || msg.status === 'ARCHIVED_TEST') return;

    const normP = normalizePhone(msg.phone);
    const recipientLower = (msg.recipientName || msg.memberName || '').toLowerCase();

    const isTestMsg =
      msg.isTest ||
      testPhones.includes(normP) ||
      recipientLower.includes('ahmad') ||
      recipientLower.includes('sandeep') ||
      msg.status === 'NOT_CONFIGURED';

    if (isTestMsg) {
      testMessageRecords.push({
        ...msg,
        reason: 'TEST_MESSAGE_LOG',
        details: `Test message record for ${msg.recipientName || 'Member'} (+${msg.phone || 'N/A'}) - Status: ${msg.status}`,
      });
    } else {
      legitimateMessages.push(msg);
    }
  });

  // Duplicate / Test Chit Groups
  const duplicateTestGroups = [];
  const legitimateChits = [];
  const groupKeyMap = new Map();

  rawChits.forEach((g) => {
    if (g.status === 'ARCHIVED' || g.isDeleted) return;

    const key = `${g.groupId}_${g.totalChitValue || 100000}`;
    if (g.isTestGroup || g.name?.toLowerCase().includes('test')) {
      duplicateTestGroups.push({
        ...g,
        reason: 'TEST_CHIT_GROUP',
        details: `Test chit group ${g.name} (${g.id})`,
      });
    } else if (groupKeyMap.has(key)) {
      duplicateTestGroups.push({
        ...g,
        canonicalId: groupKeyMap.get(key).id,
        reason: 'DUPLICATE_CHIT_GROUP',
        details: `Duplicate group ${g.name} (${g.id}) matching canonical group ${groupKeyMap.get(key).id}`,
      });
    } else {
      legitimateChits.push(g);
      groupKeyMap.set(key, g);
    }
  });

  return {
    summary: {
      testingMembersFound: testMembers.length,
      duplicateMembersFound: duplicateMembers.length,
      testMessageRecordsFound: testMessageRecords.length,
      duplicateMessageRecordsFound: duplicateMessageRecords.length,
      duplicateTestGroupsFound: duplicateTestGroups.length,
      legitimateMembersPreserved: legitimateMembers.length,
      legitimateChitsPreserved: legitimateChits.length,
      legitimateMessagesPreserved: legitimateMessages.length,
      legitimatePaymentsPreserved: rawPayments.length,
    },
    testMembers,
    duplicateMembers,
    testMessageRecords,
    duplicateMessageRecords,
    duplicateTestGroups,
    legitimateMembers,
    legitimateChits,
    legitimateMessages,
  };
}

// ─── 2. EXECUTE SAFE CLEANUP ──────────────────────────────────────────────────
export async function executeSafeCleanup() {
  const preview = await generateCleanupPreview();
  const batch = writeBatch(db);

  let archivedMemberCount = 0;
  let archivedMessageCount = 0;
  let archivedGroupCount = 0;

  // 1. Archive Test Members
  for (const m of preview.testMembers) {
    const docRef = doc(db, 'members', m.id);
    batch.update(docRef, {
      status: 'archived',
      isDeleted: true,
      deletedReason: m.reason || 'TEST_DATA',
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    archivedMemberCount++;
  }

  // 2. Archive Duplicate Members
  for (const m of preview.duplicateMembers) {
    const docRef = doc(db, 'members', m.id);
    batch.update(docRef, {
      status: 'archived',
      isDeleted: true,
      deletedReason: 'DUPLICATE',
      canonicalRecordId: m.canonicalId || null,
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    archivedMemberCount++;
  }

  // 3. Archive Test & Debugging Message History
  for (const msg of preview.testMessageRecords) {
    const docRef = doc(db, 'messageHistory', msg.id);
    batch.update(docRef, {
      status: 'ARCHIVED_TEST',
      isDeleted: true,
      deletedReason: 'TEST_MESSAGE_LOG',
      archivedAt: serverTimestamp(),
    });
    archivedMessageCount++;
  }

  // 4. Archive Duplicate/Test Chit Groups
  for (const g of preview.duplicateTestGroups) {
    const docRef = doc(db, 'chits', g.id);
    batch.update(docRef, {
      status: 'ARCHIVED',
      isDeleted: true,
      deletedReason: g.reason || 'TEST_GROUP',
      archivedAt: serverTimestamp(),
    });
    archivedGroupCount++;
  }

  // Commit batch updates safely to Firestore
  await batch.commit();

  // Log cleanup audit event to History
  try {
    await historyService.logHistoryEvent({
      category: 'System',
      action: 'SYSTEM_SAFE_CLEANUP',
      title: 'Safe Cleanup Executed',
      details: `Archived ${archivedMemberCount} test/duplicate members, ${archivedMessageCount} test messages, and ${archivedGroupCount} test groups. Legitimate production records were preserved untouched.`,
      entityType: 'SYSTEM',
    });
  } catch (_) {}

  return {
    success: true,
    archivedMemberCount,
    archivedMessageCount,
    archivedGroupCount,
    preview,
  };
}
