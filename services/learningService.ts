
import { collection, doc, setDoc, getDocs, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';
import { getAuthInstance, handleFirestoreError, OperationType } from './firestoreService';
import { getFirestore } from 'firebase/firestore';
import { getApp } from 'firebase/app';

export interface LearningRule {
  id: string;
  rule: string;
  timestamp: number;
  active: boolean;
  userId: string;
}

const getDb = () => getFirestore(getApp());

export const getLearnedRules = async (): Promise<LearningRule[]> => {
  try {
    const auth = getAuthInstance();
    const userId = auth.currentUser?.uid;
    if (!userId) return [];

    const db = getDb();
    const rulesCol = collection(db, 'learning_rules');
    const q = query(rulesCol, where('userId', '==', userId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as LearningRule[];
  } catch (e) {
    if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(e, OperationType.LIST, 'learning_rules');
    }
    console.error("Error fetching learning rules:", e);
    return [];
  }
};

export const addLearningRule = async (text: string): Promise<LearningRule | null> => {
  try {
    const auth = getAuthInstance();
    const userId = auth.currentUser?.uid;
    if (!userId) return null;

    const db = getDb();
    const newRuleRef = doc(collection(db, 'learning_rules'));
    const newRule: LearningRule = {
      id: newRuleRef.id,
      rule: text,
      timestamp: Date.now(),
      active: true,
      userId
    };
    
    await setDoc(newRuleRef, {
      ...newRule,
      createdAt: serverTimestamp()
    });
    
    return newRule;
  } catch (e) {
    if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(e, OperationType.CREATE, 'learning_rules');
    }
    console.error("Error adding learning rule:", e);
    return null;
  }
};

export const removeLearningRule = async (id: string): Promise<boolean> => {
  try {
    const db = getDb();
    await deleteDoc(doc(db, 'learning_rules', id));
    return true;
  } catch (e) {
    if (e instanceof Error && e.message.includes('Missing or insufficient permissions')) {
      handleFirestoreError(e, OperationType.DELETE, `learning_rules/${id}`);
    }
    console.error("Error removing learning rule:", e);
    return false;
  }
};
