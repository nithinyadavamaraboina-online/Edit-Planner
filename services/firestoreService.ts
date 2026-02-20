
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, writeBatch, serverTimestamp, Firestore, query, orderBy, getDocs, getDoc, deleteDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { Worker, Workload, ProductionPlan, Batch } from '../types';

// ... (existing code)

/**
 * Subscribes to real-time updates for a plan.
 * Returns an unsubscribe function.
 */
export const subscribeToPlan = (planId: string, onUpdate: (data: any) => void) => {
  const database = getDb();
  const planDocRef = doc(database, 'production_plans', planId);
  const daysColRef = collection(planDocRef, 'days');

  // We need to combine data from the main doc and the subcollection.
  // We'll listen to both and merge them.
  
  let currentMainData: any = null;
  let currentSchedule: any[] = [];
  let isInitialLoad = true;

  const notify = () => {
    if (currentMainData && currentSchedule.length > 0) {
       onUpdate({
         ...currentMainData,
         plan: {
           ...currentMainData.plan,
           schedule: currentSchedule
         }
       });
    }
  };

  const unsubMain = onSnapshot(planDocRef, (doc) => {
      if (doc.exists()) {
          const data = doc.data();
          currentMainData = {
            workers: data.workers,
            workload: data.workload,
            batches: data.batches || [],
            plan: {
              summary: data.summary,
              bottlenecks: data.bottlenecks,
              constraints: data.constraints,
              risks: data.risks,
              schedule: [] // Placeholder, will be filled by subcollection listener
            },
            projectMeta: {
                id: doc.id,
                name: data.projectName,
                notes: data.notes,
                synced: true
            }
          };
          notify();
      }
  });

  const unsubDays = onSnapshot(query(daysColRef), (snapshot) => {
      currentSchedule = snapshot.docs
        .map(d => d.data() as any)
        .sort((a, b) => a.day - b.day);
      notify();
  });

  return () => {
      unsubMain();
      unsubDays();
  };
};

// Hardcoded configuration
const firebaseConfig = {
  apiKey: "AIzaSyBQ43797xkZC0mhWg_8z3SzELYIzRT-xMY",
  authDomain: "wedo-ai.firebaseapp.com",
  projectId: "wedo-ai",
  storageBucket: "wedo-ai.firebasestorage.app",
  messagingSenderId: "241094368552",
  appId: "1:241094368552:web:589e6d5ddb416ed853841d",
  measurementId: "G-ZMXFL519KC"
};

let app: FirebaseApp | undefined;
let db: Firestore | undefined;

export interface SavedPlanMeta {
  id: string;
  projectName: string;
  notes?: string;
  createdAt: any;
  summary?: any;
}

/**
 * Recursively converts undefined values to null, as Firestore does not support undefined.
 */
const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined) return null;
  if (obj === null || typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForFirestore);
  }

  const newObj: any = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      newObj[key] = sanitizeForFirestore(obj[key]);
    }
  }
  return newObj;
};

/**
 * Initializes or retrieves the Firestore instance.
 */
const getDb = () => {
  if (db) return db;

  // Initialize Firebase
  // Note: In a hot-reload environment, we check getApps to avoid "App already initialized" errors
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  db = getFirestore(app);
  return db;
};

/**
 * Saves the current production plan to Firestore.
 * If planId is provided, it updates the existing document. Otherwise, creates a new one.
 */
export const savePlanToCloud = async (
  projectName: string,
  notes: string,
  workers: Worker[],
  workload: Workload,
  plan: ProductionPlan,
  batches: Batch[] = [],
  languages: string[] = [],
  planId?: string
) => {
  try {
    const database = getDb();
    
    // Sanitize all inputs to ensure no 'undefined' values are passed to Firestore
    const payload = sanitizeForFirestore({
      projectName,
      notes,
      summary: plan.summary,
      workload: workload,
      workers: workers,
      batches: batches,
      languages: languages,
      bottlenecks: plan.bottlenecks,
      constraints: plan.constraints,
      risks: plan.risks,
    });

    let planRef;
    
    if (planId) {
        // UPDATE existing document
        planRef = doc(database, 'production_plans', planId);
        await setDoc(planRef, { 
            ...payload, 
            updatedAt: serverTimestamp() 
        }, { merge: true });
    } else {
        // CREATE new document
        planRef = await addDoc(collection(database, 'production_plans'), {
            ...payload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
    }

    // 2. Use a WriteBatch to store each day in the 'days' subcollection efficiently
    const batch = writeBatch(database);
    const daysCollection = collection(planRef, 'days');

    plan.schedule.forEach((dayData) => {
      // Use day_X as document ID for consistency
      const dayDocRef = doc(daysCollection, `day_${dayData.day}`);
      batch.set(dayDocRef, sanitizeForFirestore(dayData));
    });

    await batch.commit();
    return planRef.id;
  } catch (error: any) {
    console.error("Firestore Save Error:", error);
    throw error; // Re-throw to be caught by UI
  }
};

/**
 * Fetches the list of saved plans from Firestore (metadata only).
 */
export const getSavedPlans = async (): Promise<SavedPlanMeta[]> => {
  try {
      const database = getDb();
      const plansCol = collection(database, 'production_plans');
      // Keep ordering by createdAt to ensure consistent list, users can rely on "most recently created"
      // If we switch to updatedAt, we might lose old docs that lack the field.
      const q = query(plansCol, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      return snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            projectName: data.projectName || 'Untitled',
            notes: data.notes || '',
            createdAt: data.createdAt,
            summary: data.summary
          };
      });
  } catch (e) {
      console.error("Error fetching plans:", e);
      return [];
  }
};

/**
 * Loads a full plan including its days subcollection.
 */
export const loadPlanFromCloud = async (planId: string) => {
  const database = getDb();
  const planDocRef = doc(database, 'production_plans', planId);
  const planDoc = await getDoc(planDocRef);
  
  if (!planDoc.exists()) {
    throw new Error("Plan not found");
  }

  const data = planDoc.data();
  
  // Fetch days subcollection
  const daysCol = collection(planDocRef, 'days');
  const daysSnapshot = await getDocs(daysCol);
  const schedule = daysSnapshot.docs
    .map(d => d.data() as any)
    .sort((a, b) => a.day - b.day);

  return {
    workers: data.workers,
    workload: data.workload,
    batches: data.batches || [],
    languages: data.languages || ['Telugu', 'Tamil'],
    plan: {
      summary: data.summary,
      bottlenecks: data.bottlenecks,
      constraints: data.constraints,
      risks: data.risks,
      schedule: schedule
    },
    projectMeta: {
        id: planDoc.id, // Return ID so we can update it later
        name: data.projectName,
        notes: data.notes,
        synced: true
    }
  };
};

/**
 * Deletes a plan from Firestore.
 */
export const deletePlanFromCloud = async (planId: string) => {
    const database = getDb();
    await deleteDoc(doc(database, 'production_plans', planId));
};
