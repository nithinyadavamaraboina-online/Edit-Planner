
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Worker, Workload, ProductionPlan, Batch, User, Leave } from './types';
import DailyUpdate from './components/DailyUpdate';
import NewBatchModal from './components/NewBatchModal';
import SavePlanModal from './components/SavePlanModal';
import AdminPage from './components/AdminPage'; 
import AssignWork from './components/AssignWork'; 
import SettingsModal from './components/SettingsModal';
import LeaveManagement from './components/LeaveManagement';
import PresenceList from './components/PresenceList';
import AIManager from './components/AIManager';
import { generateProductionPlan } from './services/geminiService';
import { savePlanToCloud, loadPlanFromCloud, deletePlanFromCloud, getSavedPlans, subscribeToPlan, saveDayToCloud, updatePresence, subscribeToPresence, saveAssignmentToCloud, deleteAssignmentFromCloud, signInWithGoogle, signOutUser, onAuthChange, testConnection, updateBatchesInCloud, updateWorkersInCloud, updatePlanInCloud, updateLanguagesInCloud, updateLeavesInCloud, updateProjectFieldInCloud } from './services/firestoreService';
import { Play, RefreshCw, Loader2, CheckCircle, XCircle, TrendingUp, Calendar, X, CloudUpload, FolderCheck, Check, Upload, HardDrive, Trash2, FolderOpen, Brain, Zap, Clock, Rocket, LayoutDashboard, Home, ListChecks, ArrowLeft, PenTool, ChevronRight, Plus, PieChart, Cloud, Layers, Globe, Shield, LogOut, UserCheck, Settings, Trophy, ChevronDown } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

const USER_EMAIL = 'nithin.yadav.amaraboina@gmail.com';

// Added language: 'Telugu' to default workers
const DEFAULT_WORKERS: Worker[] = [
  { id: '1', name: 'Nithin Amaraboina', role: 'Editor', genCapacity: 0, editCapacity: 9, limitations: 'Edits only. Can edit AI videos same-day.', language: 'Telugu', joiningDate: '2025-03-24' },
  { id: '2', name: 'Kishan BT', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: 'Shared capacity: Max 7 Gen OR 9 Edit OR mix', language: 'Telugu', joiningDate: '2025-10-13' },
  { id: '3', name: 'Bhavana Vajrala', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Telugu', joiningDate: '2026-03-05' },
  { id: '4', name: 'YASWANTH KUMAR', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: 'Shared capacity: Max 7 Gen OR 9 Edit OR mix', language: 'Telugu', joiningDate: '2026-02-03' },
  { id: '5', name: 'Om Ramesh Ghodke', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Telugu', joiningDate: '2026-01-10' },
  { id: '6', name: 'Monisha Lazar', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Telugu', joiningDate: '2026-02-16' },
  { id: '7', name: 'Aswathi', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Telugu', joiningDate: '2026-01-27' },
  { id: '8', name: 'Balachandra Giri', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Tamil', joiningDate: '2025-07-24' },
  { id: '9', name: 'Ganga Pethumani', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Tamil', joiningDate: '2026-03-05' },
  { id: '10', name: 'SAIGA SUDHEESH', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Malayalam', joiningDate: '2026-01-15' },
  { id: '11', name: 'ANANDHU O', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Malayalam', joiningDate: '2026-02-10' },
  { id: '12', name: 'Akhil Mathew', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Malayalam', joiningDate: '2026-02-20' },
  { id: '13', name: 'Gokulavani N', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: '', language: 'Tamil', joiningDate: '2026-02-15' },
];

const DEFAULT_LANGUAGES = ['Telugu', 'Tamil', 'Malayalam', 'Kannada'];

const INITIAL_LEAVE_BALANCES: Record<string, number> = {
  'nithin': 25,
  'bhavana': 6,
  'yaswanth': 0,
  'kishan': 9.5,
  'om': 4,
  'monisha': 0,
  'saiga': 7,
  'anandhu': 6,
  'akhil': 2,
  'aswathi': 0,
  'bala': 19,
  'gokulavani': 6,
  'ganga': 0.5
};

const getInitialTillJuneBalance = (nameStr: string): number => {
  const norm = nameStr.toLowerCase();
  for (const [key, val] of Object.entries(INITIAL_LEAVE_BALANCES)) {
      if (norm.includes(key)) {
          return val;
      }
  }
  return 0;
};

const getInitialSplit = (name: string, joiningDateStr: string) => {
  if (name.toLowerCase().includes('gokulavani')) {
      return { CL: 1, PL: 5, isAfterJune: false };
  }

  const initBalance = getInitialTillJuneBalance(name);
  const joiningDate = new Date(joiningDateStr);
  const joiningYear = joiningDate.getFullYear();
  const joiningMonth = joiningDate.getMonth();
  const joiningDay = joiningDate.getDate();

  // If they joined after June 2026, they start with 0 CL, 0 PL
  if (joiningYear > 2026 || (joiningYear === 2026 && joiningMonth > 5)) {
      return { CL: 0, PL: 0, isAfterJune: true };
  }

  // Calculate earned CL and PL from joining date up to June 2026
  let earnedCL = 0;
  let earnedPL = 0;
  let y = joiningYear;
  let m = joiningMonth;

  while (y < 2026 || (y === 2026 && m <= 5)) {
      if (y === joiningYear && m === joiningMonth) {
          if (joiningDay <= 7) {
              earnedCL += 1;
              earnedPL += 1;
          } else if (joiningDay <= 20) {
              earnedPL += 1;
          }
      } else {
          earnedCL += 1;
          earnedPL += 1;
      }
      m++;
      if (m > 11) {
          m = 0;
          y++;
      }
  }

  const totalEarned = earnedCL + earnedPL;
  if (totalEarned <= 0) {
      const cl = Math.floor(initBalance / 2);
      return { CL: cl, PL: initBalance - cl, isAfterJune: false };
  }

  const usedLeaves = totalEarned - initBalance;
  
  let initialCL = earnedCL;
  let initialPL = earnedPL;

  if (usedLeaves > 0) {
      if (usedLeaves <= initialCL) {
          initialCL -= usedLeaves;
      } else {
          initialPL -= (usedLeaves - initialCL);
          initialCL = 0;
      }
  } else if (usedLeaves < 0) {
      initialPL += Math.abs(usedLeaves);
  }

  return { CL: initialCL, PL: initialPL, isAfterJune: false };
};

const calculateLeaveBalances = (worker: Worker, viewDate: Date = new Date()) => {
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  const joiningDateStr = worker.joiningDate || '2026-02-01';
  const joiningDate = new Date(joiningDateStr);
  const joiningYear = joiningDate.getFullYear();
  const joiningMonth = joiningDate.getMonth(); // 0-indexed
  const joiningDay = joiningDate.getDate();

  // Sort leaves chronologically
  const allLeaves = (worker.leaves || []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Determine starting date for step-by-step calculations
  const { CL, PL, isAfterJune } = getInitialSplit(worker.name, joiningDateStr);

  let currentCL = CL;
  let currentPL = PL;

  let startYear = 2026;
  let startMonth = 6; // July (0-indexed 6)

  if (isAfterJune) {
      startYear = joiningYear;
      startMonth = joiningMonth;
  }

  let endYear = viewYear;
  let endMonth = viewMonth;

  const realNow = new Date();
  if (realNow.getFullYear() > endYear || (realNow.getFullYear() === endYear && realNow.getMonth() > endMonth)) {
      endYear = realNow.getFullYear();
      endMonth = realNow.getMonth();
  }

  if (allLeaves.length > 0) {
      const lastLeaveDate = new Date(allLeaves[allLeaves.length - 1].date);
      if (lastLeaveDate.getFullYear() > endYear || (lastLeaveDate.getFullYear() === endYear && lastLeaveDate.getMonth() > endMonth)) {
          endYear = lastLeaveDate.getFullYear();
          endMonth = lastLeaveDate.getMonth();
      }
  }

  let y = startYear;
  let m = startMonth;
  let balanceAtViewDate = { CL: 0, PL: 0 };

  while (y < endYear || (y === endYear && m <= endMonth)) {
      // 1. Earn leaves for this month
      if (y === joiningYear && m === joiningMonth && isAfterJune) {
          if (joiningDay <= 7) {
              currentCL += 1;
              currentPL += 1;
          } else if (joiningDay <= 20) {
              currentPL += 1;
          }
      } else {
          currentCL += 1;
          currentPL += 1;
      }

      // 2. Process and deplete leaves in this month
      const thresholdDateStr = isAfterJune ? joiningDateStr : "2026-07-01";
      const monthLeaves = allLeaves.filter(l => {
          const [ly, lm] = l.date.split('-').map(Number);
          return ly === y && (lm - 1) === m && l.date >= thresholdDateStr;
      });

      for (const leave of monthLeaves) {
          let duration = leave.duration || 1;

          if (currentCL >= duration) {
              currentCL -= duration;
          } else if (currentPL >= duration) {
              currentPL -= duration;
          } else {
              if (currentCL > 0) {
                  duration -= currentCL;
                  currentCL = 0;
              }
              if (currentPL >= duration) {
                  currentPL -= duration;
              } else {
                  if (currentPL > 0) {
                      currentPL = 0;
                  }
              }
          }
      }

      if (y === viewYear && m === viewMonth) {
          balanceAtViewDate = { CL: currentCL, PL: currentPL };
      }

      m++;
      if (m > 11) {
          m = 0;
          y++;
      }
  }

  if (viewYear < startYear || (viewYear === startYear && viewMonth < startMonth)) {
      balanceAtViewDate = { CL: CL, PL: PL };
  }

  return balanceAtViewDate;
};

const DEFAULT_WORKLOAD: Workload = {
  totalVideos: 60,
  aiVideos: 30,
  normalVideos: 30,
  deadlineDays: 5,
  projectName: 'Nerchuko',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(new Date().setDate(new Date().getDate() + 5)).toISOString().split('T')[0]
};

const App: React.FC = () => {
  // --- STANDARD APP LOGIC ---
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [workers, setWorkers] = useState<Worker[]>(DEFAULT_WORKERS);
  const [workload, setWorkload] = useState<Workload>(DEFAULT_WORKLOAD);
  const [leaves, setLeaves] = useState<Record<string, number[]>>({});
  const [batches, setBatches] = useState<Batch[]>([]);
  
  // Multi-language Support
  // Ensure unique languages by default
  const [languages, setLanguages] = useState<string[]>(DEFAULT_LANGUAGES);
  const [currentUser, setCurrentUser] = useState<User>({ role: 'lead', language: 'Telugu' });
  
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [recentPlan, setRecentPlan] = useState<ProductionPlan | null>(null);
  
  const [projectStatus, setProjectStatus] = useState<'planning' | 'active'>('planning');
  
  // Views: 'assign' | 'daily' | 'admin' | 'leaves' | 'ai-manager'
  const [currentView, setCurrentView] = useState<'assign' | 'daily' | 'admin' | 'leaves' | 'ai-manager'>('daily');

  const [projectMeta, setProjectMeta] = useState<{id?: string, name: string, notes: string, synced?: boolean} | null>(null);
  const [presence, setPresence] = useState<any[]>([]);
  const userId = authUser?.uid || Math.random().toString(36).substring(2, 15);
  const authEmail = authUser?.email;
  const isAdmin = authEmail === 'nithin.yadav.amaraboina@gmail.com';
  const currentUserWorker = useMemo(() => workers.find(w => w.email === authEmail), [workers, authEmail]);
  const isTL = currentUserWorker?.role === 'TL' || currentUserWorker?.role === 'Manager';
  const isEditor = currentUserWorker?.role === 'Editor';
  const isTeamMember = !!currentUserWorker;

  const leaveBalance = useMemo(() => {
    if (!currentUserWorker) return null;
    return calculateLeaveBalances(currentUserWorker);
  }, [currentUserWorker]);

  const hasSyncedInitialLanguage = useRef(false);

  useEffect(() => {
    if (!authEmail) {
      hasSyncedInitialLanguage.current = false;
    } else if (currentUserWorker && !hasSyncedInitialLanguage.current) {
      const userLang = currentUserWorker.language || 'Telugu';
      setCurrentUser(prev => ({
        ...prev,
        language: userLang
      }));
      hasSyncedInitialLanguage.current = true;
    }
  }, [currentUserWorker, authEmail]);

  useEffect(() => {
    if (authUser && !authLoading) {
      if (!isAdmin && !isTL && !isTeamMember) {
        setCurrentView('admin');
      } else if (currentView === 'admin' && !isAdmin && !isTL) {
        setCurrentView('daily');
      }
    }
  }, [authUser, authLoading, isAdmin, isTL, isTeamMember]);

  const [loading, setLoading] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null); 
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showLeaveDropdown, setShowLeaveDropdown] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);

  
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  const isInitialMount = useRef(true);
  const isRemoteUpdate = useRef(false);
  const isSyncing = useRef(false);
  const lastCloudSync = useRef<string | null>(null); // Track last synced data string to avoid loops
  const lastLocalUpdate = useRef<number>(0); // Track last local update timestamp
  const pendingRemoteUpdate = useRef<any>(null);
  const remoteUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const hasApiKey = !!process.env.GEMINI_API_KEY;

  // Refs for stable access in event handlers
  const workersRef = useRef(workers);
  const planRef = useRef(plan);
  const workloadRef = useRef(workload);
  const batchesRef = useRef(batches);
  const languagesRef = useRef(languages);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    workloadRef.current = workload;
  }, [workload]);

  useEffect(() => {
    batchesRef.current = batches;
  }, [batches]);

  useEffect(() => {
    languagesRef.current = languages;
  }, [languages]);

  // Helper to migrate batches
  const migrateBatches = (batches: any[]): Batch[] => {
    return (batches || []).map((b: any) => ({
      ...b,
      language: b.language || 'Telugu',
      status: b.status || 'active',
      aiVideos: Number(b.aiVideos) || 0,
      normalVideos: Number(b.normalVideos) || 0
    }));
  };

  // Calculate Global Batch Progress
  const globalBatchesProgress = useMemo(() => {
    const migrated = migrateBatches(batches);
    if (!plan) return migrated.map(b => ({...b, progress: 0, completedNormal: 0}));

    const stats: Record<string, { 
        completedGenRows: Set<string>; 
        completedEditRows: Set<string>; 
        completedNormalRows: Set<string>;
        legacyGen: number;
        legacyEdit: number;
        legacyNormal: number;
    }> = {};
    
    // Helper to parse dummies to set
    const parseDummies = (str?: string) => {
        const set = new Set<number>();
        if (!str) return set;
        str.trim().split(/[\s,]+/).forEach(s => {
            const n = parseInt(s);
            if (!isNaN(n)) set.add(n);
        });
        return set;
    };

    const parseNormalRows = (str?: string) => {
        const set = new Set<number>();
        if (!str) return set;
        str.trim().split(/[\s,]+/).forEach(s => {
            const n = parseInt(s);
            if (!isNaN(n)) set.add(n);
        });
        return set;
    };

    const normalizeToken = (s: string) => {
        const str = s.trim();
        if (!str) return null;
        const match = str.match(/^0*(\d+)([a-zA-Z]?)$/);
        if (!match) return null;
        const n = parseInt(match[1], 10);
        if (isNaN(n)) return null;
        const v = match[2].toLowerCase();
        return { raw: str, num: n, key: v ? `${n}${v}` : `${n}`, ver: v };
    };

    (plan.schedule || []).forEach(day => {
        (day.assignments || []).forEach(task => {
            if (task.batchId && task.batchId !== 'DEFAULT') {
                if (!stats[task.batchId]) {
                    stats[task.batchId] = { 
                        completedGenRows: new Set<string>(), 
                        completedEditRows: new Set<string>(), 
                        completedNormalRows: new Set<string>(),
                        legacyGen: 0,
                        legacyEdit: 0,
                        legacyNormal: 0
                    };
                }
                
                const isTaskCompleted = (task.status || 'Completed') === 'Completed' || task.status === 'Rework';
                if (isTaskCompleted) {
                    const batch = migrated.find(b => b.id === task.batchId);
                    const dummySet = batch ? parseDummies(batch.dummyRows) : new Set<number>();
                    const normalSet = batch ? parseNormalRows(batch.normalRows) : new Set<number>();

                    if (task.assignedGenRows && task.assignedGenRows.trim().length > 0) {
                        const tokens = task.assignedGenRows.trim().split(/[\s,]+/).filter(Boolean);
                        tokens.forEach(tokStr => {
                            const t = normalizeToken(tokStr);
                            if (t && !dummySet.has(t.num)) {
                                stats[task.batchId].completedGenRows.add(t.key);
                            }
                        });
                    } else {
                        stats[task.batchId].legacyGen += task.generations;
                    }

                    if (task.assignedEditRows && task.assignedEditRows.trim().length > 0) {
                        const tokens = task.assignedEditRows.trim().split(/[\s,]+/).filter(Boolean);
                        tokens.forEach(tokStr => {
                            const t = normalizeToken(tokStr);
                            if (t && !dummySet.has(t.num)) {
                                if (!t.ver && normalSet.has(t.num)) {
                                    stats[task.batchId].completedNormalRows.add(t.key);
                                } else {
                                    stats[task.batchId].completedEditRows.add(t.key);
                                }
                            }
                        });
                    } else {
                        stats[task.batchId].legacyEdit += task.edits;
                    }
                }
            }
        });
    });

    return migrated.map(b => {
        const s = stats[b.id];
        let assignedGen = 0;
        let assignedEdit = 0;
        let assignedNormal = 0;

        if (s) {
            assignedGen += s.legacyGen;
            assignedEdit += s.legacyEdit;
            assignedNormal += s.legacyNormal;
        }

        const dummySet = parseDummies(b.dummyRows);
        const normalSet = parseNormalRows(b.normalRows);
        const start = b.startRow !== undefined ? b.startRow : 2;
        const end = b.endRow !== undefined ? b.endRow : (b.aiVideos + b.normalVideos + start - 1);

        for (let i = start; i <= end; i++) {
            if (dummySet.has(i)) continue;

            // AI Video Gen (counted regardless of normal/AI status if completed)
            if (s && (s.completedGenRows.has(`${i}`) || s.completedGenRows.has(`${i}h`) || s.completedGenRows.has(`${i}v`) || s.completedGenRows.has(`${i}s`))) {
                assignedGen += 1;
            }

            if (normalSet.has(i)) {
                if (s && s.completedNormalRows.has(`${i}`)) {
                    assignedNormal += 1;
                }
            } else {
                // AI Video Edit
                if (s) {
                    const hasBase = s.completedEditRows.has(`${i}`);
                    const hasH = s.completedEditRows.has(`${i}h`);
                    const hasV = s.completedEditRows.has(`${i}v`);
                    const hasS = s.completedEditRows.has(`${i}s`);
                    
                    if (b.horizontalVersions || b.verticalVersions || b.squareVersions) {
                        if (hasBase) {
                            assignedEdit += 1;
                        } else {
                            let score = 0;
                            if (b.horizontalVersions && hasH) score += 0.25;
                            if (b.verticalVersions && hasV) score += 0.25;
                            if (b.squareVersions && hasS) score += 0.25;
                            assignedEdit += score;
                        }
                    } else {
                        if (hasBase) {
                            assignedEdit += 1;
                        }
                    }
                }
            }
        }

        const versionsTotal = ((b.horizontalVersions || 0) + (b.verticalVersions || 0) + (b.squareVersions || 0)) * 0.25;
        const total = b.aiVideos + (b.aiVideos + b.normalVideos) + versionsTotal;
        const done = assignedGen + assignedEdit + assignedNormal;

        // Check for physical pending rows in the actual row range
        let hasPendingRow = false;
        for (let i = start; i <= end; i++) {
            if (dummySet.has(i)) continue;
            
            if (normalSet.has(i)) {
                if (!s || !s.completedNormalRows.has(`${i}`)) {
                    hasPendingRow = true;
                    break;
                }
            } else {
                // AI Video Gen Check
                const isGenDone = s && (s.completedGenRows.has(`${i}`) || s.completedGenRows.has(`${i}h`) || s.completedGenRows.has(`${i}v`) || s.completedGenRows.has(`${i}s`));
                if (!isGenDone) {
                    hasPendingRow = true;
                    break;
                }
                
                // AI Video Edit Check
                if (!s) {
                    hasPendingRow = true;
                    break;
                }
                const hasBase = s.completedEditRows.has(`${i}`);
                if (!hasBase) {
                    let editPending = false;
                    if (b.horizontalVersions && !s.completedEditRows.has(`${i}h`)) editPending = true;
                    if (b.verticalVersions && !s.completedEditRows.has(`${i}v`)) editPending = true;
                    if (b.squareVersions && !s.completedEditRows.has(`${i}s`)) editPending = true;
                    if (!b.horizontalVersions && !b.verticalVersions && !b.squareVersions) editPending = true;
                    
                    if (editPending) {
                        hasPendingRow = true;
                        break;
                    }
                }
            }
        }

        let p = total > 0 ? Math.round((done / total) * 100) : 0;
        if (hasPendingRow && p >= 100) {
            p = 99; // Cap at 99% if we physically have pending unassigned/uncompleted rows
        }

        return {
            ...b,
            completedGen: assignedGen,
            completedEdit: assignedEdit + assignedNormal,
            completedNormal: assignedNormal,
            totalGen: b.aiVideos,
            totalEdit: b.aiVideos + b.normalVideos + versionsTotal,
            totalNormal: b.normalVideos,
            totalVersions: (b.horizontalVersions || 0) + (b.verticalVersions || 0) + (b.squareVersions || 0),
            progress: Math.min(100, Math.max(0, p))
        };
    });
  }, [plan, batches, workers]);

  // --- FILTERING LOGIC ---
  const filteredWorkers = useMemo(() => {
    if (!Array.isArray(workers)) return [];
    
    // 1. Filter by language first (existing logic)
    let list = (workers || []).filter(w => (w.language || 'Telugu') === currentUser.language);
    
    // 2. Apply access control
    if (isAdmin || isTL) {
        return list;
    }
    
    if (isTeamMember) {
        // Show the entire team
        return list;
    }
    
    // If not part of the team, show nothing
    return []; 
  }, [workers, currentUser.language, isAdmin, isTL, isTeamMember, authEmail]);

  const filteredBatches = useMemo(() => {
    if (!Array.isArray(globalBatchesProgress)) return [];
    const list = (globalBatchesProgress || []).filter(b => (b.language || 'Telugu') === currentUser.language);
    
    // Sort logic: active (progress < 100) first, then completed (progress === 100)
    // Newest first within each group
    const ongoing = list.filter(b => (b.progress || 0) < 100).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });

    const completed = list.filter(b => (b.progress || 0) === 100).sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });

    // Show only the last completed batch
    const lastCompleted = completed.length > 0 ? [completed[0]] : [];
    
    return [...ongoing, ...lastCompleted];
  }, [globalBatchesProgress, currentUser.language]);

  const otherLangsWithWorkers = useMemo(() => {
    if (!Array.isArray(workers)) return [];
    const langs = new Set(workers.map(w => w.language || 'Telugu'));
    langs.delete(currentUser.language);
    return Array.from(langs);
  }, [workers, currentUser.language]);

  // Initial Load Logic
  useEffect(() => {
    testConnection();
    if (authLoading) return;

    const initialize = async () => {
      // Load user preferences from local storage
      const savedPrefs = localStorage.getItem('wedo_preferences');
      if (savedPrefs) {
        try {
          const parsed = JSON.parse(savedPrefs);

          if (parsed.currentUser) setCurrentUser(parsed.currentUser);
        } catch (e) {
          console.error("Failed to load preferences", e);
        }
      }

      if (!authUser) {
          return;
      }

      setLoading(true);

      try {
        let cloudData = null;
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('id');

        if (urlProjectId) {
            cloudData = await loadPlanFromCloud(urlProjectId);
        } else {
            const plans = await getSavedPlans();
            if (plans && plans.length > 0) {
                cloudData = await loadPlanFromCloud(plans[0].id);
            }
        }

        if (cloudData) {
             // Migration for Cloud Data
             const migratedWorkers = (cloudData.workers || []).map((w: Worker) => ({ ...w, language: w.language || 'Telugu' }));
             const migratedBatches = (cloudData.batches || []).map((b: Batch) => ({ ...b, language: b.language || 'Telugu' }));
             
             setWorkers(migratedWorkers);
             setWorkload(cloudData.workload);
             setPlan(cloudData.plan);
             if (cloudData.batches) setBatches(migrateBatches(cloudData.batches));
             setProjectMeta(cloudData.projectMeta);
             setProjectStatus('active'); 
             setRecentPlan(null);
             
             // Update URL to reflect the current project ID
             if (cloudData.projectMeta?.id) {
                 window.history.replaceState({}, '', '?id=' + cloudData.projectMeta.id);
             }
             
             // Load languages if available, otherwise default
             if (cloudData.languages && Array.isArray(cloudData.languages)) {
                 setLanguages(Array.from(new Set([...DEFAULT_LANGUAGES, ...cloudData.languages])));
             }

             const isUserAdmin = authUser.email === 'nithin.yadav.amaraboina@gmail.com';
             const userWorker = migratedWorkers.find((w: Worker) => w.email === authUser.email);
             const isUserTL = userWorker?.role === 'TL' || userWorker?.role === 'Manager';
             const isUserTeamMember = !!userWorker;

             if (!isUserAdmin && !isUserTL && !isUserTeamMember) {
                 setCurrentView('admin');
             } else {
                 setCurrentView('daily'); 
             }
        } else {
             handleManualStart();
        }

      } catch (e) {
        console.error("Error during initialization:", e);
        handleManualStart();
      } finally {
        setLoading(false);
        setCloudSaving(false);
      }
    };

    initialize();
  }, [authUser, authLoading]);

  // Real-time Cloud Subscription
  useEffect(() => {
      if (projectStatus === 'active' && projectMeta?.id) {
          console.log("Subscribing to plan:", projectMeta.id);
          const unsubscribe = subscribeToPlan(projectMeta.id, (data) => {
              try {
                  if (!data) return;

                  // Create a hash or string representation to check if data actually changed
                  const dataString = JSON.stringify({
                      workers: data.workers,
                      workload: data.workload,
                      batches: data.batches,
                      plan: data.plan,
                      languages: data.languages
                  });

                  if (dataString === lastCloudSync.current) {
                      pendingRemoteUpdate.current = null;
                      return; // No actual change
                  }

                  const applyRemoteUpdate = (remoteData: any) => {
                      console.log("Applying remote update");
                      isRemoteUpdate.current = true;
                      isSyncing.current = true;
                      lastCloudSync.current = JSON.stringify({
                          workers: remoteData.workers,
                          workload: remoteData.workload,
                          batches: remoteData.batches,
                          plan: remoteData.plan,
                          languages: remoteData.languages
                      });
                      
                      if (remoteData.workers && Array.isArray(remoteData.workers)) {
                          setWorkers(prev => JSON.stringify(prev) !== JSON.stringify(remoteData.workers) ? remoteData.workers : prev);
                      }
                      if (remoteData.workload && typeof remoteData.workload === 'object') {
                          setWorkload(prev => JSON.stringify(prev) !== JSON.stringify(remoteData.workload) ? remoteData.workload : prev);
                      }
                      if (remoteData.batches && Array.isArray(remoteData.batches)) {
                          const migrated = migrateBatches(remoteData.batches);
                          setBatches(prev => JSON.stringify(prev) !== JSON.stringify(migrated) ? migrated : prev);
                      }
                      if (remoteData.plan && typeof remoteData.plan === 'object') {
                          setPlan(prev => JSON.stringify(prev) !== JSON.stringify(remoteData.plan) ? remoteData.plan : prev);
                      }
                      
                      if (remoteData.projectMeta && typeof remoteData.projectMeta === 'object') {
                          setProjectMeta(prev => {
                              const metaString = JSON.stringify({ name: remoteData.projectMeta.name, notes: remoteData.projectMeta.notes });
                              const prevString = JSON.stringify({ name: prev?.name, notes: prev?.notes });
                              if (metaString === prevString && prev?.synced) return prev;
                              return { ...prev, ...remoteData.projectMeta, synced: true };
                          });
                      }

                      if (remoteData.languages && Array.isArray(remoteData.languages)) {
                          setLanguages(prev => {
                              const combined = Array.from(new Set([...DEFAULT_LANGUAGES, ...remoteData.languages]));
                              return JSON.stringify(prev) !== JSON.stringify(combined) ? combined : prev;
                          });
                      }

                      setTimeout(() => {
                          isSyncing.current = false;
                          isRemoteUpdate.current = false;
                      }, 500);
                  };

                  const timeSinceLastLocal = Date.now() - lastLocalUpdate.current;
                  if (timeSinceLastLocal < 2000) {
                      console.log("Deferring remote update due to recent local changes");
                      pendingRemoteUpdate.current = data;
                      if (remoteUpdateTimer.current) clearTimeout(remoteUpdateTimer.current);
                      remoteUpdateTimer.current = setTimeout(() => {
                          if (pendingRemoteUpdate.current && Date.now() - lastLocalUpdate.current >= 2000) {
                              applyRemoteUpdate(pendingRemoteUpdate.current);
                              pendingRemoteUpdate.current = null;
                          }
                      }, 2000 - timeSinceLastLocal);
                      return;
                  }

                  applyRemoteUpdate(data);
              } catch (err) {
                  console.error("Error processing remote update:", err);
              }
          });
          return () => unsubscribe();
      }
  }, [projectStatus, projectMeta?.id]);

  // Save User Preferences and Force Light Mode
  useEffect(() => {
    document.documentElement.classList.remove('dark');
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    try {
      localStorage.setItem('wedo_preferences', JSON.stringify({ currentUser }));
    } catch (e) {
      console.error("Failed to save preferences", e);
    }
  }, [currentUser]);

  // Continuous Auto-Save to Cloud
  useEffect(() => {
    if (isInitialMount.current || isSyncing.current || isRemoteUpdate.current) {
      return;
    }
    
    // Deep comparison check to prevent unnecessary cloud writes
    const currentStateString = JSON.stringify({
        workers,
        workload,
        batches: globalBatchesProgress,
        plan,
        languages
    });

    if (currentStateString === lastCloudSync.current) {
        return;
    }

    // Debounce for 30 seconds
    const timer = setTimeout(() => {
        autoSaveToCloud();
    }, 30000);

    return () => clearTimeout(timer);
  }, [workers, workload, batches, globalBatchesProgress, plan, languages]);

  // Track local updates to prevent remote overwrites
  useEffect(() => {
    if (isRemoteUpdate.current) {
        // This change came from the server, so don't update lastLocalUpdate
        return;
    }
    lastLocalUpdate.current = Date.now();
  }, [workers, batches, languages, workload]);

  // Local sliding history checkpoints
  useEffect(() => {
    if (!workers || workers.length === 0) return;
    try {
      const backupStr = localStorage.getItem('wedo_workers_checkpoints');
      let backups = backupStr ? JSON.parse(backupStr) : [];
      if (!Array.isArray(backups)) backups = [];
      
      const currentHash = JSON.stringify(workers);
      const lastBackup = backups[backups.length - 1];
      
      if (!lastBackup || JSON.stringify(lastBackup.workers) !== currentHash) {
        const leavesCount = workers.reduce((sum, w) => sum + (w.leaves?.length || 0), 0);
        
        // Push new rolling checkpoint (restrict to 30)
        backups.push({
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
          label: `Auto-Save (${new Date().toLocaleTimeString()}) - ${leavesCount} Leaves`,
          workers: workers
        });
        
        if (backups.length > 30) {
          backups.shift();
        }
        
        localStorage.setItem('wedo_workers_checkpoints', JSON.stringify(backups));
      }
    } catch (e) {
      console.error("Failed to write sliding history checkpoint", e);
    }
  }, [workers]);

  // Presence Tracking
  useEffect(() => {
    if (!projectMeta?.id || !authUser) return;
    
    // Initial update
    updatePresence(projectMeta.id, userId, authUser.email || USER_EMAIL, currentUser.role, currentUser.language);
    
    // Periodic update every 2 minutes
    const interval = setInterval(() => {
        updatePresence(projectMeta.id, userId, authUser.email || USER_EMAIL, currentUser.role, currentUser.language);
    }, 120000);
    
    const unsubPresence = subscribeToPresence(projectMeta.id, setPresence);
    
    return () => {
        clearInterval(interval);
        unsubPresence();
    };
  }, [projectMeta?.id, userId, currentUser, authUser]);

  // Filter for Sidebar
  const activeBatchesProgress = useMemo(() => {
      return (globalBatchesProgress || [])
        .filter(b => b.status === 'active' && (b.language || 'Telugu') === currentUser.language && b.progress < 100);
  }, [globalBatchesProgress, currentUser.language]);

  const handleGeneratePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const generatedPlan = await generateProductionPlan(workers, workload, leaves, process.env.GEMINI_API_KEY);
      setPlan(generatedPlan);
      setProjectStatus(projectMeta?.id ? 'active' : 'planning'); 
      setRecentPlan(null); 
      setCurrentView('daily');
      
      setProjectMeta(prev => ({
        ...prev,
        name: workload.projectName,
        notes: prev?.notes || '',
        synced: false
      }));
      
      // If we already have a project ID, auto-save the newly generated plan to it
      // so that other connected clients see the new plan immediately.
      if (projectMeta?.id) {
          const dataString = JSON.stringify({
              workers,
              workload,
              batches,
              plan: generatedPlan,
              languages
          });
          lastCloudSync.current = dataString;
          
          savePlanToCloud(
              workload.projectName, 
              projectMeta?.notes || '', 
              workers, 
              workload, 
              generatedPlan, 
              batches, 
              languages, 
              leaves,
              projectMeta.id, 
              false
          ).then(() => {
              setProjectMeta(prev => prev ? { ...prev, synced: true } : prev);
          }).catch(e => console.error("Auto-save generated plan failed", e));
      }
    } catch (err: any) {
      setError(err.message || 'Failed to generate plan.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualStart = () => {
      const emptyPlan: ProductionPlan = {
          schedule: [],
          summary: { totalGenerations: 0, totalEdits: 0, daysAvailable: 0, feasible: true },
          bottlenecks: { generation: false, editing: false, limitingRole: '' },
          constraints: [],
          risks: []
      };
      setWorkers(DEFAULT_WORKERS);
      setWorkload(DEFAULT_WORKLOAD);
      setPlan(emptyPlan);
      setProjectStatus('planning');
      setRecentPlan(null);
      setProjectMeta(prev => ({
          name: DEFAULT_WORKLOAD.projectName,
          notes: prev?.notes || '',
          synced: false
      }));
      window.history.replaceState({}, '', window.location.pathname);
  };

  const autoSaveToCloud = async (overrides: { plan?: ProductionPlan | null, batches?: Batch[] } = {}) => {
    if (isSyncing.current || isRemoteUpdate.current) return;
    const planToSave = overrides.plan !== undefined ? overrides.plan : plan;
    const batchesToSave = overrides.batches !== undefined ? overrides.batches : globalBatchesProgress;

    if (!planToSave || !projectMeta?.id) return;

    setCloudSaving(true);
    try {
       const name = projectMeta?.name || workload.projectName;
       const notes = projectMeta?.notes || '';
       
       // Update lastCloudSync before saving to prevent loop
       const dataString = JSON.stringify({
           workers: workersRef.current,
           workload: workloadRef.current,
           batches: batchesToSave,
           plan: planToSave,
           languages: languagesRef.current
       });
       lastCloudSync.current = dataString;

       await savePlanToCloud(name, notes, workers, workload, planToSave, batchesToSave, languages, leaves, projectMeta.id, true);
       
       setProjectMeta(prev => {
         if (!prev) return prev;
         if (prev.synced) return prev;
         return { ...prev, synced: true };
       });
    } catch(e) {
       console.error("Auto-save to cloud failed", e);
    } finally {
       setCloudSaving(false);
    }
  };

  const handleSaveBatch = async (batchData: Omit<Batch, 'id' | 'status' | 'createdAt'>) => {
      let finalBatches: Batch[];
      if (editingBatch) {
        // Edit Mode
        finalBatches = batches.map(b => b.id === editingBatch.id ? { 
            ...b, 
            ...batchData 
        } : b);
      } else {
        // Create Mode
        const newBatch: Batch = {
            ...batchData,
            id: Math.random().toString(36).substr(2, 9),
            status: 'active',
            createdAt: new Date().toISOString(),
            language: currentUser.language // Assign current view language
        };
        finalBatches = [...batches, newBatch];
      }
      setShowBatchModal(false);
      setEditingBatch(null);

      setBatches(finalBatches);
      lastLocalUpdate.current = Date.now();

      if (projectMeta?.id) {
          const dataString = JSON.stringify({
              workers: workersRef.current,
              workload: workloadRef.current,
              batches: finalBatches,
              plan: planRef.current,
              languages: languagesRef.current
          });
          lastCloudSync.current = dataString;
          await updateBatchesInCloud(projectMeta.id, finalBatches);
      }
  };
  
  const handleEditBatch = (batch: Batch) => {
      setEditingBatch(batch);
      setShowBatchModal(true);
  };

  const handleDeleteBatch = async (batchId: string) => {
      const newBatches = (batches || []).filter(b => b.id !== batchId);
      
      let newPlan = plan;
      if (plan) {
          const newSchedule = plan.schedule.map(day => ({
              ...day,
              assignments: day.assignments.map(task => 
                  task.batchId === batchId 
                    ? { ...task, batchId: 'DEFAULT' } 
                    : task
              )
          }));
          newPlan = { ...plan, schedule: newSchedule };
      }

      setBatches(newBatches);
      if (newPlan) setPlan(newPlan);
      lastLocalUpdate.current = Date.now();

      if (projectMeta?.id) {
          const dataString = JSON.stringify({
              workers: workersRef.current,
              workload: workloadRef.current,
              batches: newBatches,
              plan: newPlan || planRef.current,
              languages: languagesRef.current
          });
          lastCloudSync.current = dataString;

          await updateBatchesInCloud(projectMeta.id, newBatches);
          if (newPlan) {
              await updatePlanInCloud(projectMeta.id, newPlan);
          }
      }
  };

  const handleWorkerUpdate = async (updatedWorkers: Worker[], basePlan?: ProductionPlan) => {
      const currentPlan = basePlan || planRef.current;
      let currentPlanToSave = currentPlan;
      let newLeavesState: Record<string, number[]> | undefined;

      // Sync leaves to Plan & State
      if (currentPlan) {
          // 1. Update leaves state (indices)
          newLeavesState = {};
          
          updatedWorkers.forEach(w => {
              if (w.leaves && w.leaves.length > 0) {
                  const indices: number[] = [];
                  w.leaves.forEach(l => {
                      // Parse manually to ensure consistent date math
                      const [ly, lm, ld] = l.date.split('-').map(Number);
                      const [sy, sm, sd] = workload.startDate.split('-').map(Number);
                      
                      // Construct UTC dates
                      const lDate = new Date(Date.UTC(ly, lm - 1, ld));
                      const sDate = new Date(Date.UTC(sy, sm - 1, sd));
                      
                      const diffTime = lDate.getTime() - sDate.getTime();
                      const dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      
                      if (dayIndex > 0) indices.push(dayIndex);
                  });
                  newLeavesState[w.id] = indices;
              }
          });

          // 2. Update Plan Schedule
          const newSchedule = currentPlan.schedule.map(day => {
              const newAssignments = day.assignments.map(a => {
                  const worker = updatedWorkers.find(w => w.id === a.workerId);
                  
                  // Check leave using Day Index math to be 100% consistent with leaves state
                  const leave = worker?.leaves?.find(l => {
                      const [ly, lm, ld] = l.date.split('-').map(Number);
                      const [sy, sm, sd] = workload.startDate.split('-').map(Number);
                      const lDate = new Date(Date.UTC(ly, lm - 1, ld));
                      const sDate = new Date(Date.UTC(sy, sm - 1, sd));
                      const diffTime = lDate.getTime() - sDate.getTime();
                      const dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
                      return dayIndex === day.day;
                  });
                  
                  const isOnLeave = !!leave && (leave.duration || 1) === 1;
                  const isHalfDay = !!leave && (leave.duration || 1) === 0.5;
                  
                  if (a.isOnLeave !== isOnLeave || a.isHalfDay !== isHalfDay || a.batchId === 'LEAVE' || a.batchId === 'HALF_DAY') {
                      return {
                          ...a,
                          isOnLeave: isOnLeave,
                          isHalfDay: isHalfDay,
                          batchId: (isOnLeave || isHalfDay) ? undefined : (a.batchId === 'LEAVE' || a.batchId === 'HALF_DAY' ? undefined : a.batchId),
                          generations: (isOnLeave || isHalfDay) ? 0 : a.generations,
                          edits: (isOnLeave || isHalfDay) ? 0 : a.edits
                      };
                  }
                  return a;
              });
              
              return {
                  ...day,
                  assignments: newAssignments,
                  dailyTotalGen: newAssignments.reduce((sum, a) => sum + (a.generations || 0), 0),
                  dailyTotalEdit: newAssignments.reduce((sum, a) => sum + (a.edits || 0), 0)
              };
          });

          currentPlanToSave = { 
              ...currentPlan, 
              schedule: newSchedule,
              summary: {
                  ...currentPlan.summary,
                  totalGenerations: newSchedule.reduce((sum, d) => sum + d.dailyTotalGen, 0),
                  totalEdits: newSchedule.reduce((sum, d) => sum + d.dailyTotalEdit, 0)
              }
          };
          
          setLeaves(newLeavesState);
          setPlan(currentPlanToSave);
      }
      
      setWorkers(updatedWorkers);
      lastLocalUpdate.current = Date.now();
      
      // Trigger cloud save if we have a plan ID
      if (projectMeta?.id && currentPlanToSave) {
          setCloudSaving(true);
          try {
              const dataString = JSON.stringify({
                  workers: updatedWorkers,
                  workload: workloadRef.current,
                  batches: batchesRef.current,
                  plan: currentPlanToSave,
                  languages: languagesRef.current
              });
              lastCloudSync.current = dataString;

              await updateWorkersInCloud(projectMeta.id, updatedWorkers);
              await updatePlanInCloud(projectMeta.id, currentPlanToSave);
              if (newLeavesState) {
                  await updateLeavesInCloud(projectMeta.id, newLeavesState);
              }
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
          } catch (e) {
              console.error("Error saving workers:", e);
              setError("Failed to save worker changes");
          } finally {
              setCloudSaving(false);
          }
      } else if (!projectMeta?.id && !isSyncing.current && currentPlanToSave) {
          console.log("Auto-saving new project to cloud from worker update");
          const defaultName = workloadRef.current.projectName || `Project ${new Date().toLocaleDateString()}`;
          savePlanToCloud(defaultName, '', updatedWorkers, workloadRef.current, currentPlanToSave, batchesRef.current, languagesRef.current, newLeavesState || leaves, undefined).then(id => {
              setProjectMeta({ id, name: defaultName, notes: '', synced: true });
              setProjectStatus('active');
              window.history.replaceState({}, '', '?id=' + id);
          }).catch(e => console.error("Failed to auto-save new project", e));
      } else if (projectMeta?.id) {
          setCloudSaving(true);
          try {
              const dataString = JSON.stringify({
                  workers: updatedWorkers,
                  workload,
                  batches,
                  plan,
                  languages
              });
              lastCloudSync.current = dataString;

              await updateWorkersInCloud(projectMeta.id, updatedWorkers);
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
          } catch (e) {
              console.error("Error saving workers:", e);
              setError("Failed to save worker changes");
          } finally {
              setCloudSaving(false);
          }
      }
  };

  const planMetaSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const granularSaveTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});

  const handlePlanUpdate = (newPlan: ProductionPlan, saveToCloud: boolean = false, dayToSave?: number, assignmentId?: string, isDeletion: boolean = false) => {
      console.log("handlePlanUpdate called:", { saveToCloud, dayToSave, assignmentId, isDeletion, projectMetaId: projectMeta?.id, isSyncing: isSyncing.current });
      setPlan(newPlan);
      lastLocalUpdate.current = Date.now();
      
      // Update lastCloudSync to include the new plan so we ignore the echo from Firestore
      const dataString = JSON.stringify({
          workers: workersRef.current,
          workload: workloadRef.current,
          batches: batchesRef.current,
          plan: newPlan,
          languages: languagesRef.current
      });
      lastCloudSync.current = dataString;
      
      if (projectMeta?.id && !isSyncing.current) {
          console.log("Conditions met for saving to cloud");
          // If granular day update is requested, debounce it
          if (saveToCloud && dayToSave !== undefined) {
              console.log("Granular day update requested for day:", dayToSave);
              const dayPlan = newPlan.schedule.find(d => d.day === dayToSave);
              if (dayPlan) {
                  const saveKey = assignmentId ? `day_${dayToSave}_assign_${assignmentId}` : `day_${dayToSave}`;
                  
                  if (granularSaveTimeoutsRef.current[saveKey]) {
                      clearTimeout(granularSaveTimeoutsRef.current[saveKey]);
                  }
                  
                  granularSaveTimeoutsRef.current[saveKey] = setTimeout(() => {
                      if (assignmentId) {
                          if (isDeletion) {
                              console.log("Deleting assignment:", assignmentId);
                              deleteAssignmentFromCloud(projectMeta.id!, dayPlan, assignmentId).catch(e => console.error("Granular delete failed", e));
                          } else {
                              const assignment = dayPlan.assignments.find(a => (a.id || a.workerId) === assignmentId);
                              if (assignment) {
                                  console.log("Saving assignment:", assignment);
                                  saveAssignmentToCloud(projectMeta.id!, dayPlan, assignment).catch(e => console.error("Granular assignment save failed", e));
                              } else {
                                  console.warn("Assignment not found for id:", assignmentId);
                              }
                          }
                      } else {
                          console.log("Saving entire day:", dayPlan);
                          saveDayToCloud(projectMeta.id!, dayPlan).catch(e => console.error("Granular day save failed", e));
                      }
                      delete granularSaveTimeoutsRef.current[saveKey];
                  }, 1000);
              } else {
                  console.warn("Day plan not found for day:", dayToSave);
              }
          }
          
          // Always debounce a save of the plan metadata (summary, bottlenecks, etc.)
          // This ensures that total generations/edits are synced even when only an assignment is updated
          console.log("Debouncing plan meta save");
          if (planMetaSaveTimeoutRef.current) {
              clearTimeout(planMetaSaveTimeoutRef.current);
          }
          planMetaSaveTimeoutRef.current = setTimeout(() => {
              console.log("Executing debounced plan meta save");
              if (projectMeta?.id) {
                  updatePlanInCloud(projectMeta.id, newPlan, true).catch(e => console.error("Plan meta save failed", e));
              }
          }, 2000);
      } else if (!projectMeta?.id && saveToCloud && !isSyncing.current) {
          console.log("Auto-saving new project to cloud");
          const defaultName = workloadRef.current.projectName || `Project ${new Date().toLocaleDateString()}`;
          savePlanToCloud(defaultName, '', workersRef.current, workloadRef.current, newPlan, batchesRef.current, languagesRef.current, leaves, undefined).then(id => {
              setProjectMeta({ id, name: defaultName, notes: '', synced: true });
              setProjectStatus('active');
              window.history.replaceState({}, '', '?id=' + id);
          }).catch(e => console.error("Failed to auto-save new project", e));
      } else {
          console.log("Skipping cloud save. projectMeta.id:", projectMeta?.id, "isSyncing:", isSyncing.current);
      }
  };

  const handleSavePlan = async (name: string, notes: string) => {
      if (!plan || isSyncing.current) return;
      
      setLoading(true);
      try {
          const dataString = JSON.stringify({
              workers: workersRef.current,
              workload: workloadRef.current,
              batches: batchesRef.current,
              plan: planRef.current,
              languages: languagesRef.current
          });
          lastCloudSync.current = dataString;

          // 1. Save to Cloud
          const id = await savePlanToCloud(name, notes, workers, workload, plan, batches, languages, leaves, projectMeta?.id);
          
          // 2. Update Local State
          setProjectMeta({ id, name, notes, synced: true });
          setProjectStatus('active'); // Activate the project
          setShowSaveModal(false);
          window.history.replaceState({}, '', '?id=' + id);
          
          // 3. Force auto-save to ensure consistency
          await autoSaveToCloud({ plan });
      } catch (e) {
          console.error("Failed to save plan:", e);
          setError("Failed to save plan to cloud. Please try again.");
      } finally {
          setLoading(false);
      }
  };

  const showToast = (msg: string) => {
      setToastMessage(msg);
      setTimeout(() => setToastMessage(null), 3000);
  };

  const handleExportData = () => {
      const dataToExport = {
          workers,
          workload,
          batches,
          plan,
          leaves,
          languages,
          projectMeta,
          projectStatus,
          exportDate: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wedo_planner_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
  };

  const handleImportData = async (data: any) => {
      try {
          const currentLiveId = projectMeta?.id;
          const targetId = currentLiveId || data.projectMeta?.id;
          
          if (data.workers) setWorkers(data.workers);
          if (data.workload) setWorkload(data.workload);
          if (data.batches) setBatches(migrateBatches(data.batches));
          if (data.plan) setPlan(data.plan);
          if (data.leaves) setLeaves(data.leaves);
          if (data.languages) setLanguages(data.languages);
          
          const newMeta = {
              ...(data.projectMeta || projectMeta || {}),
              id: targetId,
              name: data.projectMeta?.name || projectMeta?.name || workload.projectName,
              synced: true
          };
          setProjectMeta(newMeta);
          
          if (targetId) {
              setProjectStatus('active');
              if (targetId !== currentLiveId) {
                  window.history.replaceState({}, '', '?id=' + targetId);
              }
          } else if (data.projectStatus) {
              setProjectStatus(data.projectStatus);
          }
          
          if (targetId && data.plan) {
              setLoading(true);
              
              const importedWorkers = data.workers || workers;
              const importedWorkload = data.workload || workload;
              const importedBatches = data.batches ? migrateBatches(data.batches) : batches;
              const importedLanguages = data.languages || languages;
              
              const dataString = JSON.stringify({
                  workers: importedWorkers,
                  workload: importedWorkload,
                  batches: importedBatches,
                  plan: data.plan,
                  languages: importedLanguages
              });
              
              lastCloudSync.current = dataString;
              lastLocalUpdate.current = Date.now();

              await savePlanToCloud(
                  newMeta.name, 
                  newMeta.notes || '', 
                  importedWorkers, 
                  importedWorkload, 
                  data.plan, 
                  importedBatches, 
                  importedLanguages, 
                  data.leaves || {},
                  targetId,
                  false
              );
              
              setLoading(false);
          }
          
          showToast("Data imported and synced to team successfully!");
      } catch (e) {
          console.error("Error importing data:", e);
          showToast("Failed to import data. The file might be corrupted.");
          setLoading(false);
      }
  };

  const toggleLeave = (workerId: string, day: number, forceState?: boolean, basePlan?: ProductionPlan, duration: number = 1) => {
    // 1. Calculate Date String (UTC) - Consistent with handleWorkerUpdate
    const [sy, sm, sd] = workload.startDate.split('-').map(Number);
    const date = new Date(Date.UTC(sy, sm - 1, sd));
    date.setUTCDate(date.getUTCDate() + (day - 1));
    const dateStr = date.toISOString().split('T')[0];

    // 2. Determine current state from WORKERS REF (Source of Truth)
    const currentWorkers = workersRef.current;
    const worker = currentWorkers.find(w => w.id === workerId);
    if (!worker) return;

    const currentLeaves = worker.leaves || [];
    const existingLeave = currentLeaves.find(l => l.date === dateStr);
    const isAlreadyOnLeave = !!existingLeave;
    
    // If we are forcing a state and the duration is different, we should treat it as a change
    const isDurationDifferent = existingLeave && existingLeave.duration !== duration;
    const shouldBeOnLeave = forceState !== undefined ? forceState : !isAlreadyOnLeave;

    if (shouldBeOnLeave === isAlreadyOnLeave && !isDurationDifferent) {
        // Even if worker state doesn't change, if we have a basePlan (from DailyUpdate),
        // we must ensure it gets saved/updated because it might contain new assignments.
        if (basePlan) {
             handleWorkerUpdate(currentWorkers, basePlan);
        }
        return;
    }

    // 3. Create Updated Worker List
    const updatedWorkers = currentWorkers.map(w => {
        if (w.id === workerId) {
            // First remove any existing leave for this date if we are adding or swapping
            const filteredLeaves = (w.leaves || []).filter(l => l.date !== dateStr);
            
            if (shouldBeOnLeave) {
                return {
                    ...w,
                    leaves: [...filteredLeaves, {
                        id: Math.random().toString(36).substr(2, 9),
                        workerId,
                        date: dateStr,
                        duration: duration,
                        type: 'paid' // Default
                    } as Leave]
                };
            } else {
                return {
                    ...w,
                    leaves: filteredLeaves
                };
            }
        }
        return w;
    });

    // 4. Propagate Updates (State, Plan, Cloud)
    handleWorkerUpdate(updatedWorkers, basePlan);
  };

  const handleLanguageChange = async (lang: string) => {
      setCurrentUser(prev => ({ ...prev, language: lang }));
      if (currentView === 'admin') setCurrentView('daily'); 
      if (!isSyncing.current) {
          await autoSaveToCloud();
      }
  };

  const handleLanguageUpdate = async (updatedLanguages: string[]) => {
      setLanguages(updatedLanguages);
      lastLocalUpdate.current = Date.now();

      if (projectMeta?.id) {
          try {
              setSaveStatus('saving');
              const dataString = JSON.stringify({
                  workers: workersRef.current,
                  workload: workloadRef.current,
                  batches: batchesRef.current,
                  plan: planRef.current,
                  languages: updatedLanguages
              });
              lastCloudSync.current = dataString;

              await updateLanguagesInCloud(projectMeta.id, updatedLanguages);
              setSaveStatus('saved');
              setTimeout(() => setSaveStatus('idle'), 2000);
          } catch (e) {
              console.error("Error saving languages:", e);
              setSaveStatus('idle');
          }
      } else if (!projectMeta?.id && !isSyncing.current && planRef.current) {
          console.log("Auto-saving new project to cloud from language update");
          const defaultName = workloadRef.current.projectName || `Project ${new Date().toLocaleDateString()}`;
          savePlanToCloud(defaultName, '', workersRef.current, workloadRef.current, planRef.current, batchesRef.current, updatedLanguages, leaves, undefined).then(id => {
              setProjectMeta({ id, name: defaultName, notes: '', synced: true });
              setProjectStatus('active');
              window.history.replaceState({}, '', '?id=' + id);
          }).catch(e => console.error("Failed to auto-save new project", e));
      }
  };

  const handleUpdateProjectField = async (fields: any) => {
    if (!projectMeta?.id) return;
    try {
      setSaveStatus('saving');
      await updateProjectFieldInCloud(projectMeta.id, fields);
      setProjectMeta(prev => prev ? { ...prev, ...fields } : prev);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (e) {
      console.error("Failed to update project fields:", e);
      showToast("Failed to save Google Chat Settings.");
      setSaveStatus('idle');
    }
  };

  const handleNotifyGoogleChat = async (dayNum: number, lang: string): Promise<{ success: boolean; message?: string }> => {
    if (!plan) {
      showToast("No active project plan exists.");
      return { success: false, message: "No active project plan." };
    }
    const dayPlan = plan.schedule.find(d => d.day === dayNum);
    if (!dayPlan) {
      showToast("Schedule day not found.");
      return { success: false, message: "Schedule day not found." };
    }
    
    setSaveStatus('saving');
    showToast("Assignments saved!");
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
    return { success: true };
  };

  const toggleAdminMode = () => {
      if (currentView === 'admin') setCurrentView('daily');
      else setCurrentView('admin');
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 overflow-hidden transition-colors duration-300">
          <div className="max-w-md w-full p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-center animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner transition-colors">
              <Layers className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">Production Planner</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Sign in to collaborate with your team in real-time.</p>
            <button
              onClick={signInWithGoogle}
              className="w-full flex items-center justify-center gap-3 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl font-medium transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
            >
              <Globe className="w-5 h-5" />
              Sign in with Google
            </button>
          </div>
      </div>
    );
  }

  // Remove the unclosed div wrapper if it was still there
  return (
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden font-sans transition-colors duration-300">
      <NewBatchModal 
        isOpen={showBatchModal} 
        onClose={() => { setShowBatchModal(false); setEditingBatch(null); }} 
        onSave={handleSaveBatch}
        currentLanguage={currentUser.language}
        initialData={editingBatch}
        batches={globalBatchesProgress}
      />
      
      <SavePlanModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onSave={handleSavePlan}
      />

      <SettingsModal 
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        workers={workers}
        onUpdateWorkers={handleWorkerUpdate}
        languages={languages}
        onUpdateLanguages={handleLanguageUpdate}
        currentLanguage={currentUser.language}
        onExportData={handleExportData}
        onImportData={handleImportData}
        onError={showToast}
        projectMeta={projectMeta}
        onUpdateProjectField={handleUpdateProjectField}
      />
      
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-slate-900/90">
          <Loader2 size={64} className="text-[#F26C21] animate-spin mb-6" />
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Loading Team Data...</h3>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-lg font-medium animate-in fade-in slide-in-from-bottom-4">
          {toastMessage}
        </div>
      )}

      {/* Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-none z-30 px-4 md:px-6 flex items-center justify-between shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src="https://wedomarketing.co.in/wp-content/uploads/2024/04/cropped-1-1536x880.png" 
                alt="WeDo Marketing" 
                className="h-8 md:h-9 w-auto object-contain hidden sm:block" 
              />
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
              
              {/* Language Dropdown & Settings - Hidden on Dashboard */}
              {currentView === 'admin' ? (
                <div className="hidden sm:flex items-center gap-2">
                   <h1 className="text-xl font-black text-slate-800 dark:text-white">Project Dashboard</h1>
                </div>
              ) : (
                <div className="flex items-center gap-2 lg:gap-4 ml-2">
                    <div className="relative group">
                        <select 
                            value={currentUser.language} 
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            className="appearance-none bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 text-[10px] md:text-sm py-1.5 pl-2 pr-6 md:pl-3 md:pr-8 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            {(Array.from(new Set(languages)) as string[]).map(lang => (
                                <option key={lang} value={lang}>{lang} Team</option>
                            ))}
                        </select>
                        <Globe size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none md:scale-100 scale-75"/>
                    </div>

                    <button 
                        onClick={async () => {
                            setCloudSaving(true);
                            await autoSaveToCloud();
                            setCloudSaving(false);
                        }}
                        disabled={cloudSaving}
                        className="hidden sm:inline-flex p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors relative"
                        title={cloudSaving ? "Syncing..." : "Sync to Cloud"}
                        id="header-sync-btn"
                    >
                        {cloudSaving || saveStatus === 'saving' ? (
                            <Loader2 size={18} className="text-[#F26C21] animate-spin" />
                        ) : (
                            <Cloud size={18} className={projectMeta?.synced ? "text-emerald-500" : "text-slate-400 dark:text-slate-500 hover:text-[#F26C21]"} />
                        )}
                    </button>

                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            {(() => {
                const navOptions = [];
                if (isAdmin || isTL) {
                    navOptions.push({ id: 'daily', icon: <Home size={14} />, label: 'Home' });
                    navOptions.push({ id: 'ai-manager', icon: <Trophy size={14} />, label: 'Leaderboard' });
                    if (isAdmin || currentUserWorker?.role === 'Manager') {
                        navOptions.push({ id: 'assign', icon: <UserCheck size={14} />, label: 'Assign' });
                        navOptions.push({ id: 'leaves', icon: <Calendar size={14} />, label: 'Leaves' });
                    }
                } else if (isTeamMember) {
                    navOptions.push({ id: 'daily', icon: <Home size={14} />, label: 'Home' });
                    navOptions.push({ id: 'ai-manager', icon: <Trophy size={14} />, label: 'Leaderboard' });
                }

                if (navOptions.length === 0) return null;

                const activeOption = navOptions.find(o => o.id === currentView) || navOptions[0];

                return (
                    <div className="hidden md:block ml-2 md:ml-6 relative">
                        {/* Desktop Tabs */}
                        <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200/50 dark:border-slate-700/55 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                            {navOptions.map(opt => (
                                <button
                                    key={opt.id}
                                    onClick={() => setCurrentView(opt.id as any)}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${currentView === opt.id ? 'bg-white dark:bg-slate-700 text-[#F26C21] dark:text-[#F26C21] shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                                >
                                    {opt.icon} {opt.label}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            })()}
        </div>

        <div className="flex items-center gap-2 md:gap-3">
             {/* Mobile Navigation Dropdown */}
             {(() => {
                const navOptions = [];
                if (isAdmin || isTL) {
                    navOptions.push({ id: 'daily', icon: <Home size={14} />, label: 'Home' });
                    navOptions.push({ id: 'ai-manager', icon: <Trophy size={14} />, label: 'Leaderboard' });
                    if (isAdmin || currentUserWorker?.role === 'Manager') {
                        navOptions.push({ id: 'assign', icon: <UserCheck size={14} />, label: 'Assign' });
                        navOptions.push({ id: 'leaves', icon: <Calendar size={14} />, label: 'Leaves' });
                    }
                } else if (isTeamMember) {
                    navOptions.push({ id: 'daily', icon: <Home size={14} />, label: 'Home' });
                    navOptions.push({ id: 'ai-manager', icon: <Trophy size={14} />, label: 'Leaderboard' });
                }

                if (navOptions.length === 0) return null;

                const activeOption = navOptions.find(o => o.id === currentView) || navOptions[0];

                return (
                    <div className="md:hidden relative">
                        <button
                            onClick={() => setShowMobileNav(!showMobileNav)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-white dark:bg-slate-700 text-[#F26C21] shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600/50"
                        >
                            {activeOption.icon} {activeOption.label} <ChevronDown size={14} className={`transition-transform ${showMobileNav ? 'rotate-180' : ''}`} />
                        </button>
                        {showMobileNav && (
                            <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 py-1 z-50">
                                {navOptions.map(opt => (
                                    <button
                                        key={opt.id}
                                        onClick={() => {
                                            setCurrentView(opt.id as any);
                                            setShowMobileNav(false);
                                        }}
                                        className={`w-full text-left flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors ${currentView === opt.id ? 'bg-slate-50 dark:bg-slate-700/50 text-[#F26C21]' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                                    >
                                        {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                );
             })()}

             {/* Respective User Leave Balance Pill (Hidden on Mobile) */}
             {currentUserWorker && leaveBalance && (
                <div className="relative hidden sm:block">
                  <button 
                    onClick={() => setShowLeaveDropdown(!showLeaveDropdown)}
                    className="flex items-center gap-2 px-3 py-1 bg-teal-50 hover:bg-teal-100 dark:bg-teal-950/20 dark:hover:bg-teal-900/40 border border-teal-100 dark:border-teal-900/30 rounded-full text-xs font-bold text-slate-600 dark:text-slate-350 select-none shadow-sm cursor-pointer transition-all"
                  >
                    <Calendar size={13} className="text-teal-600 dark:text-teal-400" />
                    <span>
                      Leave Balance: <span className="text-teal-600 dark:text-teal-400 font-extrabold">{(leaveBalance.CL || 0) + (leaveBalance.PL || 0)}</span>
                    </span>
                    <ChevronDown size={12} className="text-teal-500" />
                  </button>
                  
                  {/* Click Tooltip Dropdown */}
                  {showLeaveDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowLeaveDropdown(false)}></div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max px-3 py-2 bg-slate-800 dark:bg-slate-700 text-white text-xs font-medium rounded shadow-lg z-40 flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-300">Casual Leave (CL):</span>
                          <span className="font-bold text-teal-400">{leaveBalance.CL}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-300">Paid Leave (PL):</span>
                          <span className="font-bold text-teal-400">{leaveBalance.PL}</span>
                        </div>
                        {/* Tooltip Arrow */}
                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-slate-800 dark:bg-slate-700 rotate-45 border-t border-l border-transparent"></div>
                      </div>
                    </>
                  )}
                </div>
             )}

             {/* User Profile Info & Dropdown -> Extreme Right */}
             {authUser && (
                <div className="relative">
                  <button 
                     onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                     className="flex items-center gap-2 px-3 py-1 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800 border border-slate-200/50 dark:border-slate-700/55 rounded-full select-none transition-all cursor-pointer"
                  >
                    <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-[#F26C21] to-amber-500 flex items-center justify-center text-white text-[9px] font-black uppercase shadow-sm">
                       {authUser.displayName ? authUser.displayName.charAt(0) : (currentUserWorker?.name?.charAt(0) || authUser.email?.charAt(0) || 'U')}
                    </div>
                    <span className="hidden sm:inline text-xs font-bold text-slate-700 dark:text-slate-300 truncate max-w-[100px]">
                       {currentUserWorker?.name || authUser.displayName || authUser.email?.split('@')[0]}
                    </span>
                    <ChevronDown size={14} className="text-slate-400 dark:text-slate-500" />
                  </button>

                  {showProfileDropdown && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowProfileDropdown(false)}></div>
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl shadow-lg z-40 py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                        <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{currentUserWorker?.name || authUser.displayName || authUser.email?.split('@')[0]}</p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5">{authUser.email}</p>
                        </div>
                        
                        {/* Mobile Leave Balance inside Profile Dropdown */}
                        {currentUserWorker && leaveBalance && (
                          <div className="sm:hidden px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1 flex flex-col gap-1">
                            <div className="flex items-center justify-between text-xs font-medium">
                              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5"><Calendar size={13} className="text-teal-500" /> Total Leaves:</span>
                              <span className="text-teal-600 dark:text-teal-400 font-bold">{(leaveBalance.CL || 0) + (leaveBalance.PL || 0)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-500">
                              <span>Casual (CL):</span>
                              <span>{leaveBalance.CL || 0}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-500">
                              <span>Paid (PL):</span>
                              <span>{leaveBalance.PL || 0}</span>
                            </div>
                          </div>
                        )}

                        {(isAdmin || isTL) && (
                          <>
                            <button
                              onClick={() => {
                                setShowProfileDropdown(false);
                                toggleAdminMode();
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850/60 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Shield size={14} className="text-[#F26C21]" />
                              <span>{currentView === 'admin' ? 'Exit Dashboard' : 'Dashboard'}</span>
                            </button>

                            <button
                              onClick={() => {
                                setShowProfileDropdown(false);
                                setShowSettingsModal(true);
                              }}
                              className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-850/60 flex items-center gap-2 transition-colors cursor-pointer"
                            >
                              <Settings size={14} className="text-[#F26C21]" />
                              <span>Settings</span>
                            </button>
                            <div className="border-t border-slate-100 dark:border-slate-800 my-1"></div>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setShowProfileDropdown(false);
                            signOutUser().catch(console.error);
                          }}
                          className="w-full text-left px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 flex items-center gap-2 transition-colors cursor-pointer"
                        >
                          <LogOut size={14} /> Sign Out
                        </button>
                      </div>
                    </>
                  )}
                </div>
             )}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* VIEW: DASHBOARD */}
        {(!isTeamMember || isAdmin || isTL) && currentView === 'admin' && (
            <AdminPage 
                workers={workers} 
                onBack={() => setCurrentView('daily')} 
                batches={globalBatchesProgress} // Use Global including progress
                plan={plan}
                projectMeta={projectMeta}
                onError={showToast}
            />
        )}

        {/* VIEW: AI MANAGER */}
        {(isAdmin || isTL || isTeamMember) && currentView === 'ai-manager' && (
          <main className="flex-1 h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 lg:p-6">
            {plan ? (
              <AIManager 
                plan={plan}
                workers={workers}
                batches={globalBatchesProgress}
                workload={workload}
                currentLanguage={currentUser.language}
                apiKey={process.env.GEMINI_API_KEY || ''}
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed">
                <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                  <Trophy size={40} className="text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="text-xl font-black text-slate-700 dark:text-slate-300">No Plan Available</h3>
                <p className="text-slate-400 dark:text-slate-500 mt-2 max-w-xs text-center text-sm">Generate or load a plan first to view the leaderboard.</p>
              </div>
            )}
          </main>
        )}

        {/* VIEW: LEAVES */}
        {(isAdmin || currentUserWorker?.role === 'Manager') && currentView === 'leaves' && (
          <main className="flex-1 w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 lg:p-6">
            <LeaveManagement 
                workers={workers} 
                setWorkers={setWorkers} 
                languages={languages} 
                currentLanguage={currentUser.language}
                onUpdate={handleWorkerUpdate}
                readOnly={!isAdmin && !isTL}
            />
          </main>
        )}

        {/* VIEW: DAILY UPDATE */}
        {currentView === 'daily' && (
          <main className="flex-1 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 p-4 lg:p-6">
             {plan ? (
               <DailyUpdate 
                 plan={plan} 
                 workload={workload} 
                 workers={filteredWorkers} // Filtered for default view
                 allWorkers={workers} // Pass all workers for lookup and leaderboard / stats
                 batches={filteredBatches} // Pass Filtered Batches
                 allBatches={globalBatchesProgress}
                 leaves={leaves} // Pass leaves state
                 onUpdatePlan={handlePlanUpdate}
                 onToggleLeave={toggleLeave}
                 onDeleteBatch={handleDeleteBatch}
                 onEditBatch={handleEditBatch} 
                 currentLanguage={currentUser.language} 
                 readOnlyBatches={!isAdmin && !isTL && !isEditor}
                 onNewBatch={() => { setEditingBatch(null); setShowBatchModal(true); }}
                 projectMeta={projectMeta}
                 onNotifyGoogleChat={handleNotifyGoogleChat}
                 currentUserWorker={currentUserWorker}
                 onNavigateToLeaderboard={() => setCurrentView('ai-manager')}
               />
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed">
                   <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                      <ListChecks size={40} className="text-slate-300 dark:text-slate-600" />
                   </div>
                   <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-2">No Active Schedule</h2>
                   <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 text-center">Start a {currentUser.language} project to track daily progress.</p>
                   <div className="flex gap-4">
                     <button onClick={handleManualStart} className="px-6 py-2 bg-[#F26C21] text-white rounded-lg font-bold hover:bg-[#d95a10]">Manual Start</button>
                   </div>
               </div>
             )}
          </main>
        )}

        {/* VIEW: ASSIGN WORK */}
        {(isAdmin || currentUserWorker?.role === 'Manager') && currentView === 'assign' && (
          <main className="flex-1 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 p-4 lg:p-6">
             {plan ? (
               <AssignWork 
                 plan={plan} 
                 workload={workload} 
                 workers={filteredWorkers} 
                 allWorkers={workers} // Pass all
                 batches={filteredBatches}
                 allBatches={globalBatchesProgress}
                 onUpdatePlan={handlePlanUpdate}
                 onToggleLeave={toggleLeave}
                 currentLanguage={currentUser.language} 
                 apiKey={process.env.GEMINI_API_KEY || ''}
               />
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed">
                   <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                      <UserCheck size={40} className="text-slate-300 dark:text-slate-600" />
                   </div>
                   <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-2">No Active Schedule</h2>
                   <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 text-center">Create a schedule to start assigning work.</p>
                   <button onClick={handleManualStart} className="px-6 py-2 bg-[#F26C21] text-white rounded-lg font-bold hover:bg-[#d95a10]">Manual Start</button>
               </div>
             )}
          </main>
        )}

      </div>
    </div>
  );
};

export default App;
