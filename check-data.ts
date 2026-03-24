import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkData() {
  const plansCol = collection(db, 'production_plans');
  const snapshot = await getDocs(plansCol);
  console.log(`Found ${snapshot.docs.length} plans.`);
  snapshot.docs.forEach(doc => {
    console.log(doc.id, doc.data().projectName);
  });
}

checkData().catch(console.error);
