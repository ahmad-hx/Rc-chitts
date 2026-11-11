import assert from 'assert';
import {
  normalizeGroupId,
  extractGroupDocInfo,
  isSubscriptionBelongingToGroup,
  findAssociatedGroupForSubscription,
  hasExplicitCustomMonthlyAmount,
  getEffectiveMonthlyAmount,
  calculateHoldingPayable,
  calculateMemberAggregatePayable,
} from './src/utils/amountUtils.js';
import {
  formatLockedWhatsAppMessage,
  formatRawNumber,
} from './src/services/messageFormatter.js';
import {
  generatePersonalizedMessage,
  DEFAULT_MULTIPLE_CHIT_TEMPLATE,
  DEFAULT_SINGLE_CHIT_TEMPLATE,
} from './src/services/messagingService.js';

console.log('--- STARTING COMPREHENSIVE TEST SUITE ---');

// ─── 1. Group ID Normalization Tests ─────────────────────────────────────────
console.log('Test 1: normalizeGroupId normalization');
assert.strictEqual(normalizeGroupId(''), '');
assert.strictEqual(normalizeGroupId(null), '');
assert.strictEqual(normalizeGroupId(undefined), '');
assert.strictEqual(normalizeGroupId('I'), 'I');
assert.strictEqual(normalizeGroupId('Group I'), 'I');
assert.strictEqual(normalizeGroupId('GROUP-II'), 'II');
assert.strictEqual(normalizeGroupId('group_III_200000'), 'III');
assert.strictEqual(normalizeGroupId('group_A_200000'), 'A');
assert.strictEqual(normalizeGroupId('1'), '1');
assert.strictEqual(normalizeGroupId('Group 2'), '2');
console.log('✓ Test 1 passed');

// ─── 2. Subscription to Group Membership (No False Substring Matches) ─────────
console.log('Test 2: isSubscriptionBelongingToGroup exact matching');
const subGroup1 = { groupId: 'I', totalChitValue: 100000, name: 'Group I (1 Lakh)' };
const subGroup2 = { groupId: 'II', totalChitValue: 100000, name: 'Group II (1 Lakh)' };
const subGroup1Val2 = { groupId: 'I', totalChitValue: 200000, name: 'Group I (2 Lakh)' };

// Sub Group 1 must belong to Group I 100000
assert.strictEqual(isSubscriptionBelongingToGroup(subGroup1, 'I', 100000), true);
// Sub Group 2 must NEVER belong to Group I (previously substring 'GROUP II'.includes('GROUP I') caused false match!)
assert.strictEqual(isSubscriptionBelongingToGroup(subGroup2, 'I', 100000), false);
// Sub Group 1 with 200000 must NOT match Group I with 100000
assert.strictEqual(isSubscriptionBelongingToGroup(subGroup1Val2, 'I', 100000), false);
assert.strictEqual(isSubscriptionBelongingToGroup(subGroup1Val2, 'I', 200000), true);
console.log('✓ Test 2 passed');

// ─── 3. Associated Group Resolver ─────────────────────────────────────────────
console.log('Test 3: findAssociatedGroupForSubscription');
const groupsList = [
  { id: 'group_1_200000', groupId: '1', totalChitValue: 200000, monthlyPremium: 8800, currentChitMonth: 7 },
  { id: 'group_2_200000', groupId: '2', totalChitValue: 200000, monthlyPremium: 7800, currentChitMonth: 2 },
  { id: 'group_A_100000', groupId: 'A', totalChitValue: 100000, monthlyPremium: 5000, currentChitMonth: 4 },
];

const testSub1 = { id: 'sub_nanda_1', groupId: '1', totalChitValue: 200000 };
const testSub2 = { id: 'sub_nanda_2', groupId: '2', totalChitValue: 200000 };
assert.strictEqual(findAssociatedGroupForSubscription(testSub1, groupsList)?.monthlyPremium, 8800);
assert.strictEqual(findAssociatedGroupForSubscription(testSub2, groupsList)?.monthlyPremium, 7800);
console.log('✓ Test 3 passed');

// ─── 4. NANDA 4-Subscription Case (The Exact Reported Bug) ────────────────────
console.log('Test 4: NANDA 4-Subscription Case');
const nandaMember = {
  id: 'mem_nanda',
  name: 'NANDA',
  phone: '9876543210',
  whatsapp: '9876543210',
  classification: 'MULTIPLE',
  pending: 0,
  balance: 0,
  chits: [
    { id: 'c1', groupId: '1', totalChitValue: 200000, currentChitMonth: 7, totalMonths: 20, monthlyAmount: 8800, pending: 0, balance: 0 },
    { id: 'c2', groupId: '2', totalChitValue: 200000, currentChitMonth: 2, totalMonths: 20, monthlyAmount: 7800, pending: 0, balance: 0 },
    { id: 'c3', groupId: '2', totalChitValue: 200000, currentChitMonth: 2, totalMonths: 20, monthlyAmount: 7800, pending: 0, balance: 0 },
    { id: 'c4', groupId: '2', totalChitValue: 200000, currentChitMonth: 2, totalMonths: 20, monthlyAmount: 7800, pending: 0, balance: 0 },
  ],
};

const groupPaymentSettings = {
  settingsMap: {
    '200000_1': 8800,
    '200000_2': 7800,
  },
};

// Check individual effective monthly amounts
const amt1 = getEffectiveMonthlyAmount(nandaMember, nandaMember.chits[0], groupPaymentSettings, null, null, groupsList);
const amt2 = getEffectiveMonthlyAmount(nandaMember, nandaMember.chits[1], groupPaymentSettings, null, null, groupsList);
const amt3 = getEffectiveMonthlyAmount(nandaMember, nandaMember.chits[2], groupPaymentSettings, null, null, groupsList);
const amt4 = getEffectiveMonthlyAmount(nandaMember, nandaMember.chits[3], groupPaymentSettings, null, null, groupsList);

assert.strictEqual(amt1, 8800, 'Chit 1 should be 8800');
assert.strictEqual(amt2, 7800, 'Chit 2 should be 7800');
assert.strictEqual(amt3, 7800, 'Chit 3 should be 7800');
assert.strictEqual(amt4, 7800, 'Chit 4 should be 7800');

const totalAmt = amt1 + amt2 + amt3 + amt4;
assert.strictEqual(totalAmt, 32200, 'Total should be 32200');

// Test the compiled WhatsApp message for NANDA
const nandaMessage = formatLockedWhatsAppMessage(nandaMember, {
  groupPaymentSettings,
  billingMonth: 'August 2026',
  dueDate: '15వ తారీకు లోపు',
  allGroupsList: groupsList,
});

console.log('\n--- Generated NANDA Message Preview ---');
console.log(nandaMessage);
console.log('---------------------------------------\n');

assert(nandaMessage.includes('NANDA గారు'), 'Must contain member heading');
assert(nandaMessage.includes('7/20 : 8,800'), 'Must contain 7/20 : 8,800');
assert(nandaMessage.includes('2/20 : 7,800'), 'Must contain 2/20 : 7,800');
assert(nandaMessage.includes('పాత బాకీ : 0'), 'Must contain పాత బాకీ : 0');
assert(nandaMessage.includes('నిల్వ     : 0'), 'Must contain నిల్వ     : 0');
assert(nandaMessage.includes('మొత్తం    : ₹32,200'), 'Must contain మొత్తం    : ₹32,200');
assert(nandaMessage.includes('రాఘవేంద్ర చిట్టి'), 'Must contain footer signature');
console.log('✓ Test 4 passed');

// ─── 5. Member with Custom Monthly Amount & Fallback on Removal ──────────────
console.log('Test 5: Custom Monthly Amount & Fallback on Removal');
const memberWithCustom = {
  id: 'mem_custom',
  name: 'SURESH',
  classification: 'MULTIPLE',
  chits: [
    {
      id: 'c_custom',
      groupId: '1',
      totalChitValue: 200000,
      hasCustomMonthlyAmount: true,
      customMonthlyAmount: 9500,
      monthlyAmount: 9500,
    },
    {
      id: 'c_std',
      groupId: '1',
      totalChitValue: 200000,
      hasCustomMonthlyAmount: false,
      monthlyAmount: 8800,
    },
  ],
};

const customResolved = getEffectiveMonthlyAmount(
  memberWithCustom,
  memberWithCustom.chits[0],
  groupPaymentSettings,
  null,
  null,
  groupsList
);
assert.strictEqual(customResolved, 9500, 'Custom amount should resolve to 9500');

// Remove custom amount (simulating admin removing the override)
const subClearedCustom = {
  ...memberWithCustom.chits[0],
  hasCustomMonthlyAmount: false,
  customMonthlyAmount: null,
};
const fallbackResolved = getEffectiveMonthlyAmount(
  memberWithCustom,
  subClearedCustom,
  groupPaymentSettings,
  null,
  null,
  groupsList
);
assert.strictEqual(fallbackResolved, 8800, 'Cleared custom amount should fall back to group amount 8800');
console.log('✓ Test 5 passed');

// ─── 6. Member with Pending Dues ──────────────────────────────────────────────
console.log('Test 6: Member with Pending Dues');
const memberWithPending = {
  ...nandaMember,
  pending: 5000,
  balance: 0,
};
const pendingMsg = formatLockedWhatsAppMessage(memberWithPending, {
  groupPaymentSettings,
  allGroupsList: groupsList,
});
assert(pendingMsg.includes('పాత బాకీ : 5,000'), 'Pending dues must show 5,000');
assert(pendingMsg.includes('నిల్వ     : 0'), 'Balance must show 0');
assert(pendingMsg.includes('మొత్తం    : ₹37,200'), 'Total must be 32200 + 5000 = 37,200');
console.log('✓ Test 6 passed');

// ─── 7. Member with Positive Balance ──────────────────────────────────────────
console.log('Test 7: Member with Positive Balance');
const memberWithBalance = {
  ...nandaMember,
  pending: 0,
  balance: 2000,
};
const balanceMsg = formatLockedWhatsAppMessage(memberWithBalance, {
  groupPaymentSettings,
  allGroupsList: groupsList,
});
assert(balanceMsg.includes('పాత బాకీ : 0'), 'Pending dues must show 0');
assert(balanceMsg.includes('నిల్వ     : 2,000'), 'Balance must show 2,000');
assert(balanceMsg.includes('మొత్తం    : ₹30,200'), 'Total must be 32200 - 2000 = 30,200');
console.log('✓ Test 7 passed');

// ─── 8. Member with Both Pending Dues and Balance ─────────────────────────────
console.log('Test 8: Member with Both Pending and Balance');
const memberWithBoth = {
  ...nandaMember,
  pending: 5000,
  balance: 2000,
};
const bothMsg = formatLockedWhatsAppMessage(memberWithBoth, {
  groupPaymentSettings,
  allGroupsList: groupsList,
});
assert(bothMsg.includes('పాత బాకీ : 5,000'), 'Pending must be 5,000');
assert(bothMsg.includes('నిల్వ     : 2,000'), 'Balance must be 2,000');
assert(bothMsg.includes('మొత్తం    : ₹35,200'), 'Total must be 32200 + 5000 - 2000 = 35,200');
console.log('✓ Test 8 passed');

// ─── 9. Single Chit Message Generation (Format Preserved) ─────────────────────
console.log('Test 9: Single Chit Message Generation');
const singleChitMember = {
  id: 'mem_single',
  name: 'RAMESH',
  classification: 'SINGLE',
  groupId: 'A',
  totalChitValue: 100000,
  pending: 0,
  balance: 0,
  chits: [
    { id: 'sc1', groupId: 'A', totalChitValue: 100000, currentChitMonth: 4, totalMonths: 20, monthlyAmount: 5000, pending: 0, balance: 0 },
  ],
};

const singleMsg = formatLockedWhatsAppMessage(singleChitMember, {
  groupPaymentSettings,
  allGroupsList: groupsList,
});
console.log('\n--- Generated Single Chit Message Preview ---');
console.log(singleMsg);
console.log('---------------------------------------------\n');
assert(singleMsg.includes('RAMESH గారు'), 'Must contain RAMESH గారు');
assert(singleMsg.includes('ఈనెల చీటీ 4/20      5000'), 'Must contain chit month line');
assert(singleMsg.includes('పాత బాకీ             0'), 'Must contain pending 0');
assert(singleMsg.includes('మొత్తం               5000'), 'Must contain total 5000');
assert(singleMsg.includes('రాఘవేంద్ర చిట్టి'), 'Must contain signature');
console.log('✓ Test 9 passed');

// ─── 10. Message Prepared for Sending Matches Preview ─────────────────────────
console.log('Test 10: Message Prepared for Sending Matches Preview');
const previewMsg = generatePersonalizedMessage(nandaMember, null, {
  groupPaymentSettings,
  chitsList: groupsList,
  allGroupsList: groupsList,
});
assert.strictEqual(previewMsg, nandaMessage, 'Preview and prepared send message must be identical');
console.log('✓ Test 10 passed');

// ─── 11. Member with Unrelated Groups ─────────────────────────────────────────
console.log('Test 11: Member with Unrelated Groups');
const memberUnrelated = {
  id: 'mem_unrelated',
  name: 'KUMAR',
  classification: 'MULTIPLE',
  chits: [
    { id: 'u1', groupId: 'A', totalChitValue: 100000 },
    { id: 'u2', groupId: '2', totalChitValue: 200000 },
  ],
};
const amtU1 = getEffectiveMonthlyAmount(memberUnrelated, memberUnrelated.chits[0], groupPaymentSettings, null, null, groupsList);
const amtU2 = getEffectiveMonthlyAmount(memberUnrelated, memberUnrelated.chits[1], groupPaymentSettings, null, null, groupsList);
assert.strictEqual(amtU1, 5000, 'Group A 100000 should be 5000');
assert.strictEqual(amtU2, 7800, 'Group 2 200000 should be 7800');
console.log('✓ Test 11 passed');

// ─── 12. Member with One Subscription in Multiple Chit Classification ────────
console.log('Test 12: Member with One Subscription in Multiple Chit Classification');
const singleSubMultiMember = {
  id: 'mem_single_sub_multi',
  name: 'VENKAT',
  classification: 'MULTIPLE',
  pending: 0,
  balance: 0,
  chits: [
    { id: 'sub_v1', groupId: '1', totalChitValue: 200000, currentChitMonth: 7, totalMonths: 20, monthlyAmount: 8800 },
  ],
};
// With 1 chit, getActiveChits has length 1 -> Single Chit formatting is used
const singleSubMsg = formatLockedWhatsAppMessage(singleSubMultiMember, {
  groupPaymentSettings,
  allGroupsList: groupsList,
});
assert(singleSubMsg.includes('VENKAT గారు'), 'Must contain VENKAT గారు');
assert(singleSubMsg.includes('8800'), 'Must contain 8800');
console.log('✓ Test 12 passed');

// ─── 13. Member with Two Subscriptions with Different Amounts ─────────────────
console.log('Test 13: Member with Two Subscriptions');
const twoSubMember = {
  id: 'mem_two_sub',
  name: 'ANIL',
  classification: 'MULTIPLE',
  pending: 0,
  balance: 0,
  chits: [
    { id: 'sub_a1', groupId: '1', totalChitValue: 200000, currentChitMonth: 7, totalMonths: 20 },
    { id: 'sub_a2', groupId: 'A', totalChitValue: 100000, currentChitMonth: 4, totalMonths: 20 },
  ],
};
const twoSubMsg = formatLockedWhatsAppMessage(twoSubMember, {
  groupPaymentSettings,
  allGroupsList: groupsList,
});
assert(twoSubMsg.includes('7/20 : 8,800'), 'Chit 1 must be 8,800');
assert(twoSubMsg.includes('4/20 : 5,000'), 'Chit 2 must be 5,000');
assert(twoSubMsg.includes('మొత్తం    : ₹13,800'), 'Total must be 8800 + 5000 = 13,800');
console.log('✓ Test 13 passed');

// ─── 14. Fallback when groupPaymentSettings is Empty (Resolves from Groups/Firestore)
console.log('Test 14: Fallback when groupPaymentSettings is empty');
// Even if groupPaymentSettings is completely empty, it resolves from matchedGroup in allGroupsList
const emptySettings = {};
const amtFromGroup = getEffectiveMonthlyAmount(nandaMember, nandaMember.chits[0], emptySettings, null, null, groupsList);
assert.strictEqual(amtFromGroup, 8800, 'Must resolve 8800 from matchedGroup in groupsList when groupPaymentSettings is empty');

// Even if groupsList is empty, it resolves from subscription stored monthlyAmount
const amtFromSub = getEffectiveMonthlyAmount(nandaMember, nandaMember.chits[0], emptySettings, null, null, []);
assert.strictEqual(amtFromSub, 8800, 'Must resolve 8800 from subscription stored monthlyAmount');
console.log('✓ Test 14 passed');

// ─── 15. Group Monthly Amount Update Does Not Affect Other Groups ─────────────
console.log('Test 15: Group Monthly Amount Update Does Not Affect Other Groups');
// Update Group 1 from 8800 to 9200
const updatedSettings = {
  settingsMap: {
    '200000_1': 9200,
    '200000_2': 7800,
  },
};
const newGroupsList = [
  { ...groupsList[0], monthlyPremium: 9200 },
  groupsList[1],
  groupsList[2],
];
const updatedAmt1 = getEffectiveMonthlyAmount(nandaMember, nandaMember.chits[0], updatedSettings, null, null, newGroupsList);
const updatedAmt2 = getEffectiveMonthlyAmount(nandaMember, nandaMember.chits[1], updatedSettings, null, null, newGroupsList);
assert.strictEqual(updatedAmt1, 9200, 'Group 1 should now be 9200');
assert.strictEqual(updatedAmt2, 7800, 'Group 2 should REMAIN 7800');
console.log('✓ Test 15 passed');

console.log('\n===========================================');
console.log('ALL 15 COMPREHENSIVE TESTS PASSED 100% SUCCESS! ✓✓✓');
console.log('===========================================\n');
