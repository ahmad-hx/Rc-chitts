import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAHf9ZmllsvCCnSZ8-LjYEaJhpqaEmRzcU",
  authDomain: "raghavendra-chitts-c0822.firebaseapp.com",
  projectId: "raghavendra-chitts-c0822",
  storageBucket: "raghavendra-chitts-c0822.firebasestorage.app",
  messagingSenderId: "1033279730234",
  appId: "1:1033279730234:web:3cbfe0f06a842c41523b03",
  measurementId: "G-D0C6CKKZR7",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function inspect() {
  console.log('=== INSPECTING FIRESTORE DATA ===\n');

  // 1. Members
  const membersSnap = await getDocs(collection(db, 'members'));
  const members = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`--- MEMBERS (${members.length}) ---`);
  members.forEach(m => {
    console.log(`ID: ${m.id} | Name: ${m.name} | Phone: ${m.phone} | WhatsApp: ${m.whatsapp} | Status: ${m.status} | Classification: ${m.classification} | Chits: ${JSON.stringify(m.chits || [])}`);
  });

  // 2. Chits
  const chitsSnap = await getDocs(collection(db, 'chits'));
  const chits = chitsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`\n--- CHITS (${chits.length}) ---`);
  chits.forEach(c => {
    console.log(`ID: ${c.id} | GroupId: ${c.groupId} | Name: ${c.name} | Value: ${c.totalChitValue} | Months: ${c.tenureMonths} | Status: ${c.status}`);
  });

  // 3. Message History
  const msgSnap = await getDocs(collection(db, 'messageHistory'));
  const msgs = msgSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  console.log(`\n--- MESSAGE HISTORY (${msgs.length}) ---`);
  msgs.forEach(m => {
    console.log(`ID: ${m.id} | Name: ${m.recipientName} | Phone: ${m.phone} | Group: ${m.groupId} | Status: ${m.status} | Msg: ${m.message ? m.message.replace(/\n/g, ' ') : ''}`);
  });

  process.exit(0);
}

inspect().catch(err => {
  console.error('Error inspecting firestore:', err);
  process.exit(1);
});
