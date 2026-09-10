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

export const DEFAULT_TELUGU_TEMPLATE = `నమస్కారం {{memberName}} గారు,

రాఘవేంద్ర చిట్స్ నుండి చెల్లింపు రిమైండర్.

చిట్టీ గ్రూప్: {{groupName}}
చిట్టీ నెల: {{chitMonth}}
బిల్లింగ్ నెల: {{billingMonth}}
గడువు తేదీ: {{dueDate}}

నెలవారీ చిట్టీ మొత్తం: ₹{{chitAmount}}
బాకీ ఉన్న మొత్తం: ₹{{pendingAmount}}
బ్యాలెన్స్ క్రెడిట్: ₹{{balanceAmount}}
----------------------------------------
ఫైనల్ చెల్లించాల్సిన మొత్తం: ₹{{finalAmount}}

దయచేసి మీ చెల్లింపును త్వరగా పూర్తి చేయండి.

ధన్యవాదములు,
రాఘవేంద్ర చిట్స్`;

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
 * Supported variables: {{memberName}}, {{phone}}, {{groupName}}, {{chitMonth}}, {{chitAmount}}, {{pendingAmount}}, {{balanceAmount}}, {{totalAmount}}, {{finalAmount}}, {{billingMonth}}, {{dueDate}}
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
    .replace(/\{\{pendingAmount\}\}/g, cleanPendingAmt)
    .replace(/\{PENDING_AMOUNT\}/g, cleanPendingAmt)
    .replace(/\{\{balanceAmount\}\}/g, cleanBalanceAmt)
    .replace(/\{BALANCE_AMOUNT\}/g, cleanBalanceAmt)
    .replace(/\{\{totalAmount\}\}/g, cleanTotalAmt)
    .replace(/\{TOTAL_AMOUNT\}/g, cleanTotalAmt)
    .replace(/\{\{finalAmount\}\}/g, cleanFinalAmt)
    .replace(/\{FINAL_AMOUNT\}/g, cleanFinalAmt)
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

export function getBilingualWhatsAppMessage(member, groupPaymentSettings = {}, billingMonth = 'August 2026', dueDate = '15th of Month', allGroupsList = []) {
  if (!member) return '';
  const activeChits = getActiveChits(member);
  const memberName = member.name || 'Member';
  const isMulti = activeChits.length > 1;

  // ── 1. SINGLE CHIT MEMBER (Exactly 1 active chit or single holding) ──
  if (!isMulti) {
    const targetChit = activeChits[0] || (member?.groupId || member?.group || member?.chitGroup ? {
      groupId: member.groupId || member.group || member.chitGroup,
      totalChitValue: member.calculatedTotalChitValue || member.totalChitValue || 100000,
      pending: member.pending || 0,
      balance: member.balance || 0,
      quantity: 1,
    } : {});

    const val = Number(targetChit.totalChitValue || member.calculatedTotalChitValue || member.totalChitValue || 100000);
    const grp = targetChit.groupId || targetChit.group || member.groupId || member.group || member.chitGroup || 'I';
    const chitGroupName = targetChit.name || (val >= 100000 ? `₹${(val / 100000).toFixed(0)} Lakh Group ${grp}` : `Group ${grp}`);
    const teluguChitGroupName = chitGroupName.replace(/Chit/g, 'చిట్టీ').replace(/Group/g, 'గ్రూప్');

    const chitMonthData = getChitMonthForGroup(targetChit, billingMonth, allGroupsList);
    const chitMonthStr = chitMonthData.display || `${chitMonthData.currentMonth}/${chitMonthData.totalMonths || 20}`;

    const baseMonthly = getEffectiveMonthlyAmount(member, targetChit, groupPaymentSettings);
    const quantity = Number(targetChit.quantity || 1);
    const monthlyAmount = baseMonthly * quantity;
    const pending = Number(targetChit.pending ?? member.pending ?? 0);
    const balance = Number(targetChit.balance ?? member.balance ?? 0);
    const finalPayable = Math.max(monthlyAmount + pending - balance, 0);

    const englishMessage = `Hello ${memberName},

This is a payment reminder from Raghavendra Chitts.

Chit Group: ${chitGroupName}
Chit Month: ${chitMonthStr}
Billing Month: ${billingMonth}
Due Date: ${dueDate}

Monthly Chit Amount: ₹${monthlyAmount.toLocaleString('en-IN')}
Pending Amount: ₹${pending.toLocaleString('en-IN')}
Balance Credit: ₹${balance.toLocaleString('en-IN')}
----------------------------------------
Final Payable Amount: ₹${finalPayable.toLocaleString('en-IN')}

Please make your payment at your earliest convenience.

Thank you,
Raghavendra Chitts`;

    const teluguMessage = `నమస్కారం ${memberName} గారు,

రాఘవేంద్ర చిట్స్ నుండి చెల్లింపు రిమైండర్.

చిట్టీ గ్రూప్: ${teluguChitGroupName}
చిట్టీ నెల: ${chitMonthStr}
బిల్లింగ్ నెల: ${billingMonth}
గడువు తేదీ: ${dueDate}

నెలవారీ చిట్టీ మొత్తం: ₹${monthlyAmount.toLocaleString('en-IN')}
బాకీ ఉన్న మొత్తం: ₹${pending.toLocaleString('en-IN')}
బ్యాలెన్స్ క్రెడిట్: ₹${balance.toLocaleString('en-IN')}
----------------------------------------
ఫైనల్ చెల్లించాల్సిన మొత్తం: ₹${finalPayable.toLocaleString('en-IN')}

దయచేసి మీ చెల్లింపును త్వరగా పూర్తి చేయండి.

ధన్యవాదములు,
రాఘవేంద్ర చిట్స్`;

    return `${englishMessage}\n\n-------------------\n\n${teluguMessage}`;
  }

  // ── 2. MULTI CHIT MEMBER (2+ active chits) ──
  const chitBreakdown = activeChits.map((c, idx) => {
    const val = Number(c.totalChitValue || c.chitValue || 100000);
    const grp = c.groupId || c.group || 'I';
    const baseMonthly = getEffectiveMonthlyAmount(member, c, groupPaymentSettings);
    const quantity = Number(c.quantity || 1);
    const monthlyAmount = baseMonthly * quantity;
    const cPending = Number(c.pending || 0);
    const cBalance = Number(c.balance || 0);
    const cPayable = Math.max(monthlyAmount + cPending - cBalance, 0);
    const chitMonthData = getChitMonthForGroup(c, billingMonth, allGroupsList);
    const chitMonthStr = chitMonthData.display || `${chitMonthData.currentMonth}/${chitMonthData.totalMonths || 20}`;

    const groupTitle = c.name && c.name.trim() ? c.name : (val >= 100000 ? `₹${(val / 100000).toFixed(0)} Lakh Group ${grp}` : `Group ${grp}`);
    const teluguGroupTitle = groupTitle.replace(/Chit/g, 'చిట్టీ').replace(/Group/g, 'గ్రూప్');

    return {
      index: idx + 1,
      groupTitle,
      teluguGroupTitle,
      chitMonthStr,
      monthlyAmount,
      pending: cPending,
      balance: cBalance,
      payableAmount: cPayable,
    };
  });

  const totalCombinedPayable = chitBreakdown.reduce((sum, item) => sum + item.payableAmount, 0);

  const englishBreakdownText = chitBreakdown
    .map((item) => {
      return `${item.index}. ${item.groupTitle}
   Chit Month: ${item.chitMonthStr}
   Billing Month: ${billingMonth}
   Due Date: ${dueDate}
   Monthly Amount: ₹${item.monthlyAmount.toLocaleString('en-IN')}
   Pending Amount: ₹${item.pending.toLocaleString('en-IN')}
   Balance Credit: ₹${item.balance.toLocaleString('en-IN')}
   Final Payable Amount: ₹${item.payableAmount.toLocaleString('en-IN')}`;
    })
    .join('\n\n');

  const teluguBreakdownText = chitBreakdown
    .map((item) => {
      return `${item.index}. ${item.teluguGroupTitle}
   చిట్టీ నెల: ${item.chitMonthStr}
   బిల్లింగ్ నెల: ${billingMonth}
   గడువు తేదీ: ${dueDate}
   నెలవారీ మొత్తం: ₹${item.monthlyAmount.toLocaleString('en-IN')}
   బాకీ ఉన్న మొత్తం: ₹${item.pending.toLocaleString('en-IN')}
   బ్యాలెన్స్ క్రెడిట్: ₹${item.balance.toLocaleString('en-IN')}
   ఫైనల్ చెల్లించాల్సిన మొత్తం: ₹${item.payableAmount.toLocaleString('en-IN')}`;
    })
    .join('\n\n');

  const englishMessage = `Hello ${memberName},

This is a payment reminder from Raghavendra Chitts.

Your Active Chits:

${englishBreakdownText}

────────────────────────────────────────
Total Combined Final Payable: ₹${totalCombinedPayable.toLocaleString('en-IN')}

Please make your payment at your earliest convenience.

Thank you,
Raghavendra Chitts`;

  const teluguMessage = `నమస్కారం ${memberName} గారు,

రాఘవేంద్ర చిట్స్ నుండి చెల్లింపు రిమైండర్.

మీ యాక్టివ్ చిట్టీల వివరాలు:

${teluguBreakdownText}

────────────────────────────────────────
మొత్తం కలిపి చెల్లించాల్సిన ఫైనల్ విలువ: ₹${totalCombinedPayable.toLocaleString('en-IN')}

దయచేసి మీ చెల్లింపును త్వరగా పూర్తి చేయండి.

ధన్యవాదములు,
రాఘవేంద్ర చిట్స్`;

  return englishMessage;
}


