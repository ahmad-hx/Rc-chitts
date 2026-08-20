import admin from 'firebase-admin';

if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'raghavendra-chitts-c0822',
  });
}

const db = admin.firestore();

async function inspect() {
  console.log('=== FIRESTORE INSPECTION REPORT (Admin SDK) ===\n');

  // 1. Members
  const membersSnap = await db.collection('members').get();
  console.log(`--- MEMBERS COLLECTION (${membersSnap.size} total) ---`);
  membersSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`ID: ${doc.id}`);
    console.log(`  Name: ${d.name || 'N/A'}`);
    console.log(`  Phone: ${d.phone || 'N/A'} | WhatsApp: ${d.whatsapp || 'N/A'}`);
    console.log(`  Status: ${d.status} | Classification: ${d.classification}`);
    console.log(`  isTestRecord: ${Boolean(d.isTestRecord)}`);
    console.log(`  Chits: ${JSON.stringify(d.chits || [])}`);
    console.log('--------------------------------------------------');
  });

  // 2. Chits
  const chitsSnap = await db.collection('chits').get();
  console.log(`\n--- CHITS COLLECTION (${chitsSnap.size} total) ---`);
  chitsSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`ID: ${doc.id} | GroupId: ${d.groupId} | Name: ${d.name} | TotalValue: ${d.totalChitValue} | Status: ${d.status}`);
  });

  // 3. Message History
  const msgsSnap = await db.collection('messageHistory').get();
  console.log(`\n--- MESSAGE HISTORY COLLECTION (${msgsSnap.size} total) ---`);
  msgsSnap.forEach((doc) => {
    const d = doc.data();
    console.log(`ID: ${doc.id} | Recipient: ${d.recipientName} | Phone: ${d.phone} | Status: ${d.status} | Group: ${d.groupId} | isTest: ${d.isTest}`);
    console.log(`  Message: ${String(d.message || '').replace(/\n/g, ' ')}`);
  });

  // 4. Message Logs (if any)
  const logsSnap = await db.collection('messageLogs').get().catch(() => ({ size: 0, forEach: () => {} }));
  console.log(`\n--- MESSAGE LOGS COLLECTION (${logsSnap.size} total) ---`);

  process.exit(0);
}

inspect().catch((err) => {
  console.error('Error during admin inspection:', err);
  process.exit(1);
});
