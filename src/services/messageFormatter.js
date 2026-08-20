import { calculateMemberPayableAmount } from './upiService';

export const DEFAULT_ENGLISH_TEMPLATE = `Hello {{memberName}},

This is a payment reminder from Raghavendra Chitts.

Chit Group: {{groupName}}
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
 * Supported variables: {{memberName}}, {{phone}}, {{groupName}}, {{chitAmount}}, {{pendingAmount}}, {{billingMonth}}, {{dueDate}}
 */
export function formatWhatsAppTemplate({
  templateText = '',
  memberName = 'Member',
  phone = '',
  groupName = 'Chit Group',
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
    .replace(/\{\{phone\}\}/g, formattedPhone || '')
    .replace(/\{\{groupName\}\}/g, groupName || 'Chit Group')
    .replace(/\{\{chitAmount\}\}/g, cleanChitAmt)
    .replace(/\{\{pendingAmount\}\}/g, cleanPendingAmt)
    .replace(/\{\{billingMonth\}\}/g, billingMonth || 'August 2026')
    .replace(/\{\{dueDate\}\}/g, dueDate || '15th of Month');

  // Strip any accidental double currency symbols
  compiled = compiled.replace(/₹₹+/g, '₹');

  if (upiUrl && upiUrl.trim()) {
    compiled += `\n\nPayment Link (UPI):\n${upiUrl.trim()}`;
  }

  return compiled;
}


export function getBilingualWhatsAppMessage(member, groupPaymentSettings = {}) {
  if (!member) return '';
  const totalAmountToPay = calculateMemberPayableAmount(member, groupPaymentSettings);

  // English Section
  let englishMessage = `Hello ${member.name} Garu,\n\nYour Chit Payment Details:\n\n`;
  (member?.chits || []).forEach(chit => {
    const val = chit.totalChitValue || 100000;
    const grp = chit.groupId || 'I';
    const settingKey = `${val}_${grp}`;
    const baseMonthly = typeof groupPaymentSettings[settingKey] === 'number' && groupPaymentSettings[settingKey] > 0
      ? groupPaymentSettings[settingKey]
      : (chit.amountToPay || Math.floor(val / 20));
    const pending = Number(chit.pending || 0);
    const balance = Number(chit.balance || 0);
    const chitPayable = Math.max(baseMonthly + pending - balance, 0);

    englishMessage += `*${chit.name || `₹${(val / 100000).toFixed(0)} Lakh Chit (Group ${grp})`}*\n`;
    englishMessage += `Monthly Premium: ₹${baseMonthly.toLocaleString('en-IN')}\n`;
    if (pending > 0) englishMessage += `Pending: ₹${pending.toLocaleString('en-IN')}\n`;
    if (balance > 0) englishMessage += `Balance Credit: ₹${balance.toLocaleString('en-IN')}\n`;
    englishMessage += `Amount Due: ₹${chitPayable.toLocaleString('en-IN')}\n\n`;
  });

  englishMessage += `*Total Amount Due: ₹${totalAmountToPay.toLocaleString('en-IN')}*\n\nPlease make your payment on time.\n\nRaghavendra Chitts`;

  // Telugu Section
  let teluguMessage = `నమస్కారం ${member.name} గారు,\n\nమీ చిట్టీ చెల్లింపు వివరాలు:\n\n`;
  (member?.chits || []).forEach(chit => {
    const val = chit.totalChitValue || 100000;
    const grp = chit.groupId || 'I';
    const settingKey = `${val}_${grp}`;
    const baseMonthly = typeof groupPaymentSettings[settingKey] === 'number' && groupPaymentSettings[settingKey] > 0
      ? groupPaymentSettings[settingKey]
      : (chit.amountToPay || Math.floor(val / 20));
    const pending = Number(chit.pending || 0);
    const balance = Number(chit.balance || 0);
    const chitPayable = Math.max(baseMonthly + pending - balance, 0);

    const translatedName = (chit.name || 'చిట్టీ')
      .replace(/Chit/g, "చిట్టీ")
      .replace(/Group/g, "గ్రూప్");
    teluguMessage += `*${translatedName}*\n`;
    teluguMessage += `నెలవారీ వాయిదా: ₹${baseMonthly.toLocaleString('en-IN')}\n`;
    if (pending > 0) teluguMessage += `పెండింగ్: ₹${pending.toLocaleString('en-IN')}\n`;
    if (balance > 0) teluguMessage += `మిగిలిన బ్యాలెన్స్: ₹${balance.toLocaleString('en-IN')}\n`;
    teluguMessage += `చెల్లించాల్సిన మొత్తం: ₹${chitPayable.toLocaleString('en-IN')}\n\n`;
  });

  teluguMessage += `*మొత్తం చెల్లించాల్సిన విలువ: ₹${totalAmountToPay.toLocaleString('en-IN')}*\n\nదయచేసి మీ చెల్లింపును సమయానికే పూర్తి చేయండి.\n\nరాఘవేంద్ర చిట్స్`;

  return `${englishMessage}\n-------------------\n\n${teluguMessage}`;
}

