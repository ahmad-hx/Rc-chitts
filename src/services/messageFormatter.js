import { calculateMemberPayableAmount } from './upiService';

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
