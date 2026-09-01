/**
 * Raghavendra Chitts — Messaging Service (Firebase-Based Modular Architecture)
 *
 * Foundation:
 *   - Reads existing member data from Firestore ('members' collection) without mutating member docs.
 *   - Normalizes recipient phone numbers.
 *   - Filters recipients by category, group, payment status, and search query.
 *   - Generates personalized payment reminder and custom messages.
 *   - Stores all messaging audit records in a dedicated Firestore collection: 'messageHistory'.
 *   - Supports safe frontend dispatch via WhatsApp Web deep-links & backend Cloud Functions.
 */

import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase.js';
import { memberService } from './dbService.js';
import { formatCurrency } from './messageFormatter.js';
import { getEffectiveMonthlyAmount } from '../utils/amountUtils.js';
import { getChitMonthForGroup } from '../utils/chitMonthUtils.js';

// ─── Default Message Templates ────────────────────────────────────────────────
export const MESSAGE_TEMPLATES = {
  PAYMENT_REMINDER: {
    id: 'PAYMENT_REMINDER',
    title: 'Payment Reminder',
    englishText: `Hello {MEMBER_NAME},

This is a payment reminder from Raghavendra Chitts.

Chit Group: {CHIT_NAME}
Chit Month: {CHIT_MONTH}
Billing Month: {{billingMonth}}
Due Date: {DUE_DATE}

Monthly Chit Amount: ₹{CHIT_AMOUNT}
Pending Amount: ₹{PENDING_AMOUNT}
Balance Credit: ₹{BALANCE_AMOUNT}
----------------------------------------
Final Payable Amount: ₹{FINAL_AMOUNT}

Please make your payment at your earliest convenience.

Thank you,
Raghavendra Chitts`,
    teluguText: `నమస్కారం {MEMBER_NAME} గారు,

రాఘవేంద్ర చిట్స్ నుండి చెల్లింపు రిమైండర్.

చిట్టీ గ్రూప్: {CHIT_NAME}
చిట్టీ నెల: {CHIT_MONTH}
బిల్లింగ్ నెల: {{billingMonth}}
గడువు తేదీ: {DUE_DATE}

నెలవారీ చిట్టీ మొత్తం: ₹{CHIT_AMOUNT}
బాకీ ఉన్న మొత్తం: ₹{PENDING_AMOUNT}
బ్యాలెన్స్ క్రెడిట్: ₹{BALANCE_AMOUNT}
----------------------------------------
ఫైనల్ చెల్లించాల్సిన మొత్తం: ₹{FINAL_AMOUNT}

దయచేసి మీ చెల్లింపును త్వరగా పూర్తి చేయండి.

ధన్యవాదములు,
రాఘవేంద్ర చిట్స్`,
  },
  PENDING_PAYMENT: {
    id: 'PENDING_PAYMENT',
    title: 'Pending Payment Warning',
    englishText: `Hello {MEMBER_NAME},

Your chit account currently has a pending amount.

Chit Group: {CHIT_NAME}
Chit Month: {CHIT_MONTH}
Billing Month: {{billingMonth}}
Due Date: {DUE_DATE}

Monthly Chit Amount: ₹{CHIT_AMOUNT}
Pending Overdue: ₹{PENDING_AMOUNT}
Balance Credit: ₹{BALANCE_AMOUNT}
----------------------------------------
Final Amount Due: ₹{FINAL_AMOUNT}

Please clear your pending payment immediately to avoid late fee penalties.

Thank you,
Raghavendra Chitts`,
    teluguText: `నమస్కారం {MEMBER_NAME} గారు,

మీ చిట్టీ ఖాతాలో బాకీ మొత్తం చెల్లించవలసి ఉంది.

చిట్టీ గ్రూప్: {CHIT_NAME}
చిట్టీ నెల: {CHIT_MONTH}
బిల్లింగ్ నెల: {{billingMonth}}
గడువు తేదీ: {DUE_DATE}

నెలవారీ చిట్టీ మొత్తం: ₹{CHIT_AMOUNT}
బాకీ పడిన మొత్తం: ₹{PENDING_AMOUNT}
బ్యాలెన్స్ క్రెడిట్: ₹{BALANCE_AMOUNT}
----------------------------------------
ఫైనల్ బకాయి మొత్తం: ₹{FINAL_AMOUNT}

దయచేసి మీ బకాయిని త్వరగా చెల్లించి ఆలస్య రుసుములను నివారించండి.

ధన్యవాదములు,
రాఘవేంద్ర చిట్స్`,
  },
  CUSTOM: {
    id: 'CUSTOM',
    title: 'Custom Message',
    englishText: `Hello {MEMBER_NAME},

This is an important update from Raghavendra Chitts regarding your chit account.

Chit Group: {CHIT_NAME}
Chit Month: {CHIT_MONTH}
Billing Month: {{billingMonth}}
Due Date: {DUE_DATE}

Monthly Chit Amount: ₹{CHIT_AMOUNT}
Pending Amount: ₹{PENDING_AMOUNT}
Balance Credit: ₹{BALANCE_AMOUNT}
----------------------------------------
Final Amount: ₹{FINAL_AMOUNT}

Thank you,
Raghavendra Chitts`,
    teluguText: `నమస్కారం {MEMBER_NAME} గారు,

రాఘవేంద్ర చిట్స్ నుండి ముఖ్యమైన గమనిక.

చిట్టీ గ్రూప్: {CHIT_NAME}
చిట్టీ నెల: {CHIT_MONTH}
బిల్లింగ్ నెల: {{billingMonth}}
గడువు తేదీ: {DUE_DATE}

నెలవారీ చిట్టీ మొత్తం: ₹{CHIT_AMOUNT}
బాకీ మొత్తం: ₹{PENDING_AMOUNT}
బ్యాలెన్స్ క్రెడిట్: ₹{BALANCE_AMOUNT}
----------------------------------------
ఫైనల్ మొత్తం: ₹{FINAL_AMOUNT}

ధన్యవాదములు,
రాఘవేంద్ర చిట్స్`,
  },
};

// ─── Phone Number Normalization ───────────────────────────────────────────────
export function normalizePhone(phone) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, '');
  if (!clean) return null;

  // 10 digits -> Indian mobile number without country code
  if (clean.length === 10) {
    return `91${clean}`;
  }

  // 12 digits starting with 91
  if (clean.length === 12 && clean.startsWith('91')) {
    return clean;
  }

  // 11 digits starting with 0
  if (clean.length === 11 && clean.startsWith('0')) {
    return `91${clean.slice(1)}`;
  }

  // Generic E.164 (10 to 15 digits)
  if (clean.length >= 10 && clean.length <= 15) {
    return clean;
  }

  return null;
}

// ─── Active Chits Helper ──────────────────────────────────────────────────────
export function getActiveChits(member) {
  if (!member) return [];
  if (Array.isArray(member.activeChits) && member.activeChits.length > 0) {
    return member.activeChits.filter((c) => !c.status || c.status === 'ACTIVE');
  }
  if (Array.isArray(member.chits) && member.chits.length > 0) {
    return member.chits.filter((c) => !c.status || c.status === 'ACTIVE');
  }
  if (Array.isArray(member.holdings) && member.holdings.length > 0) {
    return member.holdings.filter((c) => !c.status || c.status === 'ACTIVE');
  }
  if (member.groupId || member.group || member.chitGroup) {
    return [{
      id: `chit_${member.id || 'default'}_${member.groupId || member.group || member.chitGroup || 'I'}`,
      groupId: member.groupId || member.group || member.chitGroup || 'I',
      totalChitValue: member.calculatedTotalChitValue || member.totalChitValue || 100000,
      quantity: 1,
      pending: member.pending || 0,
      balance: member.balance || 0,
      status: 'ACTIVE',
    }];
  }
  return [];
}

// ─── Filter Recipients ────────────────────────────────────────────────────────
export function filterRecipients(members = [], { searchQuery = '', categoryFilter = 'all', groupFilter = 'all', statusFilter = 'all' } = {}) {
  const sq = String(searchQuery || '').toLowerCase().trim();

  return members.filter((m) => {
    if (m.status === 'archived') return false;

    // Search query filter (Name, Phone, WhatsApp)
    const matchesSearch =
      !sq ||
      (m.name && m.name.toLowerCase().includes(sq)) ||
      (m.phone && String(m.phone).includes(sq)) ||
      (m.whatsapp && String(m.whatsapp).includes(sq));
    if (!matchesSearch) return false;

    // Classification filter (Single vs Multiple)
    const activeChits = getActiveChits(m);
    const isMulti = activeChits.length > 1;

    if (categoryFilter === 'single' && isMulti) return false;
    if (categoryFilter === 'multiple' && !isMulti) return false;
    if (categoryFilter === '100000' && !activeChits.some((c) => Number(c.totalChitValue || 100000) === 100000)) return false;
    if (categoryFilter === '200000' && !activeChits.some((c) => Number(c.totalChitValue || 100000) === 200000)) return false;
    if (categoryFilter === '500000' && !activeChits.some((c) => Number(c.totalChitValue || 100000) === 500000)) return false;

    // Group filter
    if (groupFilter && groupFilter !== 'all') {
      const gf = String(groupFilter).toLowerCase();
      const hasGroupInChits = activeChits.some((c) => String(c.groupId || c.group || '').toLowerCase() === gf);
      const rootGroup = String(m.groupId || m.group || m.chitGroup || '').toLowerCase();
      const hasGroup = hasGroupInChits || rootGroup === gf;
      if (!hasGroup) return false;
    }

    // Status filter
    if (statusFilter === 'single' && isMulti) return false;
    if (statusFilter === 'multiple' && !isMulti) return false;
    if (statusFilter === 'due') {
      const hasPending = activeChits.some((c) => Number(c.pending || c.amountToPay || 0) > 0);
      if (!hasPending) return false;
    }

    return true;
  });
}

// ─── Generate Personalized Message ─────────────────────────────────────────────
export function generatePersonalizedMessage(
  member,
  templateText,
  {
    groupId = 'I',
    billingMonth = 'August 2026',
    chitAmount = null,
    pendingAmount = null,
    balanceAmount = null,
    totalAmount = null,
    finalAmount = null,
    dueDate = '15th of Month',
    language = 'english',
    groupPaymentSettings = {},
  } = {}
) {
  if (!member) return '';

  const activeChits = getActiveChits(member);
  const memberName = member.name || 'Member';
  const isMulti = activeChits.length > 1;

  // ── 1. MULTI-CHIT MEMBER (2+ active chits) ──
  if (isMulti) {
    const chitBreakdown = activeChits.map((c, idx) => {
      const val = Number(c.totalChitValue || c.chitValue || 100000);
      const grp = c.groupId || c.group || 'I';
      const baseMonthly = getEffectiveMonthlyAmount(member, c, groupPaymentSettings);

      const quantity = Number(c.quantity || 1);
      const monthlyAmount = baseMonthly * quantity;
      const cPending = Number(c.pending || 0);
      const cBalance = Number(c.balance || 0);
      const payableAmount = Math.max(monthlyAmount + cPending - cBalance, 0);
      const chitMonthData = getChitMonthForGroup(c, billingMonth, activeChits);

      const lakhStr = val >= 100000 ? `₹${(val / 100000).toFixed(0)} Lakh Group ${grp}` : `Group ${grp}`;
      const groupTitle = c.name && c.name.trim() ? c.name : lakhStr;
      const teluguGroupTitle = groupTitle.replace(/Chit/g, 'చిట్టీ').replace(/Group/g, 'గ్రూప్');

      return {
        index: idx + 1,
        groupTitle,
        teluguGroupTitle,
        val,
        grp,
        monthlyAmount,
        pending: cPending,
        balance: cBalance,
        payableAmount,
        chitMonth: chitMonthData.currentMonth,
      };
    });

    const calculatedTotalPayable = chitBreakdown.reduce((sum, item) => sum + item.payableAmount, 0);
    const effectiveTotal = finalAmount !== null && finalAmount !== undefined ? Number(finalAmount) : calculatedTotalPayable;

    // Check template language: Telugu, Bilingual, or English
    const rawTemplate = templateText || '';
    const isTeluguOnly = /[\u0C00-\u0C7F]/.test(rawTemplate) && !/Hello|Dear|Chit/i.test(rawTemplate);
    const isBilingual = rawTemplate.includes('-------------------') || (/[\u0C00-\u0C7F]/.test(rawTemplate) && /Hello|Dear|Chit/i.test(rawTemplate));

    // English Breakdown Text
    const englishBreakdownText = chitBreakdown
      .map((item) => {
        return `${item.index}. ${item.groupTitle}
   Chit Month: ${item.chitMonth}
   Billing Month: ${billingMonth}
   Due Date: ${dueDate}
   Monthly Amount: ₹${item.monthlyAmount.toLocaleString('en-IN')}
   Pending Amount: ₹${item.pending.toLocaleString('en-IN')}
   Balance Credit: ₹${item.balance.toLocaleString('en-IN')}
   Final Payable Amount: ₹${item.payableAmount.toLocaleString('en-IN')}`;
      })
      .join('\n\n');

    // Telugu Breakdown Text
    const teluguBreakdownText = chitBreakdown
      .map((item) => {
        return `${item.index}. ${item.teluguGroupTitle}
   చిట్టీ నెల: ${item.chitMonth}
   బిల్లింగ్ నెల: ${billingMonth}
   గడువు తేదీ: ${dueDate}
   నెలవారీ మొత్తం: ₹${item.monthlyAmount.toLocaleString('en-IN')}
   బాకీ ఉన్న మొత్తం: ₹${item.pending.toLocaleString('en-IN')}
   బ్యాలెన్స్ క్రెడిట్: ₹${item.balance.toLocaleString('en-IN')}
   ఫైనల్ చెల్లించాల్సిన మొత్తం: ₹${item.payableAmount.toLocaleString('en-IN')}`;
      })
      .join('\n\n');

    if (isTeluguOnly) {
      return `నమస్కారం ${memberName} గారు,

రాఘవేంద్ర చిట్స్ నుండి చెల్లింపు రిమైండర్.

మీ యాక్టివ్ చిట్టీల వివరాలు:

${teluguBreakdownText}

────────────────────────────────────────
మొత్తం కలిపి చెల్లించాల్సిన ఫైనల్ విలువ: ₹${effectiveTotal.toLocaleString('en-IN')}

దయచేసి మీ చెల్లింపును త్వరగా పూర్తి చేయండి.

ధన్యవాదములు,
రాఘవేంద్ర చిట్స్`;
    }

    if (isBilingual) {
      return `Hello ${memberName},

This is a payment reminder from Raghavendra Chitts.

Your Active Chits:

${englishBreakdownText}

────────────────────────────────────────
Total Combined Final Payable: ₹${effectiveTotal.toLocaleString('en-IN')}

Please make your payment at your earliest convenience.

Thank you,
Raghavendra Chitts

-------------------

నమస్కారం ${memberName} గారు,

రాఘవేంద్ర చిట్స్ నుండి చెల్లింపు రిమైండర్.

మీ యాక్టివ్ చిట్టీల వివరాలు:

${teluguBreakdownText}

────────────────────────────────────────
మొత్తం కలిపి చెల్లించాల్సిన ఫైనల్ విలువ: ₹${effectiveTotal.toLocaleString('en-IN')}

దయచేసి మీ చెల్లింపును త్వరగా పూర్తి చేయండి.

ధన్యవాదములు,
రాఘవేంద్ర చిట్స్`;
    }

    // Default English Multi-Chit Format
    return `Hello ${memberName},

This is a payment reminder from Raghavendra Chitts.

Your Active Chits:

${englishBreakdownText}

────────────────────────────────────────
Total Combined Final Payable: ₹${effectiveTotal.toLocaleString('en-IN')}

Please make your payment at your earliest convenience.

Thank you,
Raghavendra Chitts`;
  }

  // ── 2. SINGLE CHIT MEMBER (Exactly 1 active chit or single holding) ──
  const targetChit = activeChits[0] || (member?.groupId || member?.group || member?.chitGroup ? {
    groupId: member.groupId || member.group || member.chitGroup,
    totalChitValue: member.calculatedTotalChitValue || member.totalChitValue || 100000,
    pending: member.pending || 0,
    balance: member.balance || 0,
    quantity: 1,
  } : {});

  const chitValue = Number(targetChit.totalChitValue || member.calculatedTotalChitValue || member.totalChitValue || 100000);
  const grp = targetChit.groupId || targetChit.group || member.groupId || member.group || member.chitGroup || (groupId !== 'all' ? groupId : 'I');
  const chitName = targetChit.name || (chitValue >= 100000 ? `₹${(chitValue / 100000).toFixed(0)} Lakh Group ${grp}` : `Group ${grp}`);

  const chitMonthInfo = getChitMonthForGroup(targetChit, billingMonth, activeChits);

  const baseMonthly = getEffectiveMonthlyAmount(member, targetChit, groupPaymentSettings);
  const quantity = Number(targetChit.quantity || 1);
  const cAmt = Number(chitAmount !== null && chitAmount !== undefined ? chitAmount : (baseMonthly * quantity));
  const pAmt = Number(pendingAmount !== null && pendingAmount !== undefined ? pendingAmount : (targetChit.pending ?? member.pending ?? 0));
  const bAmt = Number(balanceAmount !== null && balanceAmount !== undefined ? balanceAmount : (targetChit.balance ?? member.balance ?? 0));
  const totAmt = totalAmount !== null && totalAmount !== undefined ? Number(totalAmount) : cAmt + pAmt;
  const finAmt = finalAmount !== null && finalAmount !== undefined ? Number(finalAmount) : Math.max(totAmt - bAmt, 0);

  let msg = templateText || MESSAGE_TEMPLATES.PAYMENT_REMINDER.englishText;

  msg = msg.replace(/{MEMBER_NAME}/g, memberName);
  msg = msg.replace(/\{\{memberName\}\}/g, memberName);
  msg = msg.replace(/{CHIT_NAME}/g, chitName);
  msg = msg.replace(/\{\{groupName\}\}/g, chitName);

  msg = msg.replace(/{CHIT_MONTH}/g, String(chitMonthInfo.currentMonth));
  msg = msg.replace(/\{\{chitMonth\}\}/g, String(chitMonthInfo.currentMonth));
  msg = msg.replace(/{chitMonth}/g, String(chitMonthInfo.currentMonth));
  msg = msg.replace(/\{\{chit_month\}\}/g, String(chitMonthInfo.currentMonth));

  msg = msg.replace(/{CHIT_AMOUNT}/g, cAmt.toLocaleString('en-IN'));
  msg = msg.replace(/\{\{chitAmount\}\}/g, cAmt.toLocaleString('en-IN'));
  msg = msg.replace(/{MONTHLY_AMOUNT}/g, cAmt.toLocaleString('en-IN'));

  msg = msg.replace(/{PENDING_AMOUNT}/g, pAmt.toLocaleString('en-IN'));
  msg = msg.replace(/\{\{pendingAmount\}\}/g, pAmt.toLocaleString('en-IN'));

  msg = msg.replace(/{BALANCE_AMOUNT}/g, bAmt.toLocaleString('en-IN'));
  msg = msg.replace(/\{\{balanceAmount\}\}/g, bAmt.toLocaleString('en-IN'));

  msg = msg.replace(/{TOTAL_AMOUNT}/g, totAmt.toLocaleString('en-IN'));
  msg = msg.replace(/\{\{totalAmount\}\}/g, totAmt.toLocaleString('en-IN'));

  msg = msg.replace(/{FINAL_AMOUNT}/g, finAmt.toLocaleString('en-IN'));
  msg = msg.replace(/\{\{finalAmount\}\}/g, finAmt.toLocaleString('en-IN'));
  msg = msg.replace(/{AMOUNT_TO_PAY}/g, finAmt.toLocaleString('en-IN'));
  msg = msg.replace(/\{\{amountToPay\}\}/g, finAmt.toLocaleString('en-IN'));

  msg = msg.replace(/{DUE_DATE}/g, dueDate);
  msg = msg.replace(/\{\{dueDate\}\}/g, dueDate);
  msg = msg.replace(/\{\{billingMonth\}\}/g, billingMonth);
  msg = msg.replace(/{BILLING_MONTH}/g, billingMonth);

  return msg;
}

// ─── WhatsApp Web Deep Link Builder ───────────────────────────────────────────
export function buildWhatsAppUrl(phone, message) {
  const norm = normalizePhone(phone);
  if (!norm) {
    throw new Error('This member does not have a valid WhatsApp phone number.');
  }
  if (!message || !String(message).trim()) {
    throw new Error('Please enter a message content before sending.');
  }
  return `https://wa.me/${norm}?text=${encodeURIComponent(String(message).trim())}`;
}

export function openWhatsApp(phone, message) {
  const url = buildWhatsAppUrl(phone, message);
  window.open(url, '_blank', 'noopener,noreferrer');
  return url;
}

// ─── Message History Service (Dedicated 'messageHistory' Collection) ──────────
export async function createMessageHistoryDoc({
  member,
  phone,
  channel = 'WHATSAPP',
  message,
  status = 'SENT',
  groupId = 'I',
  billingMonth = 'August 2026',
  chitAmount = 25000,
  pendingAmount = 0,
  balanceAmount = 0,
  totalAmount = 25000,
  finalAmount = 25000,
  isTest = false,
}) {
  try {
    const norm = normalizePhone(phone || member?.whatsapp || member?.phone);
    const historyRef = collection(db, 'messageHistory');

    const docData = {
      recipientId: member?.id || 'unknown',
      recipientName: member?.name || 'Member',
      phone: norm || phone || 'N/A',
      channel,
      message,
      status: status || 'SENT',
      source: 'ADMIN',
      groupId: groupId || 'I',
      billingMonth: billingMonth || 'August 2026',
      chitAmount: Number(chitAmount || 0),
      pendingAmount: Number(pendingAmount || 0),
      balanceAmount: Number(balanceAmount || 0),
      totalAmount: Number(totalAmount || 0),
      finalAmount: Number(finalAmount || 0),
      isTest: Boolean(isTest),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const docRef = await addDoc(historyRef, docData);
    return { success: true, id: docRef.id };
  } catch (err) {
    console.error('[MessagingService] Failed to write to messageHistory:', err);
    return { success: false, error: err.message };
  }
}

export async function fetchMessageHistory({ statusFilter = 'all', limitCount = 50 } = {}) {
  try {
    const historyRef = collection(db, 'messageHistory');
    let q;

    if (statusFilter !== 'all') {
      q = query(historyRef, where('status', '==', statusFilter), orderBy('createdAt', 'desc'), limit(limitCount));
    } else {
      q = query(historyRef, orderBy('createdAt', 'desc'), limit(limitCount));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : new Date().toISOString(),
      };
    });
  } catch (err) {
    console.warn('[MessagingService] fetchMessageHistory error (falling back to plain query):', err.message);
    try {
      const historyRef = collection(db, 'messageHistory');
      const snapshot = await getDocs(query(historyRef, limit(limitCount)));
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: new Date().toISOString(),
      }));
    } catch (_) {
      return [];
    }
  }
}
