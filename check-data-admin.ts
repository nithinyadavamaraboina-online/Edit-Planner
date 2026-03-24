import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

const app = admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: firebaseConfig.projectId
});

const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function checkData() {
  const plansCol = db.collection('production_plans');
  const snapshot = await plansCol.get();
  console.log(`Found ${snapshot.docs.length} total plans.`);
  snapshot.docs.forEach(doc => {
    console.log(doc.id, doc.data().projectName, 'createdAt:', doc.data().createdAt);
  });
}

checkData().catch(console.error);
