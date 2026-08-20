function normalizePhone(phone) {
  if (!phone) return null;
  const clean = String(phone).replace(/\D/g, '');
  if (!clean) return null;
  if (clean.length === 10) return `91${clean}`;
  if (clean.length === 12 && clean.startsWith('91')) return clean;
  if (clean.length === 11 && clean.startsWith('0')) return `91${clean.slice(1)}`;
  if (clean.length >= 10 && clean.length <= 15) return clean;
  return null;
}

function generatePersonalizedMessage(member, templateText, { groupId = 'I', billingMonth = 'August 2026', groupPendingAmount = '25000', dueDate = '15th of Month' } = {}) {
  if (!member) return '';
  const memberName = member.name || 'Member';
  const chitName = `Group ${groupId}`;
  const pendingVal = Number(groupPendingAmount || 0);

  let msg = templateText;
  msg = msg.replace(/{MEMBER_NAME}/g, memberName);
  msg = msg.replace(/{CHIT_NAME}/g, chitName);
  msg = msg.replace(/{PENDING_AMOUNT}/g, Number(pendingVal).toLocaleString('en-IN'));
  msg = msg.replace(/{DUE_DATE}/g, dueDate);
  return msg;
}

const template = `Hello {MEMBER_NAME},

This is a reminder from Raghavendra Chitts regarding your monthly chit payment.

Chit: {CHIT_NAME}
Pending Amount: ₹{PENDING_AMOUNT}
Due Date: {DUE_DATE}

Thank you,
Raghavendra Chitts`;

const ahmad = { name: 'Ahmad', phone: '8125737275' };
const sandeep = { name: 'Sandeep', phone: '7674937363' };

const ahmadNorm = normalizePhone(ahmad.phone);
const sandeepNorm = normalizePhone(sandeep.phone);

const ahmadMsg = generatePersonalizedMessage(ahmad, template, { groupId: 'I', groupPendingAmount: '25000', dueDate: '15th of Month' });
const sandeepMsg = generatePersonalizedMessage(sandeep, template, { groupId: 'II', groupPendingAmount: '50000', dueDate: '20th of Month' });

console.log('Ahmad Phone:', ahmadNorm);
console.log('Ahmad Msg:\n' + ahmadMsg);

console.log('\nSandeep Phone:', sandeepNorm);
console.log('Sandeep Msg:\n' + sandeepMsg);

if (ahmadNorm === '918125737275' && sandeepNorm === '917674937363' && ahmadMsg.includes('Hello Ahmad') && sandeepMsg.includes('Hello Sandeep')) {
  console.log('\n🎉 ALL REBUILT MESSAGING MODULE TESTS PASSED!');
} else {
  console.error('\n❌ FAIL');
  process.exit(1);
}
