import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, (firebaseConfig as any).firestoreDatabaseId);
const auth = getAuth(app);

async function checkData() {
  // Sign in as the user to bypass security rules
  await signInWithEmailAndPassword(auth, 'nithin.yadav.amaraboina@gmail.com', process.env.USER_PASSWORD || 'password123');
  
  const plansCol = collection(db, 'production_plans');
  const snapshot = await getDocs(plansCol);
  console.log(`Found ${snapshot.docs.length} total plans.`);
  snapshot.docs.forEach(doc => {
    console.log(doc.id, doc.data().projectName, 'createdAt:', doc.data().createdAt);
  });
}

checkData().catch(console.error);
