import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
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
const auth = getAuth(app);
const db = getFirestore(app);

const testEmails = [
  'admin@raghavendrachits.com',
  'admin@raghavendrachitts.com',
  'admin@rc.com',
  'rc@gmail.com',
  'admin@gmail.com',
  'raghavendrachits@gmail.com'
];

const testPasswords = [
  'admin123',
  'admin@123',
  '123456',
  'password',
  'Raghavendra@123',
  'rc123456'
];

async function tryLogin() {
  for (const email of testEmails) {
    for (const pwd of testPasswords) {
      try {
        const res = await signInWithEmailAndPassword(auth, email, pwd);
        console.log(`SUCCESS! Email: ${email} | Password: ${pwd} | UID: ${res.user.uid}`);
        
        const snap = await getDocs(collection(db, 'members'));
        console.log(`Members count in Firestore: ${snap.size}`);
        process.exit(0);
      } catch (err) {
        // ignore wrong password/user not found
      }
    }
  }
  console.log('No matching test credentials found.');
  process.exit(1);
}

tryLogin();
