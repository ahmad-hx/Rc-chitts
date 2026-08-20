import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signInAnonymously } from 'firebase/auth';
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

async function testAuth() {
  console.log('Testing auth...');
  try {
    const cred = await signInAnonymously(auth);
    console.log('Anonymous sign-in success:', cred.user.uid);
    const snap = await getDocs(collection(db, 'members'));
    console.log('Members count:', snap.size);
  } catch (err) {
    console.error('Anonymous sign-in failed:', err.message);
  }
}

testAuth();
