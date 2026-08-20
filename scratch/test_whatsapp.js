import {
  normalizeWhatsAppNumber,
  buildWhatsAppUrl,
} from '../src/services/whatsappService.js';

console.log('--- TESTING PHONE NUMBER NORMALIZATION ---');

const testCases = [
  { input: '8125737275', expected: '918125737275' },
  { input: '+91 81257 37275', expected: '918125737275' },
  { input: '+918125737275', expected: '918125737275' },
  { input: '08125737275', expected: '918125737275' },
  { input: '7674937363', expected: '917674937363' },
  { input: '', expected: null },
  { input: null, expected: null },
];

let allPassed = true;

for (const tc of testCases) {
  const result = normalizeWhatsAppNumber(tc.input);
  const pass = result === tc.expected;
  if (!pass) allPassed = false;
  console.log(
    `${pass ? '✅ PASS' : '❌ FAIL'}: Input "${tc.input}" => Result "${result}" (Expected "${tc.expected}")`
  );
}

console.log('\n--- TESTING DEEP LINK GENERATION FOR AHMAD ---');
const ahmadMsg = `Hello Ahmad 👋\n\nThis is a test message from Raghavendra Chitts.\n\nYour WhatsApp messaging connection is ready.`;
const url = buildWhatsAppUrl('8125737275', ahmadMsg);
console.log('Generated URL:', url);

const expectedUrl = `https://wa.me/918125737275?text=${encodeURIComponent(ahmadMsg)}`;
if (url === expectedUrl) {
  console.log('✅ URL Match PASS!');
} else {
  console.log('❌ URL Match FAIL!');
  allPassed = false;
}

if (allPassed) {
  console.log('\n🎉 ALL WHATSAPP WEB TESTS PASSED SUCCESSFULLY!');
} else {
  console.error('\n❌ SOME TESTS FAILED.');
  process.exit(1);
}
