import { calculateMemberPayableAmount } from './upiService.js';
import { getChitMonthForGroup } from '../utils/chitMonthUtils.js';

export const DEFAULT_ENGLISH_TEMPLATE = `Hello {{memberName}},

This is a payment reminder from Raghavendra Chitts.

Chit Group: {{groupName}}
Chit Month: {{chitMonth}}
Billing Month: {{billingMonth}}
Chit Amount: ₹{{chitAmount}}
Pending Amount: ₹{{pendingAmount}}
Due Date: {{dueDate}}

Please make the payment on time.

Thank you,
Raghavendra Chitts`;

export const DEFAULT_TELUGU_TEMPLATE = `నమస్కారం {{memberName}} గారు,

రాఘవేంద్ర చిట్స్ నుండి చెల్లింపు రిమైండర్.

చిట్టీ గ్రూప్: {{groupName}}
చిట్టీ నెల: {{chitMonth}}
బిల్లింగ్ నెల: {{billingMonth}}
చిట్టీ విలువ: ₹{{chitAmount}}
బాకీ మొత్తం: ₹{{pendingAmount}}
గడువు తేదీ: {{dueDate}}

దయచేసి సమయానికి చెల్లింపు పూర్తి చేయండి.

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
 * Supported variables: {{memberName}}, {{phone}}, {{groupName}}, {{chitMonth}}, {{chitAmount}}, {{pendingAmount}}, {{billingMonth}}, {{dueDate}}
 */
export function formatWhatsAppTemplate({
  templateText = '',
  memberName = 'Member',
  phone = '',
  groupName = 'Chit Group',
  chitMonth = '1',
  chitAmount = '1,00,000',
  pendingAmount = '0',
  billingMonth = 'August 2026',
  dueDate = '15th of Month',
  upiUrl = null,
}) {
  if (!templateText) return '';

  const cleanChitAmt = formatRawNumber(chitAmount);
  const cleanPendingAmt = formatRawNumber(pendingAmount);
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
    .replace(/\{\{chitAmount\}\}/g, cleanChitAmt)
    .replace(/\{CHIT_AMOUNT\}/g, cleanChitAmt)
    .replace(/\{\{pendingAmount\}\}/g, cleanPendingAmt)
    .replace(/\{PENDING_AMOUNT\}/g, cleanPendingAmt)
    .replace(/\{\{billingMonth\}\}/g, billingMonth || 'August 2026')
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

export function getBilingualWhatsAppMessage(member, groupPaymentSettings = {}, billingMonth = 'August 2026') {
  if (!member) return '';
  const totalAmountToPay = calculateMemberPayableAmount(member, groupPaymentSettings);
  const activeChits = (member?.chits || []).filter((c) => !c.status || c.status === 'ACTIVE');

  // English Section
  let englishMessage = `Hello ${member.name} Garu,\n\nYour Chit Payment Details:\n\n`;
  activeChits.forEach((chit, idx) => {
    const val = chit.totalChitValue || 100000;
    const grp = chit.groupId || 'I';
    const baseMonthly = getEffectiveMonthlyAmount(member, chit, groupPaymentSettings);
    const quantity = Number(chit.quantity || 1);
    const pending = Number(chit.pending || 0);
    const balance = Number(chit.balance || 0);
    const chitPayable = Math.max((baseMonthly * quantity) + pending - balance, 0);
    const chitMonthData = getChitMonthForGroup(chit, billingMonth, activeChits);

    const titlePrefix = activeChits.length > 1 ? `${idx + 1}. ` : '';
    englishMessage += `${titlePrefix}*${chit.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${grp})`}*\n`;
    englishMessage += `   Monthly Amount: ₹${baseMonthly.toLocaleString('en-IN')}\n`;
    englishMessage += `   Chit Month: ${chitMonthData.currentMonth}\n`;
    if (pending > 0) englishMessage += `   Pending Overdue: ₹${pending.toLocaleString('en-IN')}\n`;
    if (balance > 0) englishMessage += `   Balance Credit: ₹${balance.toLocaleString('en-IN')}\n`;
    if (pending > 0 || balance > 0) englishMessage += `   Payable Amount: ₹${chitPayable.toLocaleString('en-IN')}\n`;
    englishMessage += '\n';
  });

  englishMessage += `────────────────────────────────────────\nTotal Amount Payable: ₹${totalAmountToPay.toLocaleString('en-IN')}\n\nPlease make your payment on time.\n\nThank you,\nRaghavendra Chitts`;

  // Telugu Section
  let teluguMessage = `నమస్కారం ${member.name} గారు,\n\nమీ చిట్టీ చెల్లింపు వివరాలు:\n\n`;
  activeChits.forEach((chit, idx) => {
    const val = chit.totalChitValue || 100000;
    const grp = chit.groupId || 'I';
    const baseMonthly = getEffectiveMonthlyAmount(member, chit, groupPaymentSettings);
    const quantity = Number(chit.quantity || 1);
    const pending = Number(chit.pending || 0);
    const balance = Number(chit.balance || 0);
    const chitPayable = Math.max((baseMonthly * quantity) + pending - balance, 0);
    const chitMonthData = getChitMonthForGroup(chit, billingMonth, activeChits);

    const translatedName = (chit.name || `₹${(val / 100000).toFixed(0)} Lakh చిట్టీ (గ్రూప్ ${grp})`)
      .replace(/Chit/g, 'చిట్టీ')
      .replace(/Group/g, 'గ్రూప్');

    const titlePrefix = activeChits.length > 1 ? `${idx + 1}. ` : '';
    teluguMessage += `${titlePrefix}*${translatedName}*\n`;
    teluguMessage += `   నెలవారీ మొత్తం: ₹${baseMonthly.toLocaleString('en-IN')}\n`;
    teluguMessage += `   చిట్టీ నెల: ${chitMonthData.currentMonth}\n`;
    if (pending > 0) teluguMessage += `   పెండింగ్ బకాయి: ₹${pending.toLocaleString('en-IN')}\n`;
    if (balance > 0) teluguMessage += `   మిగిలిన బ్యాలెన్స్: ₹${balance.toLocaleString('en-IN')}\n`;
    if (pending > 0 || balance > 0) teluguMessage += `   చెల్లించాల్సిన మొత్తం: ₹${chitPayable.toLocaleString('en-IN')}\n`;
    teluguMessage += '\n';
  });

  teluguMessage += `────────────────────────────────────────\nమొత్తం చెల్లించాల్సిన విలువ: ₹${totalAmountToPay.toLocaleString('en-IN')}\n\nదయచేసి మీ చెల్లింపును సమయానికే పూర్తి చేయండి.\n\nధన్యవాదములు,\nరాఘవేంద్ర చిట్స్`;

  return `${englishMessage}\n-------------------\n\n${teluguMessage}`;
}


