
import React, { useState, useMemo } from 'react';
import { ProductionPlan, Workload, Worker, Batch, TaskAssignment } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Layers, Plus, Trash2, CornerDownRight, Hash, Save, Check, Loader2, ArrowRight, CheckCircle, UserPlus, X, Lock, Zap, FileVideo, Edit3 } from 'lucide-react';

interface AssignWorkProps {
  plan: ProductionPlan;
  workload: Workload;
  workers: Worker[]; // Filtered workers
  allWorkers?: Worker[]; // All workers
  batches?: Batch[];
  onUpdatePlan: (plan: ProductionPlan, saveToCloud?: boolean, dayToSave?: number, assignmentId?: string, isDeletion?: boolean) => void;
  onToggleLeave?: (workerId: string, day: number) => void;
  currentLanguage: string;
}

const AssignWork: React.FC<AssignWorkProps> = ({ 
  plan, 
  workload, 
  workers, 
  allWorkers = [],
  batches = [], 
  onUpdatePlan,
  onToggleLeave,
  currentLanguage
}) => {
  const getProjectStartDate = () => new Date(workload.startDate);
  
  const getDayIndexFromDate = (date: Date) => {
    const start = getProjectStartDate();
    const d1 = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const d2 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = d2.getTime() - d1.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  };

  const getDateFromDayIndex = (dayIndex: number) => {
     const date = getProjectStartDate();
     date.setDate(date.getDate() + (dayIndex - 1));
     return date;
  };

  const getTodayIndex = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return getDayIndexFromDate(today);
  };

  const isDayLockedForTeam = (dayPlan: any) => {
      if (!dayPlan) return false;
      if (dayPlan.lockedTeams?.includes(currentLanguage)) return true;
      if (dayPlan.locked === true && !dayPlan.lockedTeams) return true;
      return false;
  };

  const [selectedDay, setSelectedDay] = useState<number>(() => {
      const todayIdx = getTodayIndex();
      if (todayIdx >= 1) return todayIdx;
      const activeIdx = plan.schedule.length > 0 ? plan.schedule.findIndex(d => !(d.lockedTeams?.includes(currentLanguage) || (d.locked && !d.lockedTeams))) : -1;
      if (activeIdx !== -1) return plan.schedule[activeIdx].day;
      if (plan.schedule.length > 0) return plan.schedule[plan.schedule.length - 1].day;
      return 1;
  });

  const [viewDate, setViewDate] = useState(() => getDateFromDayIndex(selectedDay));
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);

  let currentDayPlan = plan.schedule.find(d => d.day === selectedDay);
  
  if (!currentDayPlan) {
      currentDayPlan = {
          day: selectedDay,
          assignments: [],
          dailyTotalGen: 0,
          dailyTotalEdit: 0,
          locked: false,
          lockedTeams: []
      };
  }

  const isCurrentDayLocked = isDayLockedForTeam(currentDayPlan);

  const handlePrevDay = () => {
    if (selectedDay > 1) {
      const newDay = selectedDay - 1;
      setSelectedDay(newDay);
      setViewDate(getDateFromDayIndex(newDay));
    }
  };

  const handleNextDay = () => {
    const newDay = selectedDay + 1;
    setSelectedDay(newDay);
    setViewDate(getDateFromDayIndex(newDay));
  };

  // --- Worker Display Logic ---
  const defaultTeam = useMemo(() => {
    if (!Array.isArray(workers)) return [];
    return workers.filter(w => w.role !== 'Assist');
  }, [workers]);

  const displayedWorkers = useMemo(() => {
      const relevantWorkerIds = new Set<string>();
      defaultTeam.forEach(w => relevantWorkerIds.add(w.id));

      (currentDayPlan.assignments || []).forEach(task => {
          if (task.taskLanguage) {
              if (task.taskLanguage === currentLanguage) relevantWorkerIds.add(task.workerId);
          } else {
              const worker = allWorkers.find(w => w.id === task.workerId);
              if (worker && (worker.language || 'Telugu') === currentLanguage) relevantWorkerIds.add(task.workerId);
          }
      });

      const list = allWorkers.filter(w => relevantWorkerIds.has(w.id));
      return list.sort((a, b) => {
          const aIsDefault = defaultTeam.some(dt => dt.id === a.id);
          const bIsDefault = defaultTeam.some(dt => dt.id === b.id);
          if (aIsDefault && !bIsDefault) return -1;
          if (!aIsDefault && bIsDefault) return 1;
          return 0;
      });
  }, [defaultTeam, currentDayPlan.assignments, allWorkers, currentLanguage]);

  // Calculate Team Stats (Gen/Edit Counts for THIS language)
  const teamStats = useMemo(() => {
      let gen = 0;
      let edit = 0;
      (currentDayPlan.assignments || []).forEach(t => {
          const isRelevant = t.taskLanguage === currentLanguage || 
                             (!t.taskLanguage && workers.some(w => w.id === t.workerId));
          if (isRelevant) {
              gen += t.generations;
              edit += t.edits;
          }
      });
      return { gen, edit };
  }, [currentDayPlan.assignments, workers, currentLanguage]);

  // 1. Collect all assigned work per batch globally
  const assignedWorkByBatch = useMemo(() => {
    const map: Record<string, { gen: Set<number>, edit: Set<number> }> = {};
    (plan.schedule || []).forEach(day => {
      (day.assignments || []).forEach(task => {
        if (task.batchId && task.batchId !== 'DEFAULT') {
          if (!map[task.batchId]) {
            map[task.batchId] = { gen: new Set(), edit: new Set() };
          }
          
          if (task.assignedGenRows) {
            task.assignedGenRows.trim().split(/[\s,]+/).forEach(s => {
               const n = parseInt(s);
               if (!isNaN(n)) map[task.batchId].gen.add(n);
            });
          }
          
          if (task.assignedEditRows) {
            task.assignedEditRows.trim().split(/[\s,]+/).forEach(s => {
               const n = parseInt(s);
               if (!isNaN(n)) map[task.batchId].edit.add(n);
            });
          }
        }
      });
    });
    return map;
  }, [plan.schedule]);

  // --- PENDING STATS CALCULATION ---
  const pendingStats = useMemo(() => {
    const aiGenRows: Record<string, number[]> = {};
    const aiEditRows: Record<string, number[]> = {};
    const normalEditRows: Record<string, number[]> = {};

    // 2. Iterate Active Batches for current language (Excluding completed batches)
    const relevantBatches = batches.filter(b => 
        b.status === 'active' && 
        (b.language || 'Telugu') === currentLanguage &&
        (b.progress || 0) < 100 // Exclude 100% completed
    );

    relevantBatches.forEach(batch => {
      const totalCount = batch.aiVideos + batch.normalVideos;
      const bName = batch.batchName;
      
      if (!aiGenRows[bName]) aiGenRows[bName] = [];
      if (!aiEditRows[bName]) aiEditRows[bName] = [];
      if (!normalEditRows[bName]) normalEditRows[bName] = [];

      const parseRows = (str?: string) => {
          const set = new Set<number>();
          if (!str) return set;
          str.trim().split(/[\s,]+/).forEach(s => {
              const n = parseInt(s);
              if (!isNaN(n)) set.add(n);
          });
          return set;
      };

      const dummies = parseRows(batch.dummyRows);
      const normals = parseRows(batch.normalRows);
      const assigned = assignedWorkByBatch[batch.id] || { gen: new Set(), edit: new Set() };

      // STARTING FROM 2 because row 1 is assumed to be headers/excluded
      for (let i = 2; i <= totalCount + 1; i++) {
          if (dummies.has(i)) continue; // Skip dummies

          const isNormal = normals.has(i);

          if (isNormal) {
              // Normal Video: Needs Edit only
              if (!assigned.edit.has(i)) normalEditRows[bName].push(i);
          } else {
              // AI Video: Needs Gen AND Edit
              if (!assigned.gen.has(i)) aiGenRows[bName].push(i);
              if (!assigned.edit.has(i)) aiEditRows[bName].push(i);
          }
      }
    });

    return { aiGenRows, aiEditRows, normalEditRows };
  }, [batches, currentLanguage, assignedWorkByBatch]);

  const validateRowInput = (value: string, batchId?: string, type?: 'gen' | 'edit') => {
      if (!batchId || batchId === 'DEFAULT' || batchId === 'LEAVE') return value;
      
      const batch = batches.find(b => b.id === batchId);
      if (!batch) return value;

      const totalRows = batch.aiVideos + batch.normalVideos;
      const maxRow = totalRows + 1;
      const minRow = 2;

      // Parse normals
      const normalSet = new Set<number>();
      if (batch.normalRows) {
          batch.normalRows.trim().split(/[\s,]+/).forEach(s => {
              const n = parseInt(s);
              if (!isNaN(n)) normalSet.add(n);
          });
      }

      // Parse dummies
      const dummySet = new Set<number>();
      if (batch.dummyRows) {
          batch.dummyRows.trim().split(/[\s,]+/).forEach(s => {
              const n = parseInt(s);
              if (!isNaN(n)) dummySet.add(n);
          });
      }

      const validNumbers: number[] = [];
      const parts = value.split(/[\s,]+/);
      
      parts.forEach(part => {
          // Check for range format "start-end"
          if (part.includes('-')) {
              const [startStr, endStr] = part.split('-');
              const start = parseInt(startStr);
              const end = parseInt(endStr);
              
              if (!isNaN(start) && !isNaN(end) && start <= end) {
                  for (let i = start; i <= end; i++) {
                      if (i >= minRow && i <= maxRow) {
                          validNumbers.push(i);
                      }
                  }
              }
          } else {
              const n = parseInt(part);
              if (!isNaN(n)) {
                  if (n >= minRow && n <= maxRow) {
                      validNumbers.push(n);
                  }
              }
          }
      });

      // Filter based on logic
      const filtered = validNumbers.filter(n => {
          if (dummySet.has(n)) return false; // Filter out dummies
          
          const isNormal = normalSet.has(n);
          
          if (type === 'edit') {
              // If AI video (not normal), check if Gen is assigned/done
              if (!isNormal) {
                  const assigned = assignedWorkByBatch[batchId];
                  // Must be in assigned.gen to be valid for edit assignment
                  // "take the rows ... which are already marked as done"
                  if (assigned && assigned.gen.has(n)) {
                      return true;
                  }
                  return false; 
              }
          }
          return true;
      });

      // Remove duplicates and sort
      const unique = Array.from(new Set(filtered)).sort((a, b) => a - b);
      return unique.join(' ');
  };

  const renderPendingSection = (data: Record<string, number[]>, title: string, icon: React.ReactNode, badgeColor: string) => {
      const batchesList = Object.keys(data).filter(k => data[k].length > 0);
      const totalPending = batchesList.reduce((sum, k) => sum + data[k].length, 0);

      return (
        <div className="flex flex-col bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm shrink-0">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    {icon}
                    <span className="text-[10px] font-bold uppercase text-slate-600">{title}</span>
                </div>
                <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-md text-white ${badgeColor}`}>
                    {totalPending}
                </span>
            </div>
            {totalPending > 0 ? (
                <div className="p-2 space-y-2 overflow-y-auto max-h-[150px] custom-scrollbar">
                    {batchesList.map(batchName => (
                        <div key={batchName}>
                             <div className="flex justify-between items-center mb-0.5">
                                 <span className="text-[10px] font-bold text-slate-700 truncate max-w-[70%]" title={batchName}>{batchName}</span>
                                 <span className="text-[9px] font-bold text-slate-400">{data[batchName].length} rows</span>
                             </div>
                             <div className="text-[10px] font-mono text-slate-500 bg-slate-50 p-1.5 rounded border border-slate-100 break-all leading-snug">
                                 {data[batchName].join(' ')}
                             </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="p-3 text-center text-[10px] text-slate-400 italic">
                    No pending items
                </div>
            )}
        </div>
      );
  };

  const availableToAdd = useMemo(() => {
     const displayedIds = new Set(displayedWorkers.map(w => w.id));
     return allWorkers.filter(w => !displayedIds.has(w.id));
  }, [allWorkers, displayedWorkers]);

  const activeBatches = (batches || []).filter(b => b.status === 'active');

  const getDefaultBatchId = () => {
    const langBatches = (batches || []).filter(b => 
      (b.language || 'Telugu') === currentLanguage && 
      b.status === 'active'
    );
    
    if (langBatches.length === 0) return 'DEFAULT';

    // Sort: prioritize those not finished (< 100%), then by newest
    const sorted = [...langBatches].sort((a, b) => {
      const aFinished = (a.progress || 0) >= 100;
      const bFinished = (b.progress || 0) >= 100;
      if (aFinished !== bFinished) return aFinished ? 1 : -1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    return sorted[0].id;
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() - 7);
    setViewDate(newDate);
  };
  const goToNextWeek = () => {
    const newDate = new Date(viewDate);
    newDate.setDate(viewDate.getDate() + 7);
    setViewDate(newDate);
  };
  const currentCalendarDate = getDateFromDayIndex(selectedDay);

  const handleUpdate = (task: TaskAssignment, field: 'batchId' | 'assignedGenRows' | 'assignedEditRows' | 'plannedGenRows' | 'plannedEditRows', value: any) => {
      const newPlan = { ...plan, schedule: [...plan.schedule] };
      let dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      
      if (dayIdx === -1) {
          const newDayEntry = {
              day: selectedDay,
              assignments: [],
              dailyTotalGen: 0,
              dailyTotalEdit: 0,
              locked: false,
              lockedTeams: []
          };
          newPlan.schedule.push(newDayEntry);
          newPlan.schedule.sort((a, b) => a.day - b.day);
          dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      }
      
      const newDay = { ...newPlan.schedule[dayIdx], assignments: [...(newPlan.schedule[dayIdx].assignments || [])] };
      
      let taskIdx = -1;
      if (task.id) {
          taskIdx = newDay.assignments.findIndex(t => t.id === task.id);
      } else {
          taskIdx = newDay.assignments.findIndex(t => t.workerId === task.workerId && !t.id);
      }

      if (taskIdx !== -1) {
          const updatedTask = { ...newDay.assignments[taskIdx] };
          
          if (field === 'batchId') {
              if (value === 'LEAVE') {
                  updatedTask.isOnLeave = true;
                  updatedTask.plannedGenerations = 0;
                  updatedTask.plannedEdits = 0;
                  updatedTask.batchId = undefined;
                  if (onToggleLeave) onToggleLeave(task.workerId, selectedDay, true, true);
              } else {
                  if (updatedTask.isOnLeave && onToggleLeave) onToggleLeave(task.workerId, selectedDay, false, true);
                  updatedTask.isOnLeave = false;
                  updatedTask.batchId = value;
              }
          } else if (field === 'plannedGenRows' || field === 'plannedEditRows') {
             updatedTask[field] = value;
             const rowString = value as string;
             const count = rowString.trim() === '' ? 0 : rowString.trim().split(/[\s,]+/).filter(Boolean).length;
             
             if (field === 'plannedGenRows') updatedTask.plannedGenerations = count;
             if (field === 'plannedEditRows') updatedTask.plannedEdits = count;
          } else {
              updatedTask[field] = value;
          }
          newDay.assignments[taskIdx] = updatedTask;
      } else {
          const newTask: TaskAssignment = {
              ...task,
              id: task.id || Math.random().toString(36).substr(2, 9),
              [field]: value
          };
          if (field === 'plannedGenRows') {
             const rowString = value as string;
             const count = rowString.trim() === '' ? 0 : rowString.trim().split(/[\s,]+/).filter(Boolean).length;
             newTask.plannedGenerations = count;
          }
          if (field === 'plannedEditRows') {
            const rowString = value as string;
            const count = rowString.trim() === '' ? 0 : rowString.trim().split(/[\s,]+/).filter(Boolean).length;
            newTask.plannedEdits = count;
          }
          newDay.assignments.push(newTask);
      }

      newDay.dailyTotalGen = newDay.assignments.reduce((sum, t) => sum + t.generations, 0);
      newDay.dailyTotalEdit = newDay.assignments.reduce((sum, t) => sum + t.edits, 0);
      newPlan.schedule[dayIdx] = newDay;
      
      newPlan.summary = {
          ...newPlan.summary,
          totalGenerations: newPlan.schedule.reduce((sum, d) => sum + d.dailyTotalGen, 0),
          totalEdits: newPlan.schedule.reduce((sum, d) => sum + d.dailyTotalEdit, 0)
      };

      onUpdatePlan(newPlan, true, selectedDay, task.id || task.workerId);
  };

  const copyGenToEdit = (task: TaskAssignment) => {
      if (!task.plannedGenRows) return;
      handleUpdate(task, 'plannedEditRows', task.plannedGenRows);
  };

  const addSplitAssignment = (worker: Worker) => {
      const newPlan = { ...plan, schedule: [...plan.schedule] };
      let dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      
      if (dayIdx === -1) {
           const newDayEntry = {
              day: selectedDay,
              assignments: [],
              dailyTotalGen: 0,
              dailyTotalEdit: 0,
              locked: false,
              lockedTeams: []
          };
          newPlan.schedule.push(newDayEntry);
          newPlan.schedule.sort((a, b) => a.day - b.day);
          dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      }

      const newDay = { ...newPlan.schedule[dayIdx], assignments: [...(newPlan.schedule[dayIdx].assignments || [])] };
      const newAssignment: TaskAssignment = {
          id: Math.random().toString(36).substr(2, 9),
          workerId: worker.id,
          person: worker.name,
          role: worker.role,
          generations: 0,
          edits: 0,
          plannedGenerations: 0,
          plannedEdits: 0,
          isOnLeave: false,
          batchId: getDefaultBatchId(),
          plannedGenRows: '',
          plannedEditRows: '',
          assignedGenRows: '',
          assignedEditRows: '',
          taskLanguage: currentLanguage 
      };
      
      newDay.assignments.push(newAssignment);
      newPlan.schedule[dayIdx] = newDay;
      onUpdatePlan(newPlan, true, selectedDay, newAssignment.id);
      setShowAddWorkerModal(false);
  };

  const removeAssignment = (assignmentId: string) => {
      const newPlan = { ...plan, schedule: [...plan.schedule] };
      const dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      if (dayIdx === -1) return;

      const newDay = { ...newPlan.schedule[dayIdx] };
      newDay.assignments = (newDay.assignments || []).filter(t => t.id !== assignmentId);
      
      newDay.dailyTotalGen = newDay.assignments.reduce((sum, t) => sum + t.generations, 0);
      newDay.dailyTotalEdit = newDay.assignments.reduce((sum, t) => sum + t.edits, 0);
      newPlan.schedule[dayIdx] = newDay;

      newPlan.summary = {
          ...newPlan.summary,
          totalGenerations: newPlan.schedule.reduce((sum, d) => sum + d.dailyTotalGen, 0),
          totalEdits: newPlan.schedule.reduce((sum, d) => sum + d.dailyTotalEdit, 0)
      };

      onUpdatePlan(newPlan, true, selectedDay, assignmentId, true);
  };

  const handleSave = () => {
    setSaveState('saving');
    onUpdatePlan(plan, true, selectedDay);
    setTimeout(() => setSaveState('saved'), 800);
    setTimeout(() => setSaveState('idle'), 2500);
  };

  const renderCalendar = () => {
    const startOfWeek = new Date(viewDate);
    startOfWeek.setDate(viewDate.getDate() - viewDate.getDay());
    const days = [];
    for (let i = 7; i < 7 + 7; i++) { // Using 7 to 14 loop index to ensure unique keys in case of rapid re-renders/key reuse issues, though simple i is fine usually. Reverting to standard loop.
    }
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayIdx = getDayIndexFromDate(date);
      const dayPlan = plan.schedule.find(p => p.day === dayIdx);
      const isSelected = selectedDay === dayIdx;
      const hasData = !!dayPlan;
      const isLocked = isDayLockedForTeam(dayPlan);

      days.push(
        <button
          key={i}
          onClick={() => {
              if (dayIdx >= 1) {
                  setSelectedDay(dayIdx);
                  setViewDate(date);
              }
          }}
          className={`h-14 border relative flex flex-col items-center justify-center transition-all group rounded-xl ${
            isSelected 
                ? 'bg-[#F26C21] border-[#F26C21] text-white shadow-md z-10 scale-105'
                : hasData
                  ? isLocked 
                    ? 'bg-emerald-50 border-emerald-100'
                    : 'bg-white border-slate-200 hover:border-orange-200'
                  : 'bg-slate-50 border-slate-100 opacity-50 cursor-default'
          }`}
          disabled={dayIdx < 1}
        >
          <span className={`text-[10px] uppercase font-bold mb-0.5 ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <span className={`text-lg font-black ${isSelected ? 'text-white' : hasData ? 'text-slate-700' : 'text-slate-400'}`}>
              {date.getDate()}
          </span>
          
          {(hasData || isSelected) && (
            <div className="absolute top-1.5 right-1.5">
               {isLocked ? (
                   <CheckCircle size={10} className={isSelected ? 'text-white' : 'text-emerald-500'} />
               ) : (
                   <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#F26C21]'}`}></div>
               )}
            </div>
          )}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="h-full flex flex-col animate-fade-in relative">
        {/* ADD WORKER MODAL */}
        {showAddWorkerModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80%]">
                    <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                        <h3 className="font-bold text-slate-800">Add Contributor for Day {selectedDay}</h3>
                        <button onClick={() => setShowAddWorkerModal(false)} className="text-slate-400 hover:text-slate-600"><X size={20}/></button>
                    </div>
                    <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                        {availableToAdd.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">No other workers available to add.</div>
                        ) : (
                            <div className="space-y-1">
                                {availableToAdd.map(w => (
                                    <button 
                                        key={w.id}
                                        onClick={() => addSplitAssignment(w)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${w.role === 'Intern' ? 'bg-purple-400' : w.role === 'Assist' ? 'bg-orange-400' : 'bg-blue-500'}`}>
                                                {w.name.charAt(0)}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-slate-700">{w.name}</div>
                                                <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                    <span>{w.role}</span> • <span>{w.language || 'Telugu'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-slate-300 group-hover:text-blue-500"><Plus size={16} /></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Calendar & Filters */}
            <div className="lg:col-span-4 h-full flex flex-col gap-4 overflow-hidden">
                <div className="flex-none flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <CalendarIcon className="text-[#F26C21]" size={16} />
                            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h2>
                        <div className="flex gap-1">
                            <button onClick={goToPreviousWeek} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronLeft size={16} /></button>
                            <button onClick={goToNextWeek} className="p-1 hover:bg-slate-200 rounded text-slate-500"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                    <div className="p-2 bg-slate-50">
                        <div className="grid grid-cols-7 gap-1.5">
                            {renderCalendar()}
                        </div>
                    </div>
                </div>

                {/* Pending Sections (Moved here) */}
                <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-1 pb-2">
                    {renderPendingSection(pendingStats.aiGenRows, 'Pending Gen', <Zap size={14} className="text-purple-500"/>, 'bg-purple-500')}
                    {renderPendingSection(pendingStats.aiEditRows, 'Pending AI Edit', <FileVideo size={14} className="text-blue-500"/>, 'bg-blue-500')}
                    {renderPendingSection(pendingStats.normalEditRows, 'Pending Normal', <Edit3 size={14} className="text-emerald-500"/>, 'bg-emerald-500')}
                </div>
            </div>

            {/* Right: Assignment List */}
            <div className="lg:col-span-8 h-full flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden relative">
                 <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between min-h-[72px]">
                     <div className="flex items-center gap-2 md:gap-4">
                         <button onClick={handlePrevDay} disabled={selectedDay <= 1} className="lg:hidden p-2 bg-white border border-slate-200 rounded-lg text-slate-500 shadow-sm active:scale-95 disabled:opacity-50">
                             <ChevronLeft size={18} />
                         </button>

                         <div>
                             <div className="flex items-center gap-2">
                                {isCurrentDayLocked && <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded flex gap-1 items-center"><Lock size={8}/> Locked ({currentLanguage})</span>}
                             </div>
                             <div className="flex items-baseline gap-2">
                                 <h2 className="text-lg md:text-xl font-black text-slate-800">
                                     <span className="md:hidden">{currentCalendarDate.toLocaleString('default', { weekday: 'short' })}</span>
                                     <span className="hidden md:inline">{currentCalendarDate.toLocaleString('default', { weekday: 'long' })}</span>
                                 </h2>
                                 <span className="text-slate-500 font-medium text-sm">{currentCalendarDate.toLocaleString('default', { month: 'short', day: 'numeric' })}</span>
                             </div>
                         </div>

                         {/* Mobile Next */}
                         <button onClick={handleNextDay} className="lg:hidden p-2 bg-white border border-slate-200 rounded-lg text-slate-500 shadow-sm active:scale-95">
                             <ChevronRight size={18} />
                         </button>
                     </div>
                     <div className="flex gap-4">
                        <div className="text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Gen</span>
                            <span className="text-lg font-black text-purple-600">{teamStats.gen}</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400">Edit</span>
                            <span className="text-lg font-black text-blue-600">{teamStats.edit}</span>
                        </div>
                     </div>
                 </div>

                 {/* Task List */}
                 <div className="flex-1 overflow-y-auto p-4 space-y-0 custom-scrollbar">
                     {/* Desktop Header with Add Button */}
                     <div className="hidden md:grid grid-cols-12 gap-2 px-2 py-2 text-[10px] uppercase font-bold text-slate-400 tracking-wider bg-slate-50/50 border-b border-slate-100 rounded-t-lg items-center">
                         <div className="col-span-3">Editor</div>
                         <div className="col-span-2">Batch</div>
                         <div className="col-span-2 text-center flex items-center justify-center gap-2">
                             Gen Rows 
                             <button 
                                onClick={() => setShowAddWorkerModal(true)} 
                                className="md:hidden p-1 bg-white border border-slate-200 rounded-md text-slate-400"
                            >
                                <Plus size={10} strokeWidth={4} />
                            </button>
                         </div>
                         <div className="col-span-1 text-center"></div>
                         <div className="col-span-2 text-center">Edit Rows</div>
                         <div className="col-span-2 text-right">Actions</div>
                     </div>
                     
                     {displayedWorkers.length > 0 ? displayedWorkers.map((worker, workerIdx) => {
                        let workerTasks = (currentDayPlan.assignments || []).filter(t => t.workerId === worker.id);
                        
                        const relevantTasks = (workerTasks || []).filter(t => {
                            if (t.taskLanguage) return t.taskLanguage === currentLanguage;
                            return (worker.language || 'Telugu') === currentLanguage;
                        });

                        const tasksToRender = relevantTasks.length > 0 ? relevantTasks : [{
                                workerId: worker.id,
                                person: worker.name,
                                role: worker.role,
                                generations: 0,
                                edits: 0,
                                isOnLeave: false,
                                batchId: getDefaultBatchId(),
                                assignedGenRows: '',
                                assignedEditRows: '',
                                taskLanguage: currentLanguage // Virtual one gets current lang
                            } as TaskAssignment];

                        const rowBgClass = workerIdx % 2 === 0 ? 'bg-white' : 'bg-slate-100';

                        return (
                            <div key={worker.id} className={`p-1 rounded-xl transition-colors ${rowBgClass}`}>
                                {tasksToRender.map((task, index) => (
                                    <div key={task.id || `virtual-${index}`} className={`grid grid-cols-12 items-center py-0.5 gap-1 ${index > 0 ? 'mt-1 pt-1 border-t border-slate-200' : ''}`}>
                                        
                                        <div className="col-span-3 flex items-center gap-2 min-w-0 pr-2">
                                            {index === 0 ? (
                                                <>
                                                    <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-sm ${worker.role === 'Intern' ? 'bg-purple-400' : worker.role === 'Assist' ? 'bg-orange-400' : 'bg-blue-500'}`}>{worker.name.charAt(0)}</div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="text-sm font-bold text-slate-700 truncate" title={worker.name}>{worker.name}</div>
                                                        <div className="text-[10px] text-slate-400 truncate flex items-center gap-1">
                                                                {worker.role} {worker.language !== currentLanguage && <span className="bg-slate-200 px-1 rounded text-slate-600">{worker.language}</span>}
                                                        </div>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="flex items-center gap-3 pl-4 opacity-50">
                                                    <CornerDownRight size={16} className="text-slate-300" />
                                                </div>
                                            )}
                                        </div>

                                        <div className="col-span-2 min-w-0">
                                            <select 
                                                value={task.isOnLeave ? 'LEAVE' : (task.batchId || 'DEFAULT')}
                                                onChange={(e) => handleUpdate(task, 'batchId', e.target.value)}
                                                className={`w-full py-1 h-8 px-2 rounded-md text-[10px] font-bold border outline-none cursor-pointer transition-colors bg-white border-slate-200 text-slate-700 hover:border-blue-300 focus:border-blue-500 min-w-0`}
                                            >
                                                {activeBatches.map(b => (
                                                    <option key={b.id} value={b.id}>{b.batchName}</option>
                                                ))}
                                                <option value="DEFAULT">General</option>
                                                <option value="LEAVE">LEAVE</option>
                                            </select>
                                        </div>

                                        <div className="col-span-2">
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={task.plannedGenRows || ''} 
                                                    onChange={(e) => handleUpdate(task, 'plannedGenRows', e.target.value)} 
                                                    onBlur={(e) => {
                                                        const valid = validateRowInput(e.target.value, task.batchId, 'gen');
                                                        if (valid !== e.target.value) {
                                                            handleUpdate(task, 'plannedGenRows', valid);
                                                        }
                                                    }}
                                                    className={`w-full py-1 h-8 px-2 font-mono text-sm font-bold border border-purple-200 rounded-md outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50/30 text-slate-900 placeholder:text-slate-300 text-center min-w-0`} 
                                                    placeholder=""
                                                />
                                            </div>
                                        </div>

                                        <div className="col-span-1 flex justify-center">
                                            <button 
                                                onClick={() => copyGenToEdit(task)}
                                                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Copy Gen to Edit"
                                            >
                                                =
                                            </button>
                                        </div>

                                        <div className="col-span-2">
                                            <div className="relative">
                                                <input 
                                                    type="text" 
                                                    value={task.plannedEditRows || ''} 
                                                    onChange={(e) => handleUpdate(task, 'plannedEditRows', e.target.value)} 
                                                    onBlur={(e) => {
                                                        const valid = validateRowInput(e.target.value, task.batchId, 'edit');
                                                        if (valid !== e.target.value) {
                                                            handleUpdate(task, 'plannedEditRows', valid);
                                                        }
                                                    }}
                                                    className={`w-full py-1 h-8 px-2 font-mono text-sm font-bold border border-blue-200 rounded-md outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50/30 text-slate-900 placeholder:text-slate-300 text-center min-w-0`} 
                                                    placeholder=""
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="col-span-2 flex justify-end">
                                            {index === 0 ? (
                                                <button 
                                                    onClick={() => addSplitAssignment(worker)}
                                                    className="p-1.5 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex-shrink-0"
                                                    title="Split Task"
                                                >
                                                    <Plus size={16} />
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => task.id && removeAssignment(task.id)}
                                                    className="p-1.5 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                                                    title="Remove Split"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                     }) : (
                         <div className="text-center py-8 text-slate-400 text-sm">
                             No team members found for this language on this day.
                         </div>
                     )}
                 </div>

                 <div className="p-3 border-t border-slate-100 bg-slate-50 flex justify-end">
                    <button 
                        onClick={handleSave} 
                        disabled={saveState === 'saving'}
                        className={`py-3 px-6 rounded-xl font-bold text-sm shadow-md transition-all active:scale-95 flex items-center gap-2 ${
                            saveState === 'saved' 
                            ? 'bg-emerald-500 text-white shadow-emerald-200' 
                            : 'bg-[#F26C21] text-white hover:bg-[#d95a10] shadow-orange-200'
                        }`}
                    >
                       {saveState === 'saving' ? (
                          <><Loader2 size={16} className="animate-spin"/> Saving...</>
                       ) : saveState === 'saved' ? (
                          <><Check size={16} /> Saved!</>
                       ) : (
                          <><Save size={16} /> Save Assignments</>
                       )}
                    </button>
                 </div>
            </div>
        </div>
    </div>
  );
};

export default AssignWork;
