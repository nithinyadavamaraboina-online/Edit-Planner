
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getFirestore, collection, addDoc, doc, writeBatch, serverTimestamp, Firestore, query, orderBy, getDocs, getDoc, deleteDoc, setDoc, onSnapshot, updateDoc, deleteField, getDocFromServer } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, Auth, User as FirebaseUser } from 'firebase/auth';
import { Worker, Workload, ProductionPlan, Batch, DayPlan, TaskAssignment } from '../types';

export const testConnection = async () => {
  try {
    const database = getDb();
    await getDocFromServer(doc(database, 'test', 'connection'));
    console.log("Firestore connection successful");
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Firestore connection check: the client is currently offline. Will retry automatically.");
    } else {
      console.log("Firestore connection test completed (expected error if no test doc exists)");
    }
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const authInstance = getAuthInstance();
  const currentUser = authInstance.currentUser;
  
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: currentUser?.uid,
      email: currentUser?.email,
      emailVerified: currentUser?.emailVerified,
      isAnonymous: currentUser?.isAnonymous,
      tenantId: currentUser?.tenantId,
      providerInfo: currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// ... (existing code)

const DEFAULT_LANGUAGES = ['Telugu', 'Tamil', 'Malayalam', 'Kannada'];

/**
 * Subscribes to real-time updates for a plan.
 * Returns an unsubscribe function.
 */
export const subscribeToPlan = (planId: string, onUpdate: (data: any) => void) => {
  const database = getDb();
  const planDocRef = doc(database, 'production_plans', planId);
  const daysColRef = collection(planDocRef, 'days');

  let mainData: any = null;
  const daysData: Record<number, DayPlan> = {};
  const assignmentsData: Record<number, Record<string, TaskAssignment>> = {};
  const assignmentUnsubs: Record<number, () => void> = {};

    const emit = () => {
    if (!mainData) return;
    
    // Merge daysData and assignmentsData into a schedule
    // We look at all days we know about (from mainData.plan.schedule OR daysData)
    const dayNumbers = new Set<number>();
    (mainData.plan.schedule || []).forEach((d: any) => dayNumbers.add(d.day));
    Object.keys(daysData).forEach(k => dayNumbers.add(parseInt(k)));

    const schedule = Array.from(dayNumbers).map(dayNum => {
        // Start with data from main doc if available
        const baseDay = (mainData.plan.schedule || []).find((d: any) => d.day === dayNum) || { day: dayNum, assignments: [] };
        
        // Override with granular day data if available
        const dayPlan = daysData[dayNum] ? { ...baseDay, ...daysData[dayNum] } : { ...baseDay };
        
        // If we have granular assignments for this day, use them
        // CRITICAL FIX: We must merge granular assignments with existing ones, not just replace
        // If assignmentsData[dayNum] exists, it contains the LATEST state of assignments for that day
        if (assignmentsData[dayNum]) {
            dayPlan.assignments = Object.values(assignmentsData[dayNum]);
        } else if (!dayPlan.assignments) {
            dayPlan.assignments = [];
        }
        
        // Recalculate daily totals to ensure they are always accurate
        dayPlan.dailyTotalGen = dayPlan.assignments.reduce((sum: number, t: any) => sum + (t.generations || 0), 0);
        dayPlan.dailyTotalEdit = dayPlan.assignments.reduce((sum: number, t: any) => sum + (t.edits || 0), 0);
        
        return dayPlan;
    }).sort((a, b) => a.day - b.day);
    
    onUpdate({
      ...mainData,
      plan: {
        ...mainData.plan,
        schedule: schedule
      }
    });
  };

  const unsubMain = onSnapshot(planDocRef, (doc) => {
      if (doc.exists()) {
          const data = doc.data();
          mainData = {
            workers: data.workers,
            workload: data.workload,
            batches: data.batches || [],
            languages: data.languages || DEFAULT_LANGUAGES,
            plan: {
              summary: data.summary,
              bottlenecks: data.bottlenecks,
              constraints: data.constraints,
              risks: data.risks,
              rowAssignments: data.rowAssignments || {},
              schedule: data.schedule || []
            },
            projectMeta: {
                id: doc.id,
                name: data.projectName,
                notes: data.notes,
                synced: true,
                googleChatSpaceId: data.googleChatSpaceId || '',
                googleChatSpaceName: data.googleChatSpaceName || '',
                googleChatNotifyOnLock: data.googleChatNotifyOnLock ?? false
            }
          };
          emit();
      }
  }, (error) => {
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
          handleFirestoreError(error, OperationType.GET, `production_plans/${planId}`);
      }
      console.error("Error subscribing to plan:", error);
  });

  const unsubDays = onSnapshot(daysColRef, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
          const dayId = change.doc.id;
          const dayNum = parseInt(dayId);
          
          if (change.type === 'removed') {
              delete daysData[dayNum];
              if (assignmentUnsubs[dayNum]) {
                  assignmentUnsubs[dayNum]();
                  delete assignmentUnsubs[dayNum];
              }
              delete assignmentsData[dayNum];
          } else {
              daysData[dayNum] = change.doc.data() as DayPlan;
              
              // Subscribe to assignments for this day if not already
              if (!assignmentUnsubs[dayNum]) {
                  const assignmentsColRef = collection(doc(daysColRef, dayId), 'assignments');
                  
                  // Initialize assignmentsData for this day if needed
                  if (!assignmentsData[dayNum]) {
                      assignmentsData[dayNum] = {};
                      // Pre-populate with existing assignments from mainData if available
                      // This prevents flashing empty assignments while waiting for subcollection
                      const baseDay = (mainData?.plan?.schedule || []).find((d: any) => d.day === dayNum);
                      if (baseDay && baseDay.assignments) {
                          baseDay.assignments.forEach((a: any) => {
                              assignmentsData[dayNum][a.id || a.workerId] = a;
                          });
                      } else if (daysData[dayNum].assignments) {
                          daysData[dayNum].assignments.forEach(a => {
                              assignmentsData[dayNum][a.id || a.workerId] = a;
                          });
                      }
                  }

                  assignmentUnsubs[dayNum] = onSnapshot(assignmentsColRef, (assignSnapshot) => {
                      assignSnapshot.docChanges().forEach((assignChange) => {
                          if (assignChange.type === 'removed') {
                              delete assignmentsData[dayNum][assignChange.doc.id];
                          } else {
                              assignmentsData[dayNum][assignChange.doc.id] = assignChange.doc.data() as TaskAssignment;
                          }
                      });
                      emit();
                  }, (error) => {
                      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
                          handleFirestoreError(error, OperationType.LIST, `production_plans/${planId}/days/${dayId}/assignments`);
                      }
                      console.error("Error subscribing to assignments:", error);
                  });
              }
          }
      });
      emit();
  }, (error) => {
      if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
          handleFirestoreError(error, OperationType.LIST, `production_plans/${planId}/days`);
      }
      console.error("Error subscribing to days:", error);
  });

  return () => {
    unsubMain();
    unsubDays();
    Object.values(assignmentUnsubs).forEach(unsub => unsub());
  };
};

// Hardcoded configuration
import firebaseConfig from '../firebase-applet-config.json';

let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let auth: Auth | undefined;

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
export const getDb = () => {
  if (db) return db;

  // Initialize Firebase
  // Note: In a hot-reload environment, we check getApps to avoid "App already initialized" errors
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  const config = firebaseConfig as any;
  if (config.firestoreDatabaseId && config.firestoreDatabaseId !== '(default)') {
    db = getFirestore(app, config.firestoreDatabaseId);
  } else {
    db = getFirestore(app);
  }
  return db;
};

/**
 * Initializes or retrieves the Auth instance.
 */
export const getAuthInstance = () => {
  if (auth) return auth;

  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApp();
  }
  
  auth = getAuth(app);
  return auth;
};

let cachedAccessToken: string | null = null;

export const setAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

export const getAccessToken = () => {
  return cachedAccessToken;
};

/**
 * Automatically reconciles and enriches user profiles on login.
 */
export const syncUserProfileOnLogin = async (user: FirebaseUser) => {
  if (!user || !user.uid) return;
  try {
    const database = getDb();
    const userRef = doc(database, 'users', user.uid);
    await setDoc(userRef, {
      uid: user.uid,
      email: user.email || null,
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      lastLogin: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (err) {
    console.warn("Could not sync user profile on login:", err);
  }
};

export const signInWithGoogle = async () => {
  const authInstance = getAuthInstance();
  const provider = new GoogleAuthProvider();
  
  try {
    const result = await signInWithPopup(authInstance, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      cachedAccessToken = credential.accessToken;
    }
    if (result.user) {
      await syncUserProfileOnLogin(result.user);
    }
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const updateProjectFieldInCloud = async (planId: string, fields: any) => {
  try {
    const database = getDb();
    const planRef = doc(database, 'production_plans', planId);
    await updateDoc(planRef, { 
      ...sanitizeForFirestore(fields), 
      updatedAt: serverTimestamp() 
    });
  } catch (e) {
    if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}`);
    }
    console.error("Error updating project field:", e);
    throw e;
  }
};

export const signOutUser = async () => {
  const authInstance = getAuthInstance();
  try {
    await signOut(authInstance);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};

export const onAuthChange = (callback: (user: FirebaseUser | null) => void) => {
  const authInstance = getAuthInstance();
  return onAuthStateChanged(authInstance, async (user) => {
    if (user) {
      syncUserProfileOnLogin(user).catch(() => {});
    }
    callback(user);
  });
};

/**
 * Saves a single day to the cloud.
 */
export const saveDayToCloud = async (planId: string, dayPlan: DayPlan) => {
    try {
        const database = getDb();
        const dayDocRef = doc(database, 'production_plans', planId, 'days', dayPlan.day.toString());
        
        // Save day metadata (totals, locked status) but NOT the assignments array
        // to avoid overwriting granular assignment updates
        const { assignments, ...dayMeta } = dayPlan;
        await setDoc(dayDocRef, sanitizeForFirestore(dayMeta), { merge: true });

        // Save assignments granularly and delete old ones
        const assignmentsColRef = collection(dayDocRef, 'assignments');
        const existingAssignmentsSnapshot = await getDocs(assignmentsColRef);
        
        const batch = writeBatch(database);
        
        // Delete assignments that are no longer in the new plan
        const newAssignmentIds = new Set((assignments || []).map(t => t.id || t.workerId));
        existingAssignmentsSnapshot.forEach(doc => {
            if (!newAssignmentIds.has(doc.id)) {
                batch.delete(doc.ref);
            }
        });

        // Set new/updated assignments
        if (assignments && assignments.length > 0) {
            assignments.forEach(task => {
                const taskRef = doc(dayDocRef, 'assignments', task.id || task.workerId);
                batch.set(taskRef, sanitizeForFirestore(task), { merge: true });
            });
        }
        
        await batch.commit();
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}/days/${dayPlan.day}`);
        }
        console.error("Error saving day to cloud:", e);
        throw e;
    }
};

/**
 * Saves a single assignment to the cloud.
 */
export const saveAssignmentToCloud = async (planId: string, dayPlan: DayPlan, assignment: TaskAssignment) => {
    try {
        const database = getDb();
        // Ensure the day document exists so other clients subscribe to its assignments subcollection
        const dayRef = doc(database, 'production_plans', planId, 'days', dayPlan.day.toString());
        
        const { assignments, ...dayMeta } = dayPlan;
        await setDoc(dayRef, sanitizeForFirestore(dayMeta), { merge: true });
        
        const taskRef = doc(dayRef, 'assignments', assignment.id || assignment.workerId);
        await setDoc(taskRef, sanitizeForFirestore(assignment), { merge: true });
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}/days/${dayPlan.day}/assignments/${assignment.id || assignment.workerId}`);
        }
        console.error("Error saving assignment to cloud:", e);
        throw e;
    }
};

/**
 * Deletes an assignment from the cloud.
 */
export const deleteAssignmentFromCloud = async (planId: string, dayPlan: DayPlan, assignmentId: string) => {
    try {
        const database = getDb();
        // Ensure the day document exists so other clients subscribe to its assignments subcollection
        const dayRef = doc(database, 'production_plans', planId, 'days', dayPlan.day.toString());
        
        const { assignments, ...dayMeta } = dayPlan;
        await setDoc(dayRef, sanitizeForFirestore(dayMeta), { merge: true });
        
        const taskRef = doc(dayRef, 'assignments', assignmentId);
        await deleteDoc(taskRef);
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.DELETE, `production_plans/${planId}/days/${dayPlan.day}/assignments/${assignmentId}`);
        }
        console.error("Error deleting assignment from cloud:", e);
        throw e;
    }
};

/**
 * Presence Tracking
 */
export const updatePresence = async (planId: string, userId: string, userName: string, role: string, language: string) => {
    try {
        const database = getDb();
        const presenceRef = doc(database, 'production_plans', planId, 'presence', userId);
        await setDoc(presenceRef, {
            userId,
            userName,
            role,
            language,
            lastActive: serverTimestamp()
        });
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}/presence/${userId}`);
        }
        console.error("Error updating presence:", e);
    }
};

export const subscribeToPresence = (planId: string, onUpdate: (users: any[]) => void) => {
    const database = getDb();
    const presenceCol = collection(database, 'production_plans', planId, 'presence');
    
    return onSnapshot(presenceCol, (snapshot) => {
        const now = Date.now();
        const users = snapshot.docs.map(doc => doc.data())
            .filter(u => {
                // Filter out users inactive for more than 5 minutes
                if (!u.lastActive) return true;
                const lastActive = u.lastActive.toMillis ? u.lastActive.toMillis() : u.lastActive;
                return (now - lastActive) < 300000;
            });
        onUpdate(users);
    }, (error) => {
        if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(error, OperationType.LIST, `production_plans/${planId}/presence`);
        }
        console.error("Error subscribing to presence:", error);
    });
};

export const updateBatchesInCloud = async (planId: string, batches: Batch[]) => {
    try {
        const database = getDb();
        const planRef = doc(database, 'production_plans', planId);
        await updateDoc(planRef, { 
            batches: sanitizeForFirestore(batches), 
            updatedAt: serverTimestamp() 
        });
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}`);
        }
        console.error("Error updating batches:", e);
        throw e;
    }
};

export const updateWorkersInCloud = async (planId: string, workers: Worker[]) => {
    try {
        const database = getDb();
        const planRef = doc(database, 'production_plans', planId);
        await updateDoc(planRef, { 
            workers: sanitizeForFirestore(workers), 
            updatedAt: serverTimestamp() 
        });
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}`);
        }
        console.error("Error updating workers:", e);
        throw e;
    }
};

export const updateLeavesInCloud = async (planId: string, leaves: Record<string, number[]>) => {
    try {
        const database = getDb();
        const planRef = doc(database, 'production_plans', planId);
        await updateDoc(planRef, { 
            leaves: sanitizeForFirestore(leaves), 
            updatedAt: serverTimestamp() 
        });
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}`);
        }
        console.error("Error updating leaves:", e);
        throw e;
    }
};

export const updatePlanInCloud = async (planId: string, plan: ProductionPlan, skipSchedule: boolean = false) => {
    try {
        const database = getDb();
        const planRef = doc(database, 'production_plans', planId);
        await updateDoc(planRef, { 
            summary: sanitizeForFirestore(plan.summary),
            bottlenecks: sanitizeForFirestore(plan.bottlenecks),
            constraints: sanitizeForFirestore(plan.constraints),
            risks: sanitizeForFirestore(plan.risks),
            rowAssignments: sanitizeForFirestore(plan.rowAssignments || {}),
            updatedAt: serverTimestamp() 
        });
        
        if (plan.schedule && !skipSchedule) {
            for (const day of plan.schedule) {
                await saveDayToCloud(planId, day);
            }
        }
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}`);
        }
        console.error("Error updating plan:", e);
        throw e;
    }
};

export const updateLanguagesInCloud = async (planId: string, languages: string[]) => {
    try {
        const database = getDb();
        const planRef = doc(database, 'production_plans', planId);
        await updateDoc(planRef, { 
            languages: sanitizeForFirestore(languages),
            updatedAt: serverTimestamp() 
        });
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.UPDATE, `production_plans/${planId}`);
        }
        console.error("Error updating languages:", e);
        throw e;
    }
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
  leaves: Record<string, number[]> = {},
  planId?: string,
  skipSchedule: boolean = false
) => {
  try {
    const database = getDb();
    
    // Sanitize all inputs to ensure no 'undefined' values are passed to Firestore
    const payload: any = {
      projectName,
      notes,
      summary: plan.summary,
      workload: workload,
      workers: workers,
      batches: batches,
      languages: languages,
      leaves: leaves,
      bottlenecks: plan.bottlenecks,
      constraints: plan.constraints,
      risks: plan.risks,
      rowAssignments: plan.rowAssignments || {},
    };

    if (!skipSchedule) {
        payload.schedule = plan.schedule;
    }

    const sanitizedPayload = sanitizeForFirestore(payload);

    let finalPlanId = planId;
    
    if (planId) {
        // UPDATE existing document
        const planRef = doc(database, 'production_plans', planId);
        await setDoc(planRef, { 
            ...sanitizedPayload, 
            updatedAt: serverTimestamp() 
        }, { merge: true });
    } else {
        // CREATE new document
        const planRef = await addDoc(collection(database, 'production_plans'), {
            ...sanitizedPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        finalPlanId = planRef.id;
    }

    // Also save all days to subcollection for granular multi-user support
    // only if not skipping schedule or if it's a new plan
    if (finalPlanId && plan.schedule && !skipSchedule) {
        // Delete old days that are no longer in the schedule
        const daysColRef = collection(database, 'production_plans', finalPlanId, 'days');
        const existingDaysSnapshot = await getDocs(daysColRef);
        const newDayNumbers = new Set(plan.schedule.map(d => d.day.toString()));
        
        const deletePromises: Promise<void>[] = [];
        existingDaysSnapshot.forEach(doc => {
            if (!newDayNumbers.has(doc.id)) {
                // We can't easily delete subcollections in a batch, so we just delete the day document.
                // Note: In a real production app, you'd want a Cloud Function to recursively delete subcollections,
                // but for this app, deleting the day document is enough to hide it from the UI.
                deletePromises.push(deleteDoc(doc.ref));
            }
        });
        await Promise.all(deletePromises);

        // Run these sequentially to avoid overwhelming Firestore
        for (const day of plan.schedule) {
            await saveDayToCloud(finalPlanId!, day);
        }
    }

    return finalPlanId!;
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(error, planId ? OperationType.UPDATE : OperationType.CREATE, `production_plans/${planId || 'new'}`);
    }
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
      const q = query(plansCol);
      const snapshot = await getDocs(q);
      
      console.log("getSavedPlans snapshot size:", snapshot.size);
      
      const plans = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            projectName: data.projectName || 'Untitled',
            notes: data.notes || '',
            createdAt: data.createdAt || data.updatedAt || { toMillis: () => 0 },
            summary: data.summary
          };
      });
      
      // Sort in memory to ensure we don't filter out docs missing createdAt
      return plans.sort((a, b) => {
          const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
          const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
          return timeB - timeA;
      });
  } catch (e) {
      console.error("Error fetching plans:", e);
      if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
          handleFirestoreError(e, OperationType.LIST, 'production_plans');
      }
      return [];
  }
};

/**
 * Loads a full plan including its days subcollection.
 */
export const loadPlanFromCloud = async (planId: string) => {
  try {
    const database = getDb();
    const planDocRef = doc(database, 'production_plans', planId);
    const planDoc = await getDoc(planDocRef);
    
    if (!planDoc.exists()) {
      throw new Error("Plan not found");
    }

    const data = planDoc.data();
    
    // Try to load days from subcollection
    const daysColRef = collection(planDocRef, 'days');
    const daysSnapshot = await getDocs(daysColRef);
    let schedule = data.schedule || [];
    
    if (!daysSnapshot.empty) {
        const subColDays = await Promise.all(daysSnapshot.docs.map(async (d) => {
            const dayData = d.data() as DayPlan;
            // Load assignments subcollection for this day
            const assignmentsColRef = collection(d.ref, 'assignments');
            const assignmentsSnapshot = await getDocs(assignmentsColRef);
            if (!assignmentsSnapshot.empty) {
                const assignments = assignmentsSnapshot.docs.map(a => a.data() as TaskAssignment);
                // Merge subcollection assignments with any existing ones
                const assignmentMap = new Map<string, TaskAssignment>();
                (dayData.assignments || []).forEach(a => assignmentMap.set(a.id || a.workerId, a));
                assignments.forEach(a => assignmentMap.set(a.id || a.workerId, a));
                dayData.assignments = Array.from(assignmentMap.values());
            }
            return dayData;
        }));
        
        schedule = subColDays.sort((a, b) => a.day - b.day);
    }
    
    return {
      workers: data.workers,
      workload: data.workload,
      batches: data.batches || [],
      languages: data.languages || DEFAULT_LANGUAGES,
      leaves: data.leaves || {},
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
          synced: true,
          googleChatSpaceId: data.googleChatSpaceId || '',
          googleChatSpaceName: data.googleChatSpaceName || '',
          googleChatNotifyOnLock: data.googleChatNotifyOnLock ?? false
      }
    };
  } catch (e) {
    if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
        handleFirestoreError(e, OperationType.GET, `production_plans/${planId}`);
    }
    throw e;
  }
};

/**
 * Deletes a plan from Firestore.
 */
export const deletePlanFromCloud = async (planId: string) => {
    try {
        const database = getDb();
        await deleteDoc(doc(database, 'production_plans', planId));
    } catch (e) {
        if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
            handleFirestoreError(e, OperationType.DELETE, `production_plans/${planId}`);
        }
        throw e;
    }
};
