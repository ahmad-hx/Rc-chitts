import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'raghavendra-chitts-c0822',
  });
}

const db = admin.firestore();

async function inspect() {
  console.log('=== FIRESTORE INSPECTION REPORT ===\n');

  // 1. Members
  const membersSnap = await db.collection('members').get();
  console.log(`--- MEMBERS COLLECTION (${membersSnap.size} total docs) ---`);
  membersSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Name: "${d.name}" | Phone: "${d.phone}" | WhatsApp: "${d.whatsapp}"`);
    console.log(`  Status: ${d.status} | Classification: ${d.classification}`);
    console.log(`  isTestRecord: ${Boolean(d.isTestRecord)}`);
    console.log(`  Chits: ${JSON.stringify(d.chits || [])}`);
    console.log('--------------------------------------------------');
  });

  // 2. Chits
  const chitsSnap = await db.collection('chits').get();
  console.log(`\n--- CHITS COLLECTION (${chitsSnap.size} total docs) ---`);
  chitsSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`ID: ${doc.id} | GroupId: ${d.groupId} | Name: ${d.name} | TotalValue: ${d.totalChitValue} | Status: ${d.status}`);
  });

  // 3. Message History
  const msgsSnap = await db.collection('messageHistory').get();
  console.log(`\n--- MESSAGE HISTORY COLLECTION (${msgsSnap.size} total docs) ---`);
  msgsSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`ID: ${doc.id} | Recipient: "${d.recipientName}" | Phone: "${d.phone}" | Status: ${d.status} | Group: ${d.groupId} | isTest: ${d.isTest}`);
    console.log(`  Message: ${String(d.message || '').replace(/\n/g, ' ')}`);
  });

  // 4. Holdings
  const holdingsSnap = await db.collection('holdings').get();
  console.log(`\n--- HOLDINGS COLLECTION (${holdingsSnap.size} total docs) ---`);
  holdingsSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`ID: ${doc.id} | MemberId: ${d.memberId} | GroupId: ${d.groupId} | Quantity: ${d.quantity}`);
  });

  // 5. Payments
  const paymentsSnap = await db.collection('payments').get();
  console.log(`\n--- PAYMENTS COLLECTION (${paymentsSnap.size} total docs) ---`);
  paymentsSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`ID: ${doc.id} | MemberId: ${d.memberId} | Amount: ${d.amount} | Date: ${d.paymentDate}`);
  });

  process.exit(0);
}

inspect().catch((err) => {
  console.error('Error during admin inspection:', err);
  process.exit(1);
});
