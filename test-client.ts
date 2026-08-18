import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
const auth = getAuth(app);

async function test() {
  try {
    const plansCol = collection(db, 'production_plans');
    const snapshot = await getDocs(plansCol);
    console.log("Snapshot size:", snapshot.size);
    snapshot.forEach(doc => {
      console.log(doc.id, doc.data());
    });
  } catch (e) {
    console.error("Error:", e);
  }
  process.exit(0);
}

test();
