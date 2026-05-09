import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ProductionPlan, Batch, Worker, Workload, DayPlan, TaskAssignment, Leave } from './types';
import AdminPage from './components/AdminPage';
import LeaveManagement from './components/LeaveManagement';
import { loadPlanFromCloud, subscribeToPlan, onAuthChange, savePlanToCloud, saveDayToCloud, saveAssignmentToCloud, deleteAssignmentFromCloud, updateWorkersInCloud, updatePlanInCloud } from './services/firestoreService';
import { Loader2, LayoutDashboard, Calendar, Globe, Moon, Sun, Layers } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';

const EditorsApp: React.FC = () => {
  const [authUser, setAuthUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [workload, setWorkload] = useState<Workload | null>(null);
  const [languages, setLanguages] = useState<string[]>(['Telugu']);
  const [currentLanguage, setCurrentLanguage] = useState<string>('Telugu');
  const [leaves, setLeaves] = useState<Record<string, number[]>>({});
  
  const [currentView, setCurrentView] = useState<'dashboard' | 'leaves'>('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const lastLocalUpdate = useRef<number>(0);
  const pendingRemoteUpdate = useRef<any>(null);
  const remoteUpdateTimer = useRef<NodeJS.Timeout | null>(null);
  const lastCloudSync = useRef<string>('');
  const isSyncing = useRef<boolean>(false);
  const planRef = useRef<ProductionPlan | null>(null);
  const workersRef = useRef<Worker[]>([]);

  useEffect(() => {
    planRef.current = plan;
  }, [plan]);

  useEffect(() => {
    workersRef.current = workers;
  }, [workers]);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (authLoading || !authUser) return;

    const params = new URLSearchParams(window.location.search);
    const planId = params.get('id');

    if (!planId) {
      setError("No plan ID provided in URL.");
      setLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        const data = await loadPlanFromCloud(planId);
        if (data) {
          setPlan(data.plan);
          setBatches(data.batches || []);
          setWorkers(data.workers || []);
          setWorkload(data.workload);
          if (data.languages && data.languages.length > 0) {
            setLanguages(data.languages);
            if (!data.languages.includes(currentLanguage)) {
              setCurrentLanguage(data.languages[0]);
            }
          }
        } else {
          setError("Plan not found.");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load plan.");
      } finally {
        setLoading(false);
      }
    };

    loadData();

    const unsubscribe = subscribeToPlan(planId, (data) => {
      if (!data) return;

      const dataString = JSON.stringify({
          workers: data.workers,
          workload: data.workload,
          batches: data.batches,
          plan: data.plan,
          languages: data.languages
      });
      
      if (dataString === lastCloudSync.current) {
          return;
      }

      const applyRemoteUpdate = (remoteData: any) => {
          isSyncing.current = true;
          lastCloudSync.current = JSON.stringify({
              workers: remoteData.workers,
              workload: remoteData.workload,
              batches: remoteData.batches,
              plan: remoteData.plan,
              languages: remoteData.languages
          });
          
          if (remoteData.plan) setPlan(remoteData.plan);
          if (remoteData.batches) setBatches(remoteData.batches);
          if (remoteData.workers) setWorkers(remoteData.workers);
          if (remoteData.workload) setWorkload(remoteData.workload);
          if (remoteData.languages && remoteData.languages.length > 0) {
              setLanguages(remoteData.languages);
              if (!remoteData.languages.includes(currentLanguage)) {
                  setCurrentLanguage(remoteData.languages[0]);
              }
          }
          
          setTimeout(() => { isSyncing.current = false; }, 100);
      };

      const timeSinceLastLocal = Date.now() - lastLocalUpdate.current;
      if (timeSinceLastLocal < 2000) {
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
    });

    return () => unsubscribe();
  }, [authUser, authLoading]);

  // Update leaves state when workers or workload changes
  useEffect(() => {
      if (!workers || !workload) return;
      const newLeavesState: Record<string, number[]> = {};
      
      workers.forEach(w => {
          if (w.leaves && w.leaves.length > 0) {
              const indices: number[] = [];
              w.leaves.forEach(l => {
                  const [ly, lm, ld] = l.date.split('-').map(Number);
                  const [sy, sm, sd] = workload.startDate.split('-').map(Number);
                  
                  const lDate = new Date(Date.UTC(ly, lm - 1, ld));
                  const sDate = new Date(Date.UTC(sy, sm - 1, sd));
                  
                  const diffTime = lDate.getTime() - sDate.getTime();
                  const dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
                  
                  if (dayIndex > 0) indices.push(dayIndex);
              });
              newLeavesState[w.id] = indices;
          }
      });
      setLeaves(newLeavesState);
  }, [workers, workload]);

  const planMetaSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const getPlanId = () => new URLSearchParams(window.location.search).get('id');

  const filteredWorkers = workers.filter(w => (w.language || 'Telugu') === currentLanguage);
  const migrateBatches = (batches: any[]): Batch[] => {
    return (batches || []).map((b: any) => ({
      ...b,
      language: b.language || 'Telugu',
      status: b.status || 'active',
      aiVideos: Number(b.aiVideos) || 0,
      normalVideos: Number(b.normalVideos) || 0
    }));
  };

    const globalBatchesProgress = useMemo(() => {
    const migrated = migrateBatches(batches);
    if (!plan) return migrated.map(b => ({...b, progress: 0, completedNormal: 0}));

    const stats: Record<string, { assignedGen: number, assignedEdit: number, assignedNormal: number }> = {};
    
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

    const countValidRows = (str: string, dummySet: Set<number>) => {
        if (!str) return 0;
        const tokens = str.trim().split(/[\s,]+/).filter(Boolean);
        let count = 0;
        tokens.forEach(t => {
            const n = parseInt(t);
            if (!isNaN(n) && !dummySet.has(n)) {
                count++;
            }
        });
        return count;
    };

    (plan.schedule || []).forEach(day => {
        (day.assignments || []).forEach(task => {
            if (task.batchId && task.batchId !== 'DEFAULT') {
                if (!stats[task.batchId]) stats[task.batchId] = { assignedGen: 0, assignedEdit: 0, assignedNormal: 0 };
                
                const batch = migrated.find(b => b.id === task.batchId);
                const dummySet = batch ? parseDummies(batch.dummyRows) : new Set<number>();
                const normalSet = batch ? parseNormalRows(batch.normalRows) : new Set<number>();

                if (task.assignedGenRows && task.assignedGenRows.trim().length > 0) {
                    stats[task.batchId].assignedGen += countValidRows(task.assignedGenRows, dummySet);
                } else {
                    stats[task.batchId].assignedGen += task.generations;
                }

                if (task.assignedEditRows && task.assignedEditRows.trim().length > 0) {
                    const tokens = task.assignedEditRows.trim().split(/[\s,]+/).filter(Boolean);
                    tokens.forEach(t => {
                        const n = parseInt(t);
                        if (!isNaN(n) && !dummySet.has(n)) {
                            if (normalSet.has(n)) {
                                stats[task.batchId].assignedNormal += 1;
                            } else {
                                stats[task.batchId].assignedEdit += 1;
                            }
                        }
                    });
                } else {
                    stats[task.batchId].assignedEdit += task.edits;
                }
            }
        });
    });

    return migrated.map(b => {
        const s = stats[b.id] || { assignedGen: 0, assignedEdit: 0, assignedNormal: 0 };
        const total = b.aiVideos + (b.aiVideos + b.normalVideos);
        const done = s.assignedGen + s.assignedEdit + s.assignedNormal;
        const p = total > 0 ? Math.round((done / total) * 100) : 0;
        
        return {
            ...b,
            completedGen: s.assignedGen,
            completedEdit: s.assignedEdit,
            completedNormal: s.assignedNormal,
            progress: Math.min(100, p)
        };
    });
  }, [plan, batches]);

  const handlePlanUpdate = (newPlan: ProductionPlan, saveToCloud: boolean = false, dayToSave?: number, assignmentId?: string, isDeletion: boolean = false) => {
      setPlan(newPlan);
      lastLocalUpdate.current = Date.now();
      
      const dataString = JSON.stringify({
          workers,
          workload,
          batches,
          plan: newPlan,
          languages
      });
      lastCloudSync.current = dataString;
      
      const planId = getPlanId();
      if (planId && !isSyncing.current) {
          if (saveToCloud && dayToSave !== undefined) {
              const dayPlan = newPlan.schedule.find(d => d.day === dayToSave);
              if (dayPlan) {
                  if (assignmentId) {
                      if (isDeletion) {
                          deleteAssignmentFromCloud(planId, dayPlan, assignmentId).catch(e => console.error("Granular delete failed", e));
                      } else {
                          const assignment = dayPlan.assignments.find(a => (a.id || a.workerId) === assignmentId);
                          if (assignment) {
                              saveAssignmentToCloud(planId, dayPlan, assignment).catch(e => console.error("Granular assignment save failed", e));
                          }
                      }
                  } else {
                      saveDayToCloud(planId, dayPlan).catch(e => console.error("Granular day save failed", e));
                  }
              }
          }
          
          // Always debounce a save of the plan metadata (summary, bottlenecks, etc.)
          if (planMetaSaveTimeoutRef.current) {
              clearTimeout(planMetaSaveTimeoutRef.current);
          }
          planMetaSaveTimeoutRef.current = setTimeout(() => {
              updatePlanInCloud(planId, newPlan, true).catch(e => console.error("Plan meta save failed", e));
          }, 2000);
      }
  };

  const handleWorkerUpdate = async (updatedWorkers: Worker[], basePlan?: ProductionPlan) => {
      setWorkers(updatedWorkers);
      lastLocalUpdate.current = Date.now();
      
      const currentPlan = basePlan || planRef.current;
      let currentPlanToSave = currentPlan;

      if (currentPlan && workload) {
          const newSchedule = currentPlan.schedule.map(day => {
              return {
                  ...day,
                  assignments: day.assignments.map(a => {
                      const worker = updatedWorkers.find(w => w.id === a.workerId);
                      
                      const isOnLeave = worker?.leaves?.some(l => {
                          const [ly, lm, ld] = l.date.split('-').map(Number);
                          const [sy, sm, sd] = workload.startDate.split('-').map(Number);
                          const lDate = new Date(Date.UTC(ly, lm - 1, ld));
                          const sDate = new Date(Date.UTC(sy, sm - 1, sd));
                          const diffTime = lDate.getTime() - sDate.getTime();
                          const dayIndex = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;
                          return dayIndex === day.day;
                      });
                      
                      if (a.isOnLeave !== !!isOnLeave) {
                          return {
                              ...a,
                              isOnLeave: !!isOnLeave,
                              batchId: isOnLeave ? undefined : a.batchId,
                              generations: isOnLeave ? 0 : a.generations,
                              edits: isOnLeave ? 0 : a.edits
                          };
                      }
                      return a;
                  })
              };
          });

          currentPlanToSave = { ...currentPlan, schedule: newSchedule };
          setPlan(currentPlanToSave);
      }
      
      const planId = getPlanId();
      if (planId && currentPlanToSave && !isSyncing.current && workload) {
          try {
              const dataString = JSON.stringify({
                  workers: updatedWorkers,
                  workload,
                  batches,
                  plan: currentPlanToSave,
                  languages
              });
              lastCloudSync.current = dataString;

              await updateWorkersInCloud(planId, updatedWorkers);
              await updatePlanInCloud(planId, currentPlanToSave);
          } catch (e) {
              console.error("Error saving workers:", e);
              setError("Failed to save worker changes");
          }
      }
  };

  const toggleLeave = (workerId: string, day: number, forceState?: boolean, basePlan?: ProductionPlan) => {
    if (!workload) return;
    
    const [sy, sm, sd] = workload.startDate.split('-').map(Number);
    const date = new Date(Date.UTC(sy, sm - 1, sd));
    date.setUTCDate(date.getUTCDate() + (day - 1));
    const dateStr = date.toISOString().split('T')[0];

    const currentWorkers = workersRef.current;
    const worker = currentWorkers.find(w => w.id === workerId);
    if (!worker) return;

    const currentLeaves = worker.leaves || [];
    const isAlreadyOnLeave = currentLeaves.some(l => l.date === dateStr);
    const shouldBeOnLeave = forceState !== undefined ? forceState : !isAlreadyOnLeave;

    if (shouldBeOnLeave === isAlreadyOnLeave) {
        if (basePlan) {
             handleWorkerUpdate(currentWorkers, basePlan);
        }
        return;
    }

    const updatedWorkers = currentWorkers.map(w => {
        if (w.id === workerId) {
            if (shouldBeOnLeave) {
                return {
                    ...w,
                    leaves: [...(w.leaves || []), {
                        id: Math.random().toString(36).substr(2, 9),
                        workerId,
                        date: dateStr,
                        type: 'paid'
                    } as Leave]
                };
            } else {
                return {
                    ...w,
                    leaves: (w.leaves || []).filter(l => l.date !== dateStr)
                };
            }
        }
        return w;
    });

    handleWorkerUpdate(updatedWorkers, basePlan);
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
      <div className={isDarkMode ? "dark" : ""}>
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
          <div className="max-w-md w-full p-8 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 text-center">
            <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900/50 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner">
              <Layers className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Editors Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 mb-8">Please log in from the main app first to view this page.</p>
            <a href="/" className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors inline-block">
              Go to Main App
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
          <Loader2 className="w-8 h-8 animate-spin text-[#F26C21]" />
        </div>
      </div>
    );
  }

  if (error || !plan || !workload) {
    return (
      <div className={isDarkMode ? "dark" : ""}>
        <div className="h-screen w-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100">
          <div className="p-10 text-center text-red-500 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800">
            <h2 className="text-xl font-bold">{error || "Failed to load data"}</h2>
          </div>
        </div>
      </div>
    );
  }

  // Dummy handlers for read-only mode
  const dummyHandler = () => {};

  return (
    <div className={isDarkMode ? "dark" : ""}>
      <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden font-sans transition-colors duration-300">
        {/* Header */}
        <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-none z-30 px-4 md:px-6 grid grid-cols-3 items-center shadow-sm transition-colors duration-300">
          <div className="flex items-center gap-4 justify-start">
            <div className="flex items-center gap-3">
              <img 
                src="https://wedomarketing.co.in/wp-content/uploads/2024/04/cropped-1-1536x880.png" 
                alt="WeDo Marketing" 
                className="h-8 md:h-9 w-auto object-contain" 
              />
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200 hidden md:block">Editors Dashboard</span>
            </div>

            {/* Navigation Tabs (Centered) */}
            <div className="flex justify-center">
              <div className="flex bg-slate-100/80 dark:bg-slate-800/80 p-1 rounded-full border border-slate-200/50 dark:border-slate-700/50 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <button 
                  onClick={() => setCurrentView('dashboard')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${currentView === 'dashboard' ? 'bg-white dark:bg-slate-700 text-[#F26C21] dark:text-[#F26C21] shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                >
                  <LayoutDashboard size={14} /> Dashboard
                </button>
                <button 
                  onClick={() => setCurrentView('leaves')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${currentView === 'leaves' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm ring-1 ring-slate-200/50 dark:ring-slate-600/50' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-700/50'}`}
                >
                  <Calendar size={14} /> Leaves
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 rounded-full transition-colors"
              title="Toggle Dark Mode"
            >
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        {/* Main Content */}
        {currentView === 'dashboard' && (
          <main className="flex-1 h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 lg:p-6">
            <AdminPage
              workers={workers}
              setWorkers={setWorkers}
              onBack={() => {}}
              batches={globalBatchesProgress}
              plan={plan}
              projectMeta={{ id: getPlanId() || undefined, name: workload?.projectName || 'Project', notes: '' }}
            />
          </main>
        )}

        {currentView === 'leaves' && (
          <main className="flex-1 w-full h-full overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 lg:p-6">
            <LeaveManagement
              workers={workers}
              setWorkers={setWorkers}
              languages={languages}
              currentLanguage="All Teams"
              onUpdate={handleWorkerUpdate}
            />
          </main>
        )}
      </div>
    </div>
  );
};

export default EditorsApp;
