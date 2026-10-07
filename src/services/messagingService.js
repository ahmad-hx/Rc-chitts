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
import { memberService, whatsappTemplateService } from './dbService.js';
import { formatCurrency, formatLockedWhatsAppMessage, formatWhatsAppTemplate } from './messageFormatter.js';
import { getEffectiveMonthlyAmount } from '../utils/amountUtils.js';
import { getChitMonthForGroup } from '../utils/chitMonthUtils.js';

export async function fetchSavedMessageTemplates() {
  try {
    const saved = await whatsappTemplateService.getWhatsAppTemplates();
    return saved || {};
  } catch (err) {
    console.warn('[MessagingService] fetchSavedMessageTemplates notice:', err.message);
    return {};
  }
}

export async function saveMessageTemplate(templateData) {
  return whatsappTemplateService.saveWhatsAppTemplate(templateData);
}

// ─── Default Message Templates ────────────────────────────────────────────────
export const MESSAGE_TEMPLATES = {
  PAYMENT_REMINDER: {
    id: 'PAYMENT_REMINDER',
    title: 'Payment Reminder',
    englishText: `{{memberName}} గారు

ఈనెల చీటీ {{chitMonth}}      {{monthlyAmount}}
పాత బాకీ             {{pendingAmount}}
నిల్వ                   {{balanceCredit}}

మొత్తం               {{finalPayable}}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`,
    teluguText: `{{memberName}} గారు

ఈనెల చీటీ {{chitMonth}}      {{monthlyAmount}}
పాత బాకీ             {{pendingAmount}}
నిల్వ                   {{balanceCredit}}

మొత్తం               {{finalPayable}}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`,
  },
  PENDING_PAYMENT: {
    id: 'PENDING_PAYMENT',
    title: 'Pending Payment Warning',
    englishText: `{{memberName}} గారు

ఈనెల చీటీ {{chitMonth}}      {{monthlyAmount}}
పాత బాకీ             {{pendingAmount}}
నిల్వ                   {{balanceCredit}}

మొత్తం               {{finalPayable}}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`,
    teluguText: `{{memberName}} గారు

ఈనెల చీటీ {{chitMonth}}      {{monthlyAmount}}
పాత బాకీ             {{pendingAmount}}
నిల్వ                   {{balanceCredit}}

మొత్తం               {{finalPayable}}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`,
  },
  CUSTOM: {
    id: 'CUSTOM',
    title: 'Custom Message',
    englishText: `{{memberName}} గారు

ఈనెల చీటీ {{chitMonth}}      {{monthlyAmount}}
పాత బాకీ             {{pendingAmount}}
నిల్వ                   {{balanceCredit}}

మొత్తం               {{finalPayable}}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`,
    teluguText: `{{memberName}} గారు

ఈనెల చీటీ {{chitMonth}}      {{monthlyAmount}}
పాత బాకీ             {{pendingAmount}}
నిల్వ                   {{balanceCredit}}

మొత్తం               {{finalPayable}}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`,
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
      const gf = String(groupFilter).toLowerCase().trim();
      const hasGroupInChits = activeChits.some((c) => {
        const cGrp = String(c.groupId || c.group || '').toLowerCase().trim();
        const cVal = Number(c.totalChitValue || c.chitValue || c.totalValue || 0);
        const cId = String(c.id || '').toLowerCase().trim();

        if (gf.includes('_') || gf.startsWith('group_')) {
          const cleanGf = gf.replace(/^group_/, '');
          const parts = cleanGf.split('_');
          const targetGId = parts[0];
          const targetVal = Number(parts[1] || 0);
          const matchId = cId === gf || cId === `group_${cleanGf}`;
          const matchParts = cGrp === targetGId && (targetVal > 0 ? cVal === targetVal : true);
          return matchId || matchParts;
        }
        return cGrp === gf || cId === gf;
      });
      const rootGroup = String(m.groupId || m.group || m.chitGroup || '').toLowerCase().trim();
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
    chitsList = [],
    allGroupsList = [],
    paymentsList = [],
    payments = [],
  } = {}
) {
  if (!member) return '';

  const groupsToUse = Array.isArray(allGroupsList) && allGroupsList.length > 0
    ? allGroupsList
    : (Array.isArray(chitsList) && chitsList.length > 0 ? chitsList : []);

  const pList = Array.isArray(paymentsList) && paymentsList.length > 0
    ? paymentsList
    : (Array.isArray(payments) && payments.length > 0 ? payments : []);

  // If custom template text is provided and contains placeholders or modifications
  if (templateText && typeof templateText === 'string' && templateText.trim()) {
    const activeChits = getActiveChits(member);
    const targetChit = activeChits[0] || (member?.groupId || member?.group || member?.chitGroup ? {
      groupId: member.groupId || member.group || member.chitGroup,
      totalChitValue: member.calculatedTotalChitValue || member.totalChitValue || 100000,
      pending: member.pending || 0,
      balance: member.balance || 0,
      quantity: 1,
    } : {});

    const chitMonthData = getChitMonthForGroup(targetChit, billingMonth, groupsToUse);
    const chitMonthStr = chitMonthData.display || `${chitMonthData.currentMonth || 1}/${chitMonthData.totalMonths || 20}`;

    const baseMonthly = getEffectiveMonthlyAmount(member, targetChit, groupPaymentSettings);
    const quantity = Number(targetChit.quantity || 1);
    const fullMonthlyAmount = baseMonthly * quantity;

    const resolvedChitAmt = chitAmount !== null && chitAmount !== undefined ? chitAmount : fullMonthlyAmount;
    const resolvedPending = pendingAmount !== null && pendingAmount !== undefined ? pendingAmount : Number(targetChit.pending ?? member.pending ?? 0);
    const resolvedBalance = balanceAmount !== null && balanceAmount !== undefined ? balanceAmount : Number(targetChit.balance ?? member.balance ?? 0);
    const resolvedTotal = totalAmount !== null && totalAmount !== undefined ? totalAmount : (Number(resolvedChitAmt) + Number(resolvedPending));
    const resolvedFinal = finalAmount !== null && finalAmount !== undefined ? finalAmount : Math.max(Number(resolvedTotal) - Number(resolvedBalance), 0);

    return formatWhatsAppTemplate({
      templateText,
      memberName: member.name || 'Member',
      phone: member.whatsapp || member.phone || '',
      groupName: targetChit.groupId || groupId || 'Chit Group',
      chitMonth: chitMonthStr,
      chitAmount: resolvedChitAmt,
      pendingAmount: resolvedPending,
      balanceAmount: resolvedBalance,
      totalAmount: resolvedTotal,
      finalAmount: resolvedFinal,
      billingMonth,
      dueDate,
    });
  }

  return formatLockedWhatsAppMessage(member, {
    groupPaymentSettings,
    billingMonth,
    dueDate,
    allGroupsList: groupsToUse,
    paymentsList: pList,
  });
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
