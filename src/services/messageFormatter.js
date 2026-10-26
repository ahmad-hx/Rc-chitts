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

/**
 * Replace placeholders dynamically in custom Multiple Chit WhatsApp templates.
 */
export function formatWhatsAppTemplateMulti({
  templateText = '',
  memberName = 'Member',
  phone = '',
  chitLinesText = '',
  chitMonth = '1',
  monthlyAmount = '0',
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

  const cleanMonthlyAmt = formatRawNumber(monthlyAmount || chitAmount);
  const cleanPendingAmt = formatRawNumber(pendingAmount);
  const cleanBalanceAmt = formatRawNumber(balanceAmount);
  const cleanTotalAmt = formatRawNumber(totalAmount);
  const cleanFinalAmt = formatRawNumber(finalAmount);
  const formattedPhone = formatDisplayPhoneNumber(phone);

  let compiled = templateText
    .replace(/\{\{memberName\}\}/g, memberName || 'Member')
    .replace(/\{MEMBER_NAME\}/g, memberName || 'Member')
    .replace(/\{\{phone\}\}/g, formattedPhone || '')
    .replace(/\{\{chitLines\}\}/g, chitLinesText || '')
    .replace(/\{CHIT_LINES\}/g, chitLinesText || '')
    .replace(/\{\{chitMonth\}\}/g, String(chitMonth || '1'))
    .replace(/\{CHIT_MONTH\}/g, String(chitMonth || '1'))
    .replace(/\{\{chit_month\}\}/g, String(chitMonth || '1'))
    .replace(/\{chitMonth\}/g, String(chitMonth || '1'))
    .replace(/\{\{monthlyAmount\}\}/g, cleanMonthlyAmt)
    .replace(/\{MONTHLY_AMOUNT\}/g, cleanMonthlyAmt)
    .replace(/\{\{chitAmount\}\}/g, cleanMonthlyAmt)
    .replace(/\{CHIT_AMOUNT\}/g, cleanMonthlyAmt)
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

  // If the template did not explicitly include {{chitLines}}, but chit lines exist, ensure they appear after greeting
  if (!templateText.includes('{{chitLines}}') && !templateText.includes('{CHIT_LINES}') && chitLinesText) {
    const greetingMatch = compiled.match(/^([^\n]+(?:గారు|Garu|Sir|Madam|ji)?)\n*/i);
    if (greetingMatch) {
      const greeting = greetingMatch[0];
      const rest = compiled.slice(greeting.length);
      compiled = `${greeting.trim()}\n\n${chitLinesText}\n\n${rest.trim()}`;
    } else {
      compiled = `${chitLinesText}\n\n${compiled}`;
    }
  }

  // Strip any accidental double currency symbols
  compiled = compiled.replace(/₹₹+/g, '₹');

  if (upiUrl && upiUrl.trim()) {
    compiled += `\n\nPayment Link (UPI):\n${upiUrl.trim()}`;
  }

  return compiled;
}

export function formatLockedWhatsAppMessage(
  member,
  {
    groupPaymentSettings = {},
    billingMonth = 'August 2026',
    dueDate = '15th of Month',
    allGroupsList = [],
    paymentsList = [],
    customTemplateText = null,
    chitMonth = null,
    monthlyAmount = null,
    pendingAmount = null,
    balanceAmount = null,
    totalAmount = null,
    finalAmount = null,
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
    const chitMonthStr = chitMonth || chitMonthData.display || `${chitMonthData.currentMonth || 1}/${chitMonthData.totalMonths || 20}`;

    const baseMonthly = monthlyAmount !== null && monthlyAmount !== undefined
      ? Number(monthlyAmount)
      : getEffectiveMonthlyAmount(member, targetChit, groupPaymentSettings);
    const quantity = Number(targetChit.quantity || 1);
    const fullMonthlyAmount = baseMonthly * quantity;
    const paidSoFar = getPaidAmountForChit(member, targetChit, billingMonth, paymentsList);
    const remainingMonthly = Math.max(fullMonthlyAmount - paidSoFar, 0);

    const calcPending = pendingAmount !== null && pendingAmount !== undefined
      ? Number(pendingAmount)
      : Number(targetChit.pending ?? member.pending ?? 0);
    const calcBalance = balanceAmount !== null && balanceAmount !== undefined
      ? Number(balanceAmount)
      : Number(targetChit.balance ?? member.balance ?? 0);
    const calcTotal = totalAmount !== null && totalAmount !== undefined
      ? Number(totalAmount)
      : (remainingMonthly + calcPending);
    const calcFinal = finalAmount !== null && finalAmount !== undefined
      ? Number(finalAmount)
      : Math.max(remainingMonthly + calcPending - calcBalance, 0);

    const formattedBalance = calcBalance === 0 ? '00' : calcBalance;

    if (customTemplateText && typeof customTemplateText === 'string' && customTemplateText.trim()) {
      return formatWhatsAppTemplate({
        templateText: customTemplateText,
        memberName,
        phone: member.whatsapp || member.phone || '',
        groupName: targetChit.groupId || 'Chit Group',
        chitMonth: chitMonthStr,
        chitAmount: remainingMonthly,
        pendingAmount: calcPending,
        balanceAmount: calcBalance,
        totalAmount: calcTotal,
        finalAmount: calcFinal,
        billingMonth,
        dueDate,
      });
    }

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
    const quantity = Number(c?.quantity || 1);
    const safeMonthly = isNaN(baseMonthly) || baseMonthly < 0 ? 0 : baseMonthly;
    const safeQty = isNaN(quantity) || quantity < 1 ? 1 : quantity;
    const fullMonthlyAmount = safeMonthly * safeQty;

    const paidSoFar = getPaidAmountForChit(member, c, billingMonth, paymentsList);
    const safePaid = isNaN(paidSoFar) || paidSoFar < 0 ? 0 : paidSoFar;
    const remainingMonthly = Math.max(fullMonthlyAmount - safePaid, 0);

    const cPending = Number(c?.pending || 0);
    const cBalance = Number(c?.balance || 0);
    const safePending = isNaN(cPending) || cPending < 0 ? 0 : cPending;
    const safeBalance = isNaN(cBalance) || cBalance < 0 ? 0 : cBalance;

    totalMonthlySum += remainingMonthly;
    totalPendingSum += safePending;
    totalBalanceSum += safeBalance;

    return `${chitMonthStr} : ${formatRawNumber(remainingMonthly)}`;
  });

  if (pendingAmount !== null && pendingAmount !== undefined) {
    totalPendingSum = Number(pendingAmount);
  } else if (totalPendingSum === 0 && member?.pending) {
    const mPending = Number(member.pending);
    if (!isNaN(mPending) && mPending > 0) totalPendingSum = mPending;
  }
  if (balanceAmount !== null && balanceAmount !== undefined) {
    totalBalanceSum = Number(balanceAmount);
  } else if (totalBalanceSum === 0 && member?.balance) {
    const mBalance = Number(member.balance);
    if (!isNaN(mBalance) && mBalance > 0) totalBalanceSum = mBalance;
  }

  const combinedTotal = totalAmount !== null && totalAmount !== undefined
    ? Number(totalAmount)
    : (totalMonthlySum + totalPendingSum);
  const combinedFinalPayable = finalAmount !== null && finalAmount !== undefined
    ? Number(finalAmount)
    : Math.max(totalMonthlySum + totalPendingSum - totalBalanceSum, 0);
  const chitLinesText = chitLines.join('\n');

  if (customTemplateText && typeof customTemplateText === 'string' && customTemplateText.trim()) {
    return formatWhatsAppTemplateMulti({
      templateText: customTemplateText,
      memberName,
      phone: member.whatsapp || member.phone || '',
      chitLinesText,
      chitMonth: chitMonth || billingMonth,
      monthlyAmount: totalMonthlySum,
      pendingAmount: totalPendingSum,
      balanceAmount: totalBalanceSum,
      totalAmount: combinedTotal,
      finalAmount: combinedFinalPayable,
      billingMonth,
      dueDate,
    });
  }

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



