
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Worker, Workload, ProductionPlan, Batch, User } from './types';
import PlanAnalyze from './components/PlanAnalyze';
import DailyUpdate from './components/DailyUpdate';
import NewBatchModal from './components/NewBatchModal';
import SavePlanModal from './components/SavePlanModal';
import AdminPage from './components/AdminPage'; 
import AssignWork from './components/AssignWork'; 
import SettingsModal from './components/SettingsModal';
import PublicDashboard from './components/PublicDashboard'; // Import the new View
import { generateProductionPlan } from './services/geminiService';
import { savePlanToCloud, loadPlanFromCloud, deletePlanFromCloud, getSavedPlans, subscribeToPlan } from './services/firestoreService';
import { Play, RefreshCw, Loader2, CheckCircle, XCircle, TrendingUp, Calendar, X, CloudUpload, FolderCheck, Check, Upload, HardDrive, Trash2, FolderOpen, Brain, Zap, Clock, Rocket, LayoutDashboard, ListChecks, ArrowLeft, PenTool, ChevronRight, Plus, PieChart, Cloud, Layers, Globe, Shield, LogOut, UserCheck, Settings, Moon, Sun } from 'lucide-react';

const STORAGE_KEY = 'wedo_production_planner_v3';

// Added language: 'Telugu' to default workers
const DEFAULT_WORKERS: Worker[] = [
  { id: '1', name: 'Nithin', role: 'Editor', genCapacity: 0, editCapacity: 9, limitations: 'Edits only. Can edit AI videos same-day.', language: 'Telugu' },
  { id: '2', name: 'Kishan', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: 'Shared capacity: Max 7 Gen OR 9 Edit OR mix', language: 'Telugu' },
  { id: '3', name: 'Neha', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: 'Shared capacity: Max 7 Gen OR 9 Edit OR mix', language: 'Telugu' },
  { id: '4', name: 'Yashwanth', role: 'Editor', genCapacity: 7, editCapacity: 9, limitations: 'Shared capacity: Max 7 Gen OR 9 Edit OR mix', language: 'Telugu' },
  { id: '5', name: 'Intiyaz', role: 'Intern', genCapacity: 6, editCapacity: 0, limitations: 'Generations only', language: 'Telugu' },
  { id: '6', name: 'Leena', role: 'Intern', genCapacity: 6, editCapacity: 0, limitations: 'Generations only', language: 'Telugu' },
];

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
  // --- PUBLIC DASHBOARD MODE CHECK ---
  // Initialize lazily to ensure it's constant during the component lifecycle unless URL changes (which implies reload mostly)
  // This prevents "Rendered fewer hooks than expected" error.
  const [isPublicMode] = useState(() => {
    if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        return params.get('mode') === 'dashboard';
    }
    return false;
  });

  // If in public mode, return early immediately. 
  // Since isPublicMode is determined on first render and doesn't change, hooks below won't be called conditionally.
  if (isPublicMode) {
      return <PublicDashboard />;
  }

  // --- STANDARD APP LOGIC ---
  const [workers, setWorkers] = useState<Worker[]>(DEFAULT_WORKERS);
  const [workload, setWorkload] = useState<Workload>(DEFAULT_WORKLOAD);
  const [leaves, setLeaves] = useState<Record<string, number[]>>({});
  const [batches, setBatches] = useState<Batch[]>([]);
  
  // Multi-language Support
  // Ensure unique languages by default
  const [languages, setLanguages] = useState<string[]>(Array.from(new Set(['Telugu', 'Tamil'])));
  const [currentUser, setCurrentUser] = useState<User>({ role: 'lead', language: 'Telugu' });
  
  const [plan, setPlan] = useState<ProductionPlan | null>(null);
  const [recentPlan, setRecentPlan] = useState<ProductionPlan | null>(null);
  
  const [projectStatus, setProjectStatus] = useState<'planning' | 'active'>('planning');
  
  // Views: 'track' | 'assign' | 'daily' | 'admin'
  const [currentView, setCurrentView] = useState<'track' | 'assign' | 'daily' | 'admin'>('daily');

  const [projectMeta, setProjectMeta] = useState<{id?: string, name: string, notes: string, synced?: boolean} | null>(null);

  const [loading, setLoading] = useState(false);
  const [cloudSaving, setCloudSaving] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null); 
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  
  const isInitialMount = useRef(true);
  const isRemoteUpdate = useRef(false);
  const hasApiKey = !!process.env.API_KEY;

  // Calculate Global Batch Progress
  const globalBatchesProgress = useMemo(() => {
    if (!plan) return batches.map(b => ({...b, progress: 0}));

    const stats: Record<string, { assignedGen: number, assignedEdit: number }> = {};
    
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

    // Helper to count valid rows (token based, not unique Set based)
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

    plan.schedule.forEach(day => {
        day.assignments.forEach(task => {
            if (task.batchId && task.batchId !== 'DEFAULT') {
                // Modified: Count all assigned work regardless of lock status to align Dashboard with Daily Update
                if (!stats[task.batchId]) stats[task.batchId] = { assignedGen: 0, assignedEdit: 0 };
                
                const batch = batches.find(b => b.id === task.batchId);
                const dummySet = batch ? parseDummies(batch.dummyRows) : new Set<number>();

                // Gen
                if (task.assignedGenRows && task.assignedGenRows.trim().length > 0) {
                    stats[task.batchId].assignedGen += countValidRows(task.assignedGenRows, dummySet);
                } else {
                    stats[task.batchId].assignedGen += task.generations;
                }

                // Edit
                if (task.assignedEditRows && task.assignedEditRows.trim().length > 0) {
                    stats[task.batchId].assignedEdit += countValidRows(task.assignedEditRows, dummySet);
                } else {
                    stats[task.batchId].assignedEdit += task.edits;
                }
            }
        });
    });

    return batches.map(b => {
        const s = stats[b.id] || { assignedGen: 0, assignedEdit: 0 };
        const total = b.aiVideos + (b.aiVideos + b.normalVideos);
        const done = s.assignedGen + s.assignedEdit;
        const p = total > 0 ? Math.round((done / total) * 100) : 0;
        
        return {
            ...b,
            completedGen: s.assignedGen,
            completedEdit: s.assignedEdit,
            progress: Math.min(100, p)
        };
    });
  }, [plan, batches, workers]);

  // --- FILTERING LOGIC ---
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => (w.language || 'Telugu') === currentUser.language);
  }, [workers, currentUser.language]);

  const filteredBatches = useMemo(() => {
    return globalBatchesProgress.filter(b => (b.language || 'Telugu') === currentUser.language);
  }, [globalBatchesProgress, currentUser.language]);

  // Initial Load Logic
  useEffect(() => {
    const initialize = async () => {
      const savedData = localStorage.getItem(STORAGE_KEY);
      let localId: string | undefined = undefined;
      let hasLocalData = false;

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.plan && parsed.plan.schedule && parsed.plan.schedule.length > 0) {
            // Migration: Ensure workers have language
            const migratedWorkers = (parsed.workers || []).map((w: Worker) => ({
                ...w,
                language: w.language || 'Telugu'
            }));
            const migratedBatches = (parsed.batches || []).map((b: Batch) => ({
                ...b,
                language: b.language || 'Telugu'
            }));

            setWorkers(migratedWorkers);
            setWorkload({ ...DEFAULT_WORKLOAD, ...parsed.workload });
            if (parsed.leaves) setLeaves(parsed.leaves);
            setPlan(parsed.plan);
            setBatches(migratedBatches);
            if (parsed.projectStatus) setProjectStatus(parsed.projectStatus);
            if (parsed.recentPlan) setRecentPlan(parsed.recentPlan);
            if (parsed.languages) setLanguages(Array.from(new Set(parsed.languages)));
            
            if (parsed.projectMeta) {
              setProjectMeta(parsed.projectMeta);
              localId = parsed.projectMeta.id;
            }
            hasLocalData = true;
          }
        } catch (e) {
          console.error("Failed to load saved data from local", e);
        }
      }

      if (!hasLocalData) setLoading(true);
      else setCloudSaving(true);

      try {
        let cloudData = null;
        if (localId) {
            try {
                cloudData = await loadPlanFromCloud(localId);
            } catch (e) {
                console.warn("Could not find locally referenced project in cloud.");
            }
        }

        if (!cloudData) {
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
             setBatches(migratedBatches);
             setProjectMeta(cloudData.projectMeta);
             setProjectStatus('active'); 
             setRecentPlan(null);
             
             // Load languages if available, otherwise default
             if (cloudData.languages && Array.isArray(cloudData.languages)) {
                 setLanguages(Array.from(new Set(cloudData.languages)));
             }

             if(!hasLocalData) setCurrentView('daily'); 
        } else if (!hasLocalData) {
             handleManualStart();
        }

      } catch (e) {
        if (!hasLocalData) handleManualStart();
      } finally {
        setLoading(false);
        setCloudSaving(false);
      }
    };

    initialize();
  }, []);

  // Real-time Cloud Subscription
  useEffect(() => {
      if (projectStatus === 'active' && projectMeta?.id) {
          console.log("Subscribing to plan:", projectMeta.id);
          const unsubscribe = subscribeToPlan(projectMeta.id, (data) => {
              console.log("Received remote update");
              isRemoteUpdate.current = true;
              
              // Batch updates to avoid multiple renders if possible, though React 18 handles this
              setWorkers(prev => JSON.stringify(prev) !== JSON.stringify(data.workers) ? data.workers : prev);
              setWorkload(prev => JSON.stringify(prev) !== JSON.stringify(data.workload) ? data.workload : prev);
              setBatches(prev => JSON.stringify(prev) !== JSON.stringify(data.batches) ? (data.batches || []) : prev);
              
              // For plan, we need to be careful not to overwrite if we are currently editing?
              // For now, Last Write Wins from server.
              setPlan(data.plan);
              
              if (data.projectMeta) {
                  setProjectMeta(prev => ({ ...prev, ...data.projectMeta, synced: true }));
              }

              // Sync languages from cloud data
              if (data.languages && Array.isArray(data.languages)) {
                  setLanguages(Array.from(new Set(data.languages)));
              } else if (data.languages === undefined) {
                  // Only fallback if 'languages' field is MISSING in the document.
                  // If it is present but empty [], we respect that (though unlikely to have 0 languages).
                  const derivedLanguages = new Set<string>(['Telugu', 'Tamil']);
                  if (data.workers) data.workers.forEach((w: Worker) => w.language && derivedLanguages.add(w.language));
                  if (data.batches) data.batches.forEach((b: Batch) => b.language && derivedLanguages.add(b.language));
                  setLanguages(Array.from(derivedLanguages));
              }
          });
          return () => unsubscribe();
      }
  }, [projectStatus, projectMeta?.id]);

  // Continuous Auto-Save
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      try {
        const dataToSave = JSON.stringify({ workers, workload, leaves, plan, recentPlan, projectMeta, projectStatus, batches, languages });
        localStorage.setItem(STORAGE_KEY, dataToSave);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
        console.error("Auto-save failed: Circular structure detected or storage full", e);
        setSaveStatus('idle');
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [workers, workload, leaves, plan, recentPlan, projectMeta, projectStatus, batches, languages]);

  // Cloud Auto-Save Debounced
  useEffect(() => {
    if (!plan || projectStatus !== 'active' || loading) return;

    if (isRemoteUpdate.current) {
        // This change came from the server, so don't echo it back
        isRemoteUpdate.current = false;
        return;
    }

    const timer = setTimeout(() => {
        autoSaveToCloud(); 
    }, 3000);

    return () => clearTimeout(timer);
  }, [plan, batches, projectStatus]);

  // Filter for Sidebar
  const activeBatchesProgress = useMemo(() => {
      return globalBatchesProgress
        .filter(b => b.status === 'active' && (b.language || 'Telugu') === currentUser.language && b.progress < 100);
  }, [globalBatchesProgress, currentUser.language]);

  const handleGeneratePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const generatedPlan = await generateProductionPlan(workers, workload, leaves, process.env.API_KEY);
      setPlan(generatedPlan);
      setProjectStatus('planning'); 
      setRecentPlan(null); 
      setCurrentView('track');
      
      setProjectMeta(prev => ({
        name: workload.projectName,
        notes: prev?.notes || '',
        synced: false
      }));
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
      setPlan(emptyPlan);
      setProjectStatus('active');
      setRecentPlan(null);
      setProjectMeta(prev => ({
          name: workload.projectName,
          notes: prev?.notes || '',
          synced: false
      }));
  };

  const autoSaveToCloud = async (overrides: { plan?: ProductionPlan | null, batches?: Batch[] } = {}) => {
    const planToSave = overrides.plan !== undefined ? overrides.plan : plan;
    const batchesToSave = overrides.batches !== undefined ? overrides.batches : globalBatchesProgress;

    if (!planToSave) return;

    setCloudSaving(true);
    try {
       const name = projectMeta?.name || workload.projectName;
       const notes = projectMeta?.notes || '';
       const id = await savePlanToCloud(name, notes, workers, workload, planToSave, batchesToSave, projectMeta?.id);
       
       setProjectMeta(prev => {
         if (!prev) return { id, name, notes, synced: true };
         return { ...prev, id, synced: true };
       });
    } catch(e) {
       console.error("Auto-save to cloud failed", e);
    } finally {
       setCloudSaving(false);
    }
  };

  const handleSaveBatch = (batchData: Omit<Batch, 'id' | 'status' | 'createdAt'>) => {
      if (editingBatch) {
        // Edit Mode
        const updatedBatches = batches.map(b => b.id === editingBatch.id ? { 
            ...b, 
            ...batchData 
        } : b);
        setBatches(updatedBatches);
        autoSaveToCloud({ batches: updatedBatches });
      } else {
        // Create Mode
        const newBatch: Batch = {
            ...batchData,
            id: Math.random().toString(36).substr(2, 9),
            status: 'active',
            createdAt: new Date().toISOString(),
            language: currentUser.language // Assign current view language
        };
        const newBatches = [...batches, newBatch];
        setBatches(newBatches);
        autoSaveToCloud({ batches: newBatches });
      }
      setShowBatchModal(false);
      setEditingBatch(null);
  };
  
  const handleEditBatch = (batch: Batch) => {
      setEditingBatch(batch);
      setShowBatchModal(true);
  };

  const handleDeleteBatch = (batchId: string) => {
      const newBatches = batches.filter(b => b.id !== batchId);
      setBatches(newBatches);
      
      if (plan) {
          const newSchedule = plan.schedule.map(day => ({
              ...day,
              assignments: day.assignments.map(task => 
                  task.batchId === batchId 
                    ? { ...task, batchId: 'DEFAULT' } 
                    : task
              )
          }));
          const newPlan = { ...plan, schedule: newSchedule };
          setPlan(newPlan);
          autoSaveToCloud({ batches: newBatches, plan: newPlan });
      } else {
          autoSaveToCloud({ batches: newBatches });
      }
  };

  const handlePlanUpdate = (newPlan: ProductionPlan, saveToCloud: boolean = false) => {
      setPlan(newPlan);
      if (saveToCloud) {
          autoSaveToCloud({ plan: newPlan });
      }
  };

  const handleSavePlan = async (name: string, notes: string) => {
      if (!plan) return;
      
      setLoading(true);
      try {
          // 1. Save to Cloud
          const id = await savePlanToCloud(name, notes, workers, workload, plan, batches, languages, projectMeta?.id);
          
          // 2. Update Local State
          setProjectMeta({ id, name, notes, synced: true });
          setProjectStatus('active'); // Activate the project
          setShowSaveModal(false);
          
          // 3. Force auto-save to ensure consistency
          await autoSaveToCloud({ plan });
      } catch (e) {
          console.error("Failed to save plan:", e);
          setError("Failed to save plan to cloud. Please try again.");
      } finally {
          setLoading(false);
      }
  };

  const toggleLeave = (workerId: string, day: number) => {
    setLeaves(prev => {
      const currentLeaves = prev[workerId] || [];
      const isAlreadyOnLeave = currentLeaves.includes(day);
      return {
        ...prev,
        [workerId]: isAlreadyOnLeave ? currentLeaves.filter(d => d !== day) : [...currentLeaves, day]
      };
    });
  };

  const handleLanguageChange = (lang: string) => {
      setCurrentUser(prev => ({ ...prev, language: lang }));
      if (currentView === 'admin') setCurrentView('daily'); 
  };

  const toggleAdminMode = () => {
      if (currentView === 'admin') setCurrentView('daily');
      else setCurrentView('admin');
  };

  return (
    <div className={isDarkMode ? "dark" : ""}>
    <div className="h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col overflow-hidden font-sans transition-colors duration-300">
      <NewBatchModal 
        isOpen={showBatchModal} 
        onClose={() => { setShowBatchModal(false); setEditingBatch(null); }} 
        onSave={handleSaveBatch}
        currentLanguage={currentUser.language}
        initialData={editingBatch}
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
        setWorkers={setWorkers}
        languages={languages}
        setLanguages={setLanguages}
        currentLanguage={currentUser.language}
      />
      
      {loading && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm dark:bg-slate-900/90">
          <Loader2 size={64} className="text-[#F26C21] animate-spin mb-6" />
          <h3 className="text-2xl font-bold text-slate-800 dark:text-white">Loading Team Data...</h3>
        </div>
      )}

      {/* Header */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex-none z-30 px-4 md:px-6 flex items-center justify-between shadow-sm transition-colors duration-300">
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <img 
                src="https://wedomarketing.co.in/wp-content/uploads/2024/04/cropped-1-1536x880.png" 
                alt="WeDo Marketing" 
                className="h-8 md:h-9 w-auto object-contain" 
              />
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
              
              {/* Language Dropdown & Settings - Hidden on Dashboard */}
              {currentView === 'admin' ? (
                <div className="hidden sm:flex items-center gap-2">
                   <h1 className="text-xl font-black text-slate-800 dark:text-white">Project Dashboard</h1>
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-2">
                    <div className="relative group">
                        <select 
                            value={currentUser.language} 
                            onChange={(e) => handleLanguageChange(e.target.value)}
                            className="appearance-none bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 text-sm py-1.5 pl-3 pr-8 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        >
                            {Array.from(new Set(languages)).map(lang => (
                                <option key={lang} value={lang}>{lang} Team</option>
                            ))}
                        </select>
                        <Globe size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 pointer-events-none"/>
                    </div>
                    <button 
                        onClick={() => setShowSettingsModal(true)}
                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                        title="Settings"
                    >
                        <Settings size={18} />
                    </button>
                </div>
              )}
            </div>

            {/* Navigation Tabs */}
            {currentView !== 'admin' && (
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg ml-2 md:ml-6">
                <button 
                    onClick={() => setCurrentView('daily')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs md:text-sm font-bold transition-all ${currentView === 'daily' ? 'bg-white dark:bg-slate-700 text-[#F26C21] dark:text-[#F26C21] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    <ListChecks size={14} className="md:w-4 md:h-4" /> Daily
                </button>
                <button 
                    onClick={() => setCurrentView('assign')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs md:text-sm font-bold transition-all ${currentView === 'assign' ? 'bg-white dark:bg-slate-700 text-[#F26C21] dark:text-[#F26C21] shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    <UserCheck size={14} className="md:w-4 md:h-4" /> Assign
                </button>
                <button 
                    onClick={() => setCurrentView('track')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs md:text-sm font-bold transition-all ${currentView === 'track' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
                >
                    <LayoutDashboard size={14} className="md:w-4 md:h-4" /> Track
                </button>
                </div>
            )}
        </div>

        <div className="flex items-center gap-3">
             {/* Dark Mode Toggle */}
             <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
             >
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
             </button>

            {/* Dashboard Toggle - Hidden on Mobile */}
            <button 
                onClick={toggleAdminMode}
                className={`hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg font-bold text-xs md:text-sm transition-all ${currentView === 'admin' ? 'bg-slate-800 text-white dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
            >
                {currentView === 'admin' ? <><ArrowLeft size={14}/> Back</> : <><Shield size={14}/> Dashboard</>}
            </button>

            {(currentView === 'daily' || currentView === 'assign') && (
              <button 
                onClick={() => { setEditingBatch(null); setShowBatchModal(true); }}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs md:text-sm shadow-md transition-all active:scale-95"
              >
                <Plus size={16} /> <span className="hidden md:inline">New Batch</span>
              </button>
            )}
            
            {plan && (
                <div className="w-10 h-10 hidden md:flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700" title={cloudSaving ? "Syncing..." : "Saved"}>
                    {cloudSaving || saveStatus === 'saving' ? (
                        <RefreshCw size={18} className="text-blue-500 animate-spin" />
                    ) : (
                        <Cloud size={18} className={projectMeta?.synced ? "text-green-500" : "text-slate-400 dark:text-slate-500"} />
                    )}
                </div>
            )}
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* VIEW: DASHBOARD */}
        {currentView === 'admin' && (
            <AdminPage 
                workers={workers} 
                setWorkers={setWorkers} 
                languages={languages} 
                setLanguages={setLanguages}
                onBack={() => setCurrentView('daily')} 
                currentLanguage={currentUser.language}
                batches={globalBatchesProgress} // Use Global including progress
                plan={plan}
            />
        )}

        {/* VIEW: TRACK */}
        {currentView === 'track' && (
          <main className="flex-1 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative p-4 lg:p-6">
               {error && (
                  <div className="absolute top-6 left-6 right-6 z-50 bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center justify-between shadow-lg">
                    <span className="flex items-center gap-2 font-medium"><XCircle size={20} /> {error}</span>
                    <button onClick={() => setError(null)}><X size={18} /></button>
                  </div>
               )}

               {plan ? (
                 <PlanAnalyze 
                    plan={plan} 
                    workload={workload}
                    workers={filteredWorkers} // Pass Filtered Workers
                    leaves={leaves}
                    batches={filteredBatches} // Pass Filtered Batches
                    projectStatus={projectStatus}
                    onUpdatePlan={handlePlanUpdate}
                    onToggleLeave={toggleLeave}
                    currentUser={currentUser}
                    onSavePlan={() => setShowSaveModal(true)}
                  />
               ) : (
                 <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-3xl border border-slate-200 border-dashed">
                    <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                      <LayoutDashboard size={40} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-black text-slate-700">Ready to Plan</h3>
                    <p className="text-slate-400 mt-2 max-w-xs text-center text-sm">Configure your {currentUser.language} team on the left.</p>
                    <button 
                        onClick={handleManualStart}
                        className="mt-6 px-6 py-2 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-all flex items-center gap-2 shadow-lg"
                    >
                        <PenTool size={16} /> Start Planning
                    </button>
                 </div>
               )}
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
                 allWorkers={workers} // Pass all for add functionality
                 batches={filteredBatches} // Pass Filtered Batches
                 onUpdatePlan={handlePlanUpdate}
                 onDeleteBatch={handleDeleteBatch}
                 onEditBatch={handleEditBatch} 
                 currentLanguage={currentUser.language} 
               />
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 border-dashed">
                   <div className="w-24 h-24 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                      <ListChecks size={40} className="text-slate-300 dark:text-slate-600" />
                   </div>
                   <h2 className="text-2xl font-black text-slate-800 dark:text-slate-200 mb-2">No Active Schedule</h2>
                   <p className="text-slate-500 dark:text-slate-400 max-w-md mb-8 text-center">Start a {currentUser.language} project to track daily progress.</p>
                   <div className="flex gap-4">
                     <button onClick={() => setCurrentView('track')} className="px-6 py-2 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-bold hover:bg-slate-200 dark:hover:bg-slate-700">Go Track</button>
                     <button onClick={handleManualStart} className="px-6 py-2 bg-[#F26C21] text-white rounded-lg font-bold hover:bg-[#d95a10]">Manual Start</button>
                   </div>
               </div>
             )}
          </main>
        )}

        {/* VIEW: ASSIGN WORK */}
        {currentView === 'assign' && (
          <main className="flex-1 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 p-4 lg:p-6">
             {plan ? (
               <AssignWork 
                 plan={plan} 
                 workload={workload} 
                 workers={filteredWorkers} 
                 allWorkers={workers} // Pass all
                 batches={filteredBatches}
                 onUpdatePlan={handlePlanUpdate}
                 currentLanguage={currentUser.language} 
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
    </div>
  );
};

export default App;
