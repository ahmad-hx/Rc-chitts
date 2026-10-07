import { calculateMemberPayableAmount } from './upiService.js';
import { getChitMonthForGroup } from '../utils/chitMonthUtils.js';

export const DEFAULT_ENGLISH_TEMPLATE = `Hello {{memberName}},

This is a payment reminder from Raghavendra Chitts.

Chit Group: {{groupName}}
Chit Month: {{chitMonth}}
Billing Month: {{billingMonth}}
Due Date: {{dueDate}}

Monthly Chit Amount: ₹{{chitAmount}}
Pending Amount: ₹{{pendingAmount}}
Balance Credit: ₹{{balanceAmount}}
----------------------------------------
Final Payable Amount: ₹{{finalAmount}}

Please make your payment at your earliest convenience.

Thank you,
Raghavendra Chitts`;

export const DEFAULT_TELUGU_TEMPLATE = `{{memberName}} గారు

ఈనెల చీటీ {{chitMonth}}      {{monthlyAmount}}
పాత బాకీ             {{pendingAmount}}
నిల్వ                   {{balanceCredit}}

మొత్తం               {{finalPayable}}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`;

/**
 * Unified Currency Formatter — Prevents duplicate ₹ symbols (never outputs ₹₹1,00,000)
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '₹0';
  const str = String(value).trim();
  const cleanStr = str.replace(/^₹+/, '').trim();
  const num = Number(cleanStr.replace(/,/g, ''));
  if (isNaN(num)) return '₹0';
  return `₹${num.toLocaleString('en-IN')}`;
}

export function formatRawNumber(value) {
  if (value === null || value === undefined || value === '') return '0';
  const str = String(value).trim();
  const cleanStr = str.replace(/^₹+/, '').trim();
  const num = Number(cleanStr.replace(/,/g, ''));
  if (isNaN(num)) return '0';
  return num.toLocaleString('en-IN');
}

/**
 * Unified Phone Number Normalization & Display Formatter
 */
export function normalizeApiPhoneNumber(value = '') {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  if (!digits) return '';

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `91${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits;
  }
  return digits;
}

export function formatDisplayPhoneNumber(value = '') {
  if (!value) return 'N/A';
  const clean = String(value).trim();
  if (clean.startsWith('+')) {
    return clean;
  }

  const digits = clean.replace(/\D/g, '');
  if (!digits) return value;

  if (digits.length === 10 && /^[6-9]/.test(digits)) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    const main = digits.slice(1);
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    const main = digits.slice(2);
    return `+91 ${main.slice(0, 5)} ${main.slice(5)}`;
  }
  return `+${digits}`;
}

/**
 * Replace placeholders dynamically in custom WhatsApp templates.
 */
export function formatWhatsAppTemplate({
  templateText = '',
  memberName = 'Member',
  phone = '',
  groupName = 'Chit Group',
  chitMonth = '1',
  chitAmount = '0',
  pendingAmount = '0',
  balanceAmount = '0',
  totalAmount = '0',
  finalAmount = '0',
  billingMonth = 'August 2026',
  dueDate = '15th of Month',
  upiUrl = null,
}) {
  if (!templateText) return '';

  const cleanChitAmt = formatRawNumber(chitAmount);
  const cleanPendingAmt = formatRawNumber(pendingAmount);
  const cleanBalanceAmt = formatRawNumber(balanceAmount);
  const cleanTotalAmt = formatRawNumber(totalAmount);
  const cleanFinalAmt = formatRawNumber(finalAmount);
  const formattedPhone = formatDisplayPhoneNumber(phone);

  let compiled = templateText
    .replace(/\{\{memberName\}\}/g, memberName || 'Member')
    .replace(/\{MEMBER_NAME\}/g, memberName || 'Member')
    .replace(/\{\{phone\}\}/g, formattedPhone || '')
    .replace(/\{\{groupName\}\}/g, groupName || 'Chit Group')
    .replace(/\{CHIT_NAME\}/g, groupName || 'Chit Group')
    .replace(/\{\{chitMonth\}\}/g, String(chitMonth || '1'))
    .replace(/\{CHIT_MONTH\}/g, String(chitMonth || '1'))
    .replace(/\{\{chit_month\}\}/g, String(chitMonth || '1'))
    .replace(/\{chitMonth\}/g, String(chitMonth || '1'))
    .replace(/\{\{chitAmount\}\}/g, cleanChitAmt)
    .replace(/\{CHIT_AMOUNT\}/g, cleanChitAmt)
    .replace(/\{MONTHLY_AMOUNT\}/g, cleanChitAmt)
    .replace(/\{\{monthlyAmount\}\}/g, cleanChitAmt)
    .replace(/\{\{pendingAmount\}\}/g, cleanPendingAmt)
    .replace(/\{PENDING_AMOUNT\}/g, cleanPendingAmt)
    .replace(/\{\{balanceAmount\}\}/g, cleanBalanceAmt)
    .replace(/\{BALANCE_AMOUNT\}/g, cleanBalanceAmt)
    .replace(/\{\{balanceCredit\}\}/g, cleanBalanceAmt)
    .replace(/\{\{totalAmount\}\}/g, cleanTotalAmt)
    .replace(/\{TOTAL_AMOUNT\}/g, cleanTotalAmt)
    .replace(/\{\{finalAmount\}\}/g, cleanFinalAmt)
    .replace(/\{FINAL_AMOUNT\}/g, cleanFinalAmt)
    .replace(/\{\{finalPayable\}\}/g, cleanFinalAmt)
    .replace(/\{\{amountToPay\}\}/g, cleanFinalAmt)
    .replace(/\{AMOUNT_TO_PAY\}/g, cleanFinalAmt)
    .replace(/\{\{billingMonth\}\}/g, billingMonth || 'August 2026')
    .replace(/\{BILLING_MONTH\}/g, billingMonth || 'August 2026')
    .replace(/\{\{dueDate\}\}/g, dueDate || '15th of Month')
    .replace(/\{DUE_DATE\}/g, dueDate || '15th of Month');

  // Strip any accidental double currency symbols
  compiled = compiled.replace(/₹₹+/g, '₹');

  if (upiUrl && upiUrl.trim()) {
    compiled += `\n\nPayment Link (UPI):\n${upiUrl.trim()}`;
  }

  return compiled;
}

import { getEffectiveMonthlyAmount } from '../utils/amountUtils.js';
import { getActiveChits } from './messagingService.js';

export function getPaidAmountForChit(member, chit, billingMonth, paymentsList = []) {
  if (!member || !paymentsList || !Array.isArray(paymentsList) || paymentsList.length === 0) {
    return 0;
  }
  const activeChits = getActiveChits(member);
  const isMultiChit = activeChits.length > 1;
  const gId = String(chit?.groupId || member?.groupId || member?.group || 'I').trim();
  const mPhoneClean = (member.phone || member.whatsapp || '').replace(/\D/g, '');
  const mNameClean = (member.name || '').trim().toLowerCase();
  const cleanGroupStr = gId.replace(/^GROUP\s+/i, '').toUpperCase();

  let paidSum = 0;
  paymentsList.forEach((p) => {
    const pStatus = String(p.status || 'cleared').toLowerCase();
    if (pStatus === 'failed' || pStatus === 'cancelled') return;

    let pMonth = p.billingMonth;
    if (!pMonth && p.date) {
      try {
        const d = new Date(p.date);
        if (!isNaN(d.getTime())) pMonth = d.toLocaleString('en-US', { month: 'long', year: 'numeric' });
      } catch (_) {}
    }
    if (pMonth && String(pMonth).trim().toLowerCase() !== String(billingMonth).trim().toLowerCase()) {
      return;
    }

    const isMemMatch =
      (p.memberId && p.memberId === member.id) ||
      (mPhoneClean && p.phone && p.phone.replace(/\D/g, '').endsWith(mPhoneClean)) ||
      (mNameClean && (p.member || p.memberName) && (p.member || p.memberName).trim().toLowerCase() === mNameClean);

    if (!isMemMatch) return;

    const pGrp = String(p.group || p.groupId || p.chitGroup || '').trim().toUpperCase().replace(/^GROUP\s+/, '');
    let isGrpMatch = false;
    if (!isMultiChit) {
      isGrpMatch = true;
    } else {
      if (p.chitId && (p.chitId === chit.id || p.chitId === chit.groupId)) {
        isGrpMatch = true;
      } else if (pGrp && pGrp !== 'ALL') {
        isGrpMatch = (cleanGroupStr === pGrp || cleanGroupStr.includes(pGrp) || pGrp.includes(cleanGroupStr));
      } else {
        isGrpMatch = (cleanGroupStr === String(member.groupId || member.group || 'I').replace(/^GROUP\s+/i, '').toUpperCase());
      }
    }

    if (isGrpMatch) {
      paidSum += Number(p.amount || 0);
    }
  });

  return paidSum;
}

export function formatLockedWhatsAppMessage(
  member,
  {
    groupPaymentSettings = {},
    billingMonth = 'August 2026',
    dueDate = '15th of Month',
    allGroupsList = [],
    paymentsList = [],
  } = {}
) {
  if (!member) return '';

  const activeChits = getActiveChits(member);
  const memberName = (member.name || 'Member').trim();
  const isMulti = activeChits.length > 1;

  if (!isMulti) {
    const targetChit = activeChits[0] || (member?.groupId || member?.group || member?.chitGroup ? {
      groupId: member.groupId || member.group || member.chitGroup,
      totalChitValue: member.calculatedTotalChitValue || member.totalChitValue || 100000,
      pending: member.pending || 0,
      balance: member.balance || 0,
      quantity: 1,
    } : {});

    const chitMonthData = getChitMonthForGroup(targetChit, billingMonth, allGroupsList);
    const chitMonthStr = chitMonthData.display || `${chitMonthData.currentMonth || 1}/${chitMonthData.totalMonths || 20}`;

    const baseMonthly = getEffectiveMonthlyAmount(member, targetChit, groupPaymentSettings);
    const quantity = Number(targetChit.quantity || 1);
    const fullMonthlyAmount = baseMonthly * quantity;
    const paidSoFar = getPaidAmountForChit(member, targetChit, billingMonth, paymentsList);
    const remainingMonthly = Math.max(fullMonthlyAmount - paidSoFar, 0);

    const pendingAmount = Number(targetChit.pending ?? member.pending ?? 0);
    const balanceCredit = Number(targetChit.balance ?? member.balance ?? 0);
    const finalPayable = Math.max(remainingMonthly + pendingAmount - balanceCredit, 0);

    const formattedBalance = balanceCredit === 0 ? '00' : balanceCredit;

    return `${memberName} గారు

ఈనెల చీటీ ${chitMonthStr}      ${remainingMonthly}
పాత బాకీ             ${pendingAmount}
నిల్వ                   ${formattedBalance}

మొత్తం               ${finalPayable}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`;
  }

  // Multi Chit Format
  let totalMonthlySum = 0;
  let totalPendingSum = 0;
  let totalBalanceSum = 0;

  const chitLines = activeChits.map((c) => {
    const chitMonthData = getChitMonthForGroup(c, billingMonth, allGroupsList);
    const chitMonthStr = chitMonthData.display || `${chitMonthData.currentMonth || 1}/${chitMonthData.totalMonths || 20}`;

    const baseMonthly = getEffectiveMonthlyAmount(member, c, groupPaymentSettings);
    const quantity = Number(c.quantity || 1);
    const fullMonthlyAmount = baseMonthly * quantity;
    const paidSoFar = getPaidAmountForChit(member, c, billingMonth, paymentsList);
    const remainingMonthly = Math.max(fullMonthlyAmount - paidSoFar, 0);

    const cPending = Number(c.pending || 0);
    const cBalance = Number(c.balance || 0);

    totalMonthlySum += remainingMonthly;
    totalPendingSum += cPending;
    totalBalanceSum += cBalance;

    return `${chitMonthStr} : ${formatRawNumber(remainingMonthly)}`;
  });

  if (totalPendingSum === 0 && member.pending) {
    totalPendingSum = Number(member.pending || 0);
  }
  if (totalBalanceSum === 0 && member.balance) {
    totalBalanceSum = Number(member.balance || 0);
  }

  const combinedFinalPayable = Math.max(totalMonthlySum + totalPendingSum - totalBalanceSum, 0);
  const chitLinesText = chitLines.join('\n');

  return `${memberName} గారు

${chitLinesText}

పాత బాకీ : ${formatRawNumber(totalPendingSum)}
నిల్వ     : ${formatRawNumber(totalBalanceSum)}

మొత్తం    : ₹${formatRawNumber(combinedFinalPayable)}

ఈనెల మీ వాయిదా మొత్తాన్ని 15వ తారీకు లోపు
తప్పనిసరిగా చెల్లించవలెను

ఇట్లు
రాఘవేంద్ర చిట్టి`;
}

export function getBilingualWhatsAppMessage(
  member,
  groupPaymentSettings = {},
  billingMonth = 'August 2026',
  dueDate = '15th of Month',
  allGroupsList = [],
  paymentsList = []
) {
  return formatLockedWhatsAppMessage(member, { groupPaymentSettings, billingMonth, dueDate, allGroupsList, paymentsList });
}



