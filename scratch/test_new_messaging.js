import {
  normalizePhone,
  generatePersonalizedMessage,
  MESSAGE_TEMPLATES,
} from '../src/services/messagingService.js';

console.log('--- TESTING NEW MESSAGING SERVICE ---');

const p1 = normalizePhone('8125737275');
console.log('Phone 8125737275 ➔', p1);

const dummyMember = {
  name: 'Ahmad',
  phone: '8125737275',
  chits: [{ groupId: 'I', totalChitValue: 100000, pending: 25000, amountToPay: 5000 }],
};

const msg = generatePersonalizedMessage(dummyMember, MESSAGE_TEMPLATES.PAYMENT_REMINDER.englishText, {
  groupId: 'I',
  billingMonth: 'August 2026',
  groupPendingAmount: '25000',
  dueDate: '15th of Month',
});

console.log('\n--- COMPILED PERSONALIZED MESSAGE ---');
console.log(msg);

if (p1 === '918125737275' && msg.includes('Hello Ahmad') && msg.includes('25,000')) {
  console.log('\n🎉 NEW MESSAGING SERVICE VERIFICATION PASS!');
} else {
  console.error('\n❌ VERIFICATION FAIL');
  process.exit(1);
}
