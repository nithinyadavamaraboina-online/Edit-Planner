
import React, { useState, useMemo } from 'react';
import { ProductionPlan, Workload, Worker, Batch, TaskAssignment } from '../types';
import { Lock, Unlock, CheckCircle, Calendar as CalendarIcon, Edit3, Film, ArrowLeft, ChevronLeft, ChevronRight, Check, Plus, Layers, PieChart, Clock, Trash2, CornerDownRight, Split, Hash, UserPlus, X, AlertCircle } from 'lucide-react';

interface DailyUpdateProps {
  plan: ProductionPlan;
  workload: Workload;
  workers: Worker[]; // Filtered workers for current team (contains assists too, usually)
  allWorkers?: Worker[]; // All workers for lookup
  batches?: Batch[];
  leaves?: Record<string, number[]>; // Add leaves prop
  onUpdatePlan: (plan: ProductionPlan, saveToCloud?: boolean, dayToSave?: number, assignmentId?: string, isDeletion?: boolean) => void;
  onToggleLeave?: (workerId: string, day: number, forceState?: boolean, basePlan?: any, duration?: number) => void;
  onDeleteBatch: (batchId: string) => void;
  onEditBatch: (batch: Batch) => void;
  currentLanguage: string;
  readOnlyBatches?: boolean;
  onNewBatch?: () => void;
}

const DailyUpdate: React.FC<DailyUpdateProps> = ({ 
  plan, 
  workload, 
  workers, 
  allWorkers = [],
  batches = [], 
  leaves = {}, // Default to empty object
  onUpdatePlan, 
  onToggleLeave,
  onDeleteBatch,
  onEditBatch,
  currentLanguage,
  readOnlyBatches = false,
  onNewBatch
}) => {
  // Helper to calculate project timeline
  const getProjectStartDate = () => {
      // Parse YYYY-MM-DD manually to construct a Local Date at 00:00
      // This ensures that when we add days, we stay in Local time, so getDate() returns the expected day.
      // This aligns with App.tsx which uses UTC math to derive the same YYYY-MM-DD string.
      const [y, m, d] = workload.startDate.split('-').map(Number);
      return new Date(y, m - 1, d);
  };
  
  const getDayIndexFromDate = (date: Date) => {
    const start = getProjectStartDate();
    // Normalize input date to midnight local
    const d2 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = d2.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; 
  };

  const getDateFromDayIndex = (dayIndex: number) => {
     const date = getProjectStartDate();
     date.setDate(date.getDate() + (dayIndex - 1));
     return date;
  };

  const isDayLockedForTeam = (dayPlan: any) => {
      if (!dayPlan) return false;
      if (dayPlan.lockedTeams?.includes(currentLanguage)) return true;
      if (dayPlan.locked === true && !dayPlan.lockedTeams) return true;
      return false;
  };

  const getTodayIndex = () => {
    const today = new Date();
    today.setHours(0,0,0,0);
    return getDayIndexFromDate(today);
  };

  // Initialize day selection with Today preference
  const [selectedDay, setSelectedDay] = useState<number>(() => {
      const todayIdx = getTodayIndex();
      if (todayIdx >= 1) return todayIdx;
      const activeIdx = plan.schedule.length > 0 ? plan.schedule.findIndex(d => !isDayLockedForTeam(d)) : -1;
      if (activeIdx !== -1) return plan.schedule[activeIdx].day;
      if (plan.schedule.length > 0) return plan.schedule[plan.schedule.length - 1].day;
      return 1;
  });

  const [viewDate, setViewDate] = useState(() => getDateFromDayIndex(selectedDay));
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // Define currentCalendarDate for display in the UI
  const currentCalendarDate = getDateFromDayIndex(selectedDay);

  // Find existing plan for day or create default
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

  // --- Worker Display Logic ---
  // 1. Default Team Members (excluding Assist)
  const defaultTeam = useMemo(() => {
    if (!Array.isArray(workers)) return [];
    return workers.filter(w => w.role !== 'Assist');
  }, [workers]);

  // 2. Identify Adhoc/Added workers for this day based on TASKS
  const displayedWorkers = useMemo(() => {
      const relevantWorkerIds = new Set<string>();
      
      // Add Default Team Ids first
      defaultTeam.forEach(w => relevantWorkerIds.add(w.id));

      // Scan assignments for explicit additions or assist members
      (currentDayPlan.assignments || []).forEach(task => {
          // If task has explicit language context, use it
          if (task.taskLanguage) {
              if (task.taskLanguage === currentLanguage) {
                  relevantWorkerIds.add(task.workerId);
              }
          } else {
              // Fallback: Check if worker's native language matches current view
              // BUT also check if this task was created in this context (e.g. by checking if batch belongs to this lang)
              const worker = allWorkers.find(w => w.id === task.workerId);
              
              // If worker matches current language, include
              if (worker && (worker.language || 'Telugu') === currentLanguage) {
                  relevantWorkerIds.add(task.workerId);
              }

              // If worker is from another language but has a task with a batch belonging to this language
              if (worker && (worker.language || 'Telugu') !== currentLanguage) {
                  const batch = batches.find(b => b.id === task.batchId);
                  if (batch && (batch.language || 'Telugu') === currentLanguage) {
                      relevantWorkerIds.add(task.workerId);
                  }
              }
          }
      });

      // Filter allWorkers to get the final list objects
      // We sort them: Default Team first, then others (Assist/Guests)
      const list = allWorkers.filter(w => relevantWorkerIds.has(w.id));
      
      return list.sort((a, b) => {
          const aIsDefault = defaultTeam.some(dt => dt.id === a.id);
          const bIsDefault = defaultTeam.some(dt => dt.id === b.id);
          if (aIsDefault && !bIsDefault) return -1;
          if (!aIsDefault && bIsDefault) return 1;
          return 0;
      });
  }, [defaultTeam, currentDayPlan.assignments, allWorkers, currentLanguage, batches]);

  // Calculate Team Stats (Gen/Edit Counts for THIS language)
  const teamStats = useMemo(() => {
      let gen = 0;
      let edit = 0;
      (currentDayPlan.assignments || []).forEach(t => {
          // We include the task if:
          // 1. It is explicitly tagged with this language
          // 2. OR It is NOT tagged, but the worker is part of this team (in filtered 'workers')
          const isRelevant = t.taskLanguage === currentLanguage || 
                             (!t.taskLanguage && workers.some(w => w.id === t.workerId));
          
          if (isRelevant) {
              gen += t.generations;
              edit += t.edits;
          }
      });
      return { gen, edit };
  }, [currentDayPlan.assignments, workers, currentLanguage]);

  const availableToAdd = useMemo(() => {
     // Workers not currently displayed
     const displayedIds = new Set(displayedWorkers.map(w => w.id));
     return allWorkers.filter(w => !displayedIds.has(w.id));
  }, [allWorkers, displayedWorkers]);


  // Calculate Batch Progress
  const batchProgress = useMemo(() => {
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

    (plan.schedule || []).forEach(day => {
        (day.assignments || []).forEach(task => {
            if (task.batchId && task.batchId !== 'DEFAULT') {
                 // Counts all assigned work regardless of lock status to show real-time progress
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
        const totalGenNeeded = b.aiVideos;
        const totalEditNeeded = b.aiVideos + b.normalVideos;
        const totalWorkUnits = totalGenNeeded + totalEditNeeded;
        
        const completedWorkUnits = s.assignedGen + s.assignedEdit;
        const percent = totalWorkUnits > 0 ? Math.round((completedWorkUnits / totalWorkUnits) * 100) : 0;
        
        return {
            ...b,
            progress: Math.min(100, percent),
            completedUnits: completedWorkUnits,
            totalUnits: totalWorkUnits,
            completedGen: s.assignedGen,
            totalGen: totalGenNeeded,
            completedEdit: s.assignedEdit,
            totalEdit: totalEditNeeded
        };
    });
  }, [plan, batches, allWorkers]);

  const activeBatches = useMemo(() => {
    let active = (batchProgress || []).filter(b => b.status === 'active');
    
    // Split into ongoing (< 100%) and completed (=== 100%)
    const ongoing = active.filter(b => (b.progress || 0) < 100);
    const completed = active.filter(b => (b.progress || 0) === 100);
    
    // Sort completed by createdAt desc to get the latest
    completed.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
    
    ongoing.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
    });
    
    return [...ongoing, ...completed];
  }, [batchProgress]);

  const displayBatches = useMemo(() => {
    const ongoing = activeBatches.filter(b => (b.progress || 0) < 100);
    const completed = activeBatches.filter(b => (b.progress || 0) === 100);
    const lastCompleted = completed.length > 0 ? [completed[0]] : [];
    return [...ongoing, ...lastCompleted];
  }, [activeBatches]);

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

  // Navigation
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

  const handlePrevDay = () => {
    const newDay = selectedDay - 1;
    setSelectedDay(newDay);
    setViewDate(getDateFromDayIndex(newDay));
  };

  const handleNextDay = () => {
    const newDay = selectedDay + 1;
    setSelectedDay(newDay);
    setViewDate(getDateFromDayIndex(newDay));
  };

  const copyPlannedForTask = (task: TaskAssignment) => {
    if (isCurrentDayLocked) return;
    
    const newPlan = { ...plan, schedule: [...plan.schedule] };
    const dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
    if (dayIdx === -1) return;
    
    const newDay = { ...newPlan.schedule[dayIdx], assignments: [...(newPlan.schedule[dayIdx].assignments || [])] };
    const taskIdx = newDay.assignments.findIndex(t => t.id === task.id || (t.workerId === task.workerId && !t.id));
    
    if (taskIdx !== -1) {
        const updatedTask = { ...newDay.assignments[taskIdx] };
        
        if (updatedTask.plannedGenRows) {
            updatedTask.assignedGenRows = updatedTask.plannedGenRows;
            updatedTask.generations = updatedTask.plannedGenerations || 0;
        }
        if (updatedTask.plannedEditRows) {
            updatedTask.assignedEditRows = updatedTask.plannedEditRows;
            updatedTask.edits = updatedTask.plannedEdits || 0;
        }
        
        newDay.assignments[taskIdx] = updatedTask;
        newPlan.schedule[dayIdx] = newDay;
        onUpdatePlan(newPlan, true, selectedDay, updatedTask.id || updatedTask.workerId);
    }
  };

  const copyAllPlannedForDay = () => {
    if (isCurrentDayLocked) return;
    
    const newPlan = { ...plan, schedule: [...plan.schedule] };
    const dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
    if (dayIdx === -1) return;
    
    const newDay = { ...newPlan.schedule[dayIdx], assignments: [...(newPlan.schedule[dayIdx].assignments || [])] };
    
    let changed = false;
    newDay.assignments = newDay.assignments.map(task => {
        // Only copy if it belongs to current language and has planned data
        if (task.taskLanguage === currentLanguage && (task.plannedGenRows || task.plannedEditRows)) {
            changed = true;
            const updatedTask = { ...task };
            if (task.plannedGenRows) {
                updatedTask.assignedGenRows = task.plannedGenRows;
                updatedTask.generations = task.plannedGenerations || 0;
            }
            if (task.plannedEditRows) {
                updatedTask.assignedEditRows = task.plannedEditRows;
                updatedTask.edits = task.plannedEdits || 0;
            }
            return updatedTask;
        }
        return task;
    });
    
    if (changed) {
        newPlan.schedule[dayIdx] = newDay;
        onUpdatePlan(newPlan, true, selectedDay);
    }
  };

  // CRUD
  const checkDuplicateRows = (inputStr: string, batchId: string | undefined, type: 'gen' | 'edit', currentTaskId: string | undefined) => {
    if (!inputStr || !batchId || batchId === 'DEFAULT' || batchId === 'LEAVE') return inputStr;
    
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return inputStr;

    const totalRows = batch.aiVideos + batch.normalVideos;
    const maxRow = batch.endRow !== undefined ? batch.endRow : totalRows + 1;
    const minRow = batch.startRow !== undefined ? batch.startRow : 2;

    const inputNumbers = inputStr.split(/[\s,]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
    if (inputNumbers.length === 0) return inputStr;

    const warnings: string[] = [];
    const duplicates = new Set<number>();
    const outOfBounds: number[] = [];

    inputNumbers.forEach(n => {
        if (n < minRow || n > maxRow) {
            outOfBounds.push(n);
        }
    });

    if (outOfBounds.length > 0) {
        warnings.push(`Row(s) [${outOfBounds.join(', ')}] do not belong to the current batch. The valid range is ${minRow} to ${maxRow}.`);
    }

    plan.schedule.forEach(day => {
      (day.assignments || []).forEach(assignment => {
        if (assignment.batchId === batchId && assignment.id !== currentTaskId) {
          const existingRowsStr = type === 'gen' 
            ? (assignment.assignedGenRows || assignment.plannedGenRows || '')
            : (assignment.assignedEditRows || assignment.plannedEditRows || '');
            
          const existingNumbers = existingRowsStr.split(/[\s,]+/).map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
          
          const overlap = inputNumbers.filter(n => existingNumbers.includes(n) && !outOfBounds.includes(n));
          if (overlap.length > 0) {
            const workerName = workers.find(w => w.id === assignment.workerId)?.name || 'Unknown';
            const exactDate = getDateFromDayIndex(day.day).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
            warnings.push(`Row(s) [${overlap.join(', ')}] already done by ${workerName} on ${exactDate}.`);
            overlap.forEach(n => duplicates.add(n));
          }
        }
      });
    });

    if (warnings.length > 0) {
      setDuplicateWarning(warnings.join('\n\n'));
      const cleanNumbers = inputNumbers.filter(n => !duplicates.has(n) && !outOfBounds.includes(n));
      return cleanNumbers.join(' ');
    }
    
    return inputStr;
  };

  const parseDummies = (dummyStr?: string) => {
      if (!dummyStr) return new Set<number>();
      return new Set(dummyStr.split(/[\s,]+/).map(Number).filter(n => !isNaN(n)));
  };

  const parseNormalRows = (str?: string) => {
      if (!str) return new Set<number>();
      return new Set(str.split(/[\s,]+/).map(Number).filter(n => !isNaN(n)));
  };

  const formatRows = (rows: number[]) => {
      if (rows.length === 0) return '';
      rows.sort((a, b) => a - b);
      const ranges: string[] = [];
      let start = rows[0];
      let end = rows[0];
      for (let i = 1; i < rows.length; i++) {
          if (rows[i] === end + 1) {
              end = rows[i];
          } else {
              ranges.push(start === end ? `${start}` : `${start}-${end}`);
              start = rows[i];
              end = rows[i];
          }
      }
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      return ranges.join(', ');
  };

  const getPendingRowsForBatch = (batch: Batch) => {
      const dummySet = parseDummies(batch.dummyRows);
      const normalSet = parseNormalRows(batch.normalRows);
      
      const assignedGenRows = new Set<number>();
      const assignedEditRows = new Set<number>();
      
      plan.schedule.forEach(day => {
          day.assignments.forEach(task => {
              if (task.batchId === batch.id) {
                  if (task.assignedGenRows) {
                      task.assignedGenRows.trim().split(/[\s,]+/).forEach(t => {
                          const n = parseInt(t);
                          if (!isNaN(n)) assignedGenRows.add(n);
                      });
                  }
                  if (task.assignedEditRows) {
                      task.assignedEditRows.trim().split(/[\s,]+/).forEach(t => {
                          const n = parseInt(t);
                          if (!isNaN(n)) assignedEditRows.add(n);
                      });
                  }
              }
          });
      });
      
      const start = batch.startRow || 1;
      const end = batch.endRow || (batch.aiVideos + batch.normalVideos);
      
      const pendingGen: number[] = [];
      const pendingEdit: number[] = [];
      const pendingNormal: number[] = [];
      
      for (let i = start; i <= end; i++) {
          if (dummySet.has(i)) continue;
          
          if (normalSet.has(i)) {
              if (!assignedEditRows.has(i)) {
                  pendingNormal.push(i);
              }
          } else {
              if (!assignedGenRows.has(i)) {
                  pendingGen.push(i);
              }
              if (!assignedEditRows.has(i)) {
                  pendingEdit.push(i);
              }
          }
      }
      
      return { pendingGen, pendingEdit, pendingNormal };
  };

  const handleUpdate = (task: TaskAssignment, field: 'generations' | 'edits' | 'batchId' | 'assignedGenRows' | 'assignedEditRows' | 'notes', value: any) => {
      let val = value;
      if (field === 'generations' || field === 'edits') {
         val = parseInt(value);
         if (isNaN(val)) val = 0;
      }
      
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

      // Helper to count rows excluding dummies
      const countRows = (str: string, batchId?: string) => {
        if (!str || str.trim() === '') return 0;
        const tokens = str.trim().split(/[\s,]+/).filter(Boolean);
        
        if (batchId && batchId !== 'DEFAULT') {
            const batch = batches.find(b => b.id === batchId);
            if (batch && batch.dummyRows) {
                const dummies = new Set(batch.dummyRows.trim().split(/[\s,]+/).map(s => parseInt(s)).filter(n => !isNaN(n)));
                const validNums = tokens.map(s => parseInt(s)).filter(n => !isNaN(n) && !dummies.has(n));
                return validNums.length;
            }
        }
        return tokens.length;
      };

      if (taskIdx !== -1) {
          const updatedTask = { ...newDay.assignments[taskIdx] };
          let currentBatchId = updatedTask.batchId;
          
          if (field === 'batchId') {
              if (value === 'LEAVE') {
                  updatedTask.isOnLeave = true;
                  updatedTask.isHalfDay = false;
                  updatedTask.generations = 0;
                  updatedTask.edits = 0;
                  updatedTask.batchId = undefined;
                  
                  // Update local plan first
                  newDay.assignments[taskIdx] = updatedTask;
                  newPlan.schedule[dayIdx] = newDay;
                  
                  if (onToggleLeave) {
                      onToggleLeave(task.workerId, selectedDay, true, newPlan);
                      return; // Skip onUpdatePlan
                  }
              } else if (value === 'HALF_DAY') {
                  updatedTask.isOnLeave = false;
                  updatedTask.isHalfDay = true;
                  updatedTask.generations = 0;
                  updatedTask.edits = 0;
                  updatedTask.batchId = undefined;
                  
                  // Update local plan first
                  newDay.assignments[taskIdx] = updatedTask;
                  newPlan.schedule[dayIdx] = newDay;
                  
                  if (onToggleLeave) {
                      onToggleLeave(task.workerId, selectedDay, true, newPlan, 0.5);
                      return; // Skip onUpdatePlan
                  }
              } else {
                  if (updatedTask.isOnLeave || updatedTask.isHalfDay) {
                       updatedTask.isOnLeave = false;
                       updatedTask.isHalfDay = false;
                       updatedTask.batchId = value;
                       currentBatchId = value;

                       // Update local plan first
                       newDay.assignments[taskIdx] = updatedTask;
                       newPlan.schedule[dayIdx] = newDay;

                       if (onToggleLeave) {
                           onToggleLeave(task.workerId, selectedDay, false, newPlan);
                           return; // Skip onUpdatePlan
                       }
                  }
                  
                  updatedTask.isOnLeave = false;
                  updatedTask.batchId = value;
                  currentBatchId = value;
                  if (value === 'OTHER') {
                      updatedTask.generations = 0;
                      updatedTask.edits = 0;
                      updatedTask.assignedGenRows = '';
                      updatedTask.assignedEditRows = '';
                  }
                  // Recalculate based on new batch constraints if rows exist
                  // ... (rest of logic)
              }
          } else if (field === 'assignedGenRows' || field === 'assignedEditRows') {
             updatedTask[field] = val;
             const count = countRows(val as string, currentBatchId);
             if (field === 'assignedGenRows') updatedTask.generations = count;
             if (field === 'assignedEditRows') updatedTask.edits = count;
          } else {
              // @ts-ignore
              updatedTask[field] = val;
          }
          newDay.assignments[taskIdx] = updatedTask;
      } else {
          // Creating New Task
          const newTask: TaskAssignment = {
              ...task,
              id: task.id || Math.random().toString(36).substr(2, 9),
              [field]: val
          };
          
          let currentBatchId = newTask.batchId;
          if (field === 'batchId') {
              if (value === 'LEAVE') {
                newTask.isOnLeave = true;
                newTask.generations = 0;
                newTask.edits = 0;
                newTask.batchId = undefined;
                currentBatchId = undefined;
                
                // Push to plan first
                newDay.assignments.push(newTask);
                newPlan.schedule[dayIdx] = newDay;

                if (onToggleLeave) {
                    onToggleLeave(task.workerId, selectedDay, true, newPlan);
                    return; // Skip onUpdatePlan
                }
              } else {
                newTask.isOnLeave = false;
                newTask.batchId = value;
                currentBatchId = value;
              }
          }

          if (field === 'assignedGenRows') {
             newTask.generations = countRows(val as string, currentBatchId);
          } else if (field === 'assignedEditRows') {
             newTask.edits = countRows(val as string, currentBatchId);
          }
          
          // Only push if we haven't already (for non-LEAVE cases)
          if (field !== 'batchId' || value !== 'LEAVE') {
              newDay.assignments.push(newTask);
          }
      }

      newDay.dailyTotalGen = newDay.assignments.reduce((sum, t) => sum + t.generations, 0);
      newDay.dailyTotalEdit = newDay.assignments.reduce((sum, t) => sum + t.edits, 0);
      newPlan.schedule[dayIdx] = newDay;
      
      newPlan.summary = {
          ...newPlan.summary,
          totalGenerations: newPlan.schedule.reduce((sum, d) => sum + d.dailyTotalGen, 0),
          totalEdits: newPlan.schedule.reduce((sum, d) => sum + d.dailyTotalEdit, 0)
      };

      const finalAssignmentId = taskIdx !== -1 ? newDay.assignments[taskIdx].id : newDay.assignments[newDay.assignments.length - 1].id;
      onUpdatePlan(newPlan, true, selectedDay, finalAssignmentId || task.workerId);
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
          isOnLeave: false,
          batchId: getDefaultBatchId(),
          assignedGenRows: '',
          assignedEditRows: '',
          taskLanguage: currentLanguage // Mark this task as belonging to current view
      };
      
      newDay.assignments.push(newAssignment);
      newPlan.schedule[dayIdx] = newDay;
      onUpdatePlan(newPlan, true, selectedDay, newAssignment.id);
      setShowAddWorkerModal(false); // Close modal if used for adding new worker
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

  const toggleLock = () => {
      const newPlan = { ...plan, schedule: [...plan.schedule] };
      let dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      
      if (dayIdx === -1) {
           const newDayEntry = {
              day: selectedDay,
              assignments: workers.map(w => ({ 
                  workerId: w.id, 
                  person: w.name, 
                  role: w.role, 
                  generations: 0, 
                  edits: 0, 
                  isOnLeave: false,
                  batchId: getDefaultBatchId()
              })),
              dailyTotalGen: 0, dailyTotalEdit: 0, locked: false, lockedTeams: [currentLanguage]
          };
          newPlan.schedule.push(newDayEntry);
          newPlan.schedule.sort((a, b) => a.day - b.day);
      } else {
          const day = newPlan.schedule[dayIdx];
          const currentLockedTeams = day.lockedTeams || (day.locked ? ['Telugu', 'Tamil', 'Malayalam', 'Kannada'] : []);
          
          if (currentLockedTeams.includes(currentLanguage)) {
              day.lockedTeams = (currentLockedTeams || []).filter(l => l !== currentLanguage);
          } else {
              day.lockedTeams = [...currentLockedTeams, currentLanguage];
          }
          day.locked = day.lockedTeams.length > 0;
      }
      onUpdatePlan(newPlan, true, selectedDay);
  };

  const renderCalendar = () => {
    const startOfWeek = new Date(viewDate);
    startOfWeek.setDate(viewDate.getDate() - viewDate.getDay());
    const days = [];
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
              setSelectedDay(dayIdx);
              setViewDate(date);
          }}
          className={`h-14 border relative flex flex-col items-center justify-center transition-all group rounded-xl ${
            isSelected 
                ? 'bg-[#F26C21] border-[#F26C21] text-white shadow-md z-10 scale-105'
                : hasData
                  ? isLocked 
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-500'
                  : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-500'
          }`}
        >
          <span className={`text-[10px] uppercase font-bold mb-0.5 ${isSelected ? 'text-orange-100' : 'text-slate-400 dark:text-slate-500'}`}>
              {date.toLocaleDateString('en-US', { weekday: 'short' })}
          </span>
          <span className={`text-lg font-black ${isSelected ? 'text-white' : hasData ? 'text-slate-700 dark:text-slate-200' : 'text-slate-400 dark:text-slate-500'}`}>
              {date.getDate()}
          </span>
          
          {(hasData || isSelected) && (
            <div className="absolute top-1.5 right-1.5">
               {isLocked ? (
                   <CheckCircle size={10} className={isSelected ? 'text-white' : 'text-emerald-500 dark:text-emerald-400'} />
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
    <div className="h-full flex flex-col animate-fade-in relative transition-colors">
        {/* ADD WORKER MODAL */}
        {showAddWorkerModal && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80%] border border-slate-200 dark:border-slate-800">
                    <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">Add Contributor for Day {selectedDay}</h3>
                        <button onClick={() => setShowAddWorkerModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"><X size={20}/></button>
                    </div>
                    <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
                        {availableToAdd.length === 0 ? (
                            <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">No other workers available to add.</div>
                        ) : (
                            <div className="space-y-1">
                                {availableToAdd.map(w => (
                                    <button 
                                        key={w.id}
                                        onClick={() => addSplitAssignment(w)}
                                        className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                                                w.role === 'Intern' ? 'bg-purple-400' : 
                                                w.role === 'Assist' ? 'bg-orange-400' : 
                                                w.role === 'Manager' ? 'bg-emerald-500' :
                                                w.role === 'TL' ? 'bg-teal-500' :
                                                'bg-blue-500'
                                            }`}>
                                                {w.name.charAt(0)}
                                            </div>
                                            <div className="text-left">
                                                <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{w.name}</div>
                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                                                    <span>{w.role}</span> • <span>{w.language || 'Telugu'}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400"><Plus size={16} /></div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        )}

        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-6 overflow-y-auto lg:overflow-hidden custom-scrollbar">
            
            {/* Left Column (Team & Progress) */}
            <div className="lg:col-span-4 flex flex-col gap-4 shrink-0 lg:h-full lg:overflow-y-auto lg:custom-scrollbar">
                <div className="flex-none flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden transition-colors">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
                        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                            <CalendarIcon className="text-[#F26C21]" size={16} />
                            {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h2>
                        <div className="flex gap-1">
                            <button onClick={goToPreviousWeek} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 transition-colors"><ChevronLeft size={16} /></button>
                            <button onClick={goToNextWeek} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 transition-colors"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-800/30">
                        <div className="grid grid-cols-7 gap-1.5">
                            {renderCalendar()}
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 overflow-y-auto min-h-0 custom-scrollbar transition-colors">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Layers className="text-[#F26C21]" size={18} />
                            <h3 className="font-bold text-slate-700 dark:text-slate-200 text-sm">Active Batches ({currentLanguage})</h3>
                        </div>
                        {!readOnlyBatches && onNewBatch && (
                            <button 
                                onClick={onNewBatch}
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shadow-sm transition-all active:scale-95"
                            >
                                <Plus size={14} /> New Batch
                            </button>
                        )}
                    </div>
                    {displayBatches.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-xs bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 border-dashed">
                            No active batches.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {displayBatches.map(batch => {
                                const isCompleted = batch.progress === 100;
                                return (
                                <div key={batch.id} className={`${isCompleted ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800' : 'bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700'} rounded-xl p-3 border relative group transition-colors`}>
                                    {!readOnlyBatches && (
                                        <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onEditBatch(batch);
                                                }}
                                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm transition-colors"
                                                title="Edit Batch"
                                            >
                                                <Edit3 size={12} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if(window.confirm(`Delete batch "${batch.batchName}"?`)) {
                                                        onDeleteBatch(batch.id);
                                                    }
                                                }}
                                                className="p-1 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm transition-colors"
                                                title="Delete Batch"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-2 pr-12">
                                        <div>
                                            <div className={`text-[10px] font-black uppercase tracking-wider truncate max-w-[80px] ${isCompleted ? 'text-emerald-400 dark:text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>{batch.clientName}</div>
                                            <div className={`text-sm font-bold leading-tight truncate max-w-[100px] ${isCompleted ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-800 dark:text-slate-100'}`} title={batch.batchName}>{batch.batchName}</div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                            {isCompleted ? (
                                                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                                    <CheckCircle size={14} className="fill-emerald-100 dark:fill-emerald-900/40" />
                                                </div>
                                            ) : (
                                                <div className="text-lg font-black text-[#F26C21]">{batch.progress}%</div>
                                            )}
                                        </div>
                                    </div>

                                    {isCompleted ? (
                                        <div className="mt-2 mb-2 flex items-center justify-between">
                                             <span className="text-lg font-black text-emerald-500 tracking-widest">COMPLETED</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={`w-full h-1.5 rounded-full overflow-hidden mb-1 ${isCompleted ? 'bg-emerald-200' : 'bg-slate-200'}`}>
                                                <div className={`h-full transition-all duration-500 ${isCompleted ? 'bg-emerald-500' : 'bg-[#F26C21]'}`} style={{ width: `${batch.progress}%` }}></div>
                                            </div>
                                            <div className="flex justify-between items-end mt-2">
                                                <div className="flex flex-col gap-1">
                                                    <div className={`flex items-center gap-1.5 text-[10px] font-medium ${isCompleted ? 'text-emerald-700' : 'text-slate-600'}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-400' : 'bg-purple-500'}`}></span>
                                                        <span className="font-bold">{batch.completedGen}</span>
                                                        <span className="opacity-40">/ {batch.totalGen} G</span>
                                                    </div>
                                                    <div className={`flex items-center gap-1.5 text-[10px] font-medium ${isCompleted ? 'text-emerald-700' : 'text-slate-600'}`}>
                                                        <span className={`w-1.5 h-1.5 rounded-full ${isCompleted ? 'bg-emerald-600' : 'bg-blue-500'}`}></span>
                                                        <span className="font-bold">{batch.completedEdit}</span>
                                                        <span className="opacity-40">/ {batch.totalEdit} E</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            );
                            })}
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Condensed Inputs */}
            <div className="lg:col-span-8 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative transition-colors h-auto lg:h-full min-h-[500px] lg:min-h-0">
                 <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 flex items-center justify-between min-h-[72px] transition-colors">
                     <div className="flex items-center gap-2 md:gap-4">
                         <button onClick={handlePrevDay} className="lg:hidden p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 shadow-sm active:scale-95 transition-colors">
                             <ChevronLeft size={18} />
                         </button>

                         <div>
                             <div className="flex items-center gap-2">
                                {isCurrentDayLocked && <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded flex gap-1 items-center"><Lock size={8}/> Locked ({currentLanguage})</span>}
                             </div>
                             <div className="flex items-baseline gap-2">
                                 <h2 className="text-lg md:text-xl font-black text-slate-800 dark:text-white transition-colors">
                                     <span className="md:hidden">{currentCalendarDate.toLocaleString('default', { weekday: 'short' })}</span>
                                     <span className="hidden md:inline">{currentCalendarDate.toLocaleString('default', { weekday: 'long' })}</span>
                                 </h2>
                                 <span className="text-slate-500 dark:text-slate-400 font-medium text-sm">{currentCalendarDate.toLocaleString('default', { month: 'short', day: 'numeric' })}</span>
                             </div>
                         </div>

                         {/* Mobile Next */}
                         <button onClick={handleNextDay} className="lg:hidden p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 shadow-sm active:scale-95 transition-colors">
                             <ChevronRight size={18} />
                         </button>
                     </div>
                     <div className="flex gap-4">
                        <div className="text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Gen</span>
                            <span className="text-lg font-black text-purple-600 dark:text-purple-400">{teamStats.gen}</span>
                        </div>
                        <div className="text-center">
                            <span className="block text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500">Edit</span>
                            <span className="text-lg font-black text-blue-600 dark:text-blue-400">{teamStats.edit}</span>
                        </div>
                     </div>
                 </div>

                 {/* Task List */}
                 <div className="flex-1 overflow-y-auto p-4 space-y-0 custom-scrollbar bg-white dark:bg-slate-900 transition-colors">
                     {/* Desktop Header with Add Button */}
                     <div className="hidden md:grid grid-cols-12 gap-2 px-2 py-2 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 rounded-t-lg items-center transition-colors">
                         <div className="col-span-3">Editor</div>
                         <div className="col-span-2">Batch</div>
                         <div className="col-span-3 text-center flex items-center justify-center gap-2">
                             Generation 
                             {!isCurrentDayLocked && (
                                 <div className="flex items-center gap-1">
                                     {!readOnlyBatches && (
                                         <button 
                                           onClick={() => setShowAddWorkerModal(true)} 
                                           className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-300 dark:hover:border-blue-500 transition-all text-slate-400 dark:text-slate-600"
                                           title="Add contributor from other team/assist"
                                         >
                                             <Plus size={10} strokeWidth={4} />
                                         </button>
                                     )}
                                     <button 
                                       onClick={copyAllPlannedForDay} 
                                       className="p-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md hover:text-purple-600 dark:hover:text-purple-400 hover:border-purple-300 dark:hover:border-purple-500 transition-all text-slate-400 dark:text-slate-600"
                                       title="Copy All Assigned Data"
                                     >
                                         <Layers size={10} strokeWidth={4} />
                                     </button>
                                 </div>
                             )}
                         </div>
                         <div className="col-span-3 text-center">Editing</div>
                         <div className="col-span-1 text-center"></div>
                     </div>
                     
                     {displayedWorkers.length > 0 ? displayedWorkers.map((worker, workerIdx) => {
                        let workerTasks = (currentDayPlan.assignments || []).filter(t => t.workerId === worker.id);
                        
                        // Filter tasks again for display to only show relevant ones
                        const relevantTasks = (workerTasks || []).filter(t => {
                            // 1. Explicitly tagged with current language
                            if (t.taskLanguage === currentLanguage) return true;
                            
                            // 2. If not tagged, check if the BATCH belongs to this language
                            if (t.batchId && t.batchId !== 'DEFAULT') {
                                const batch = batches.find(b => b.id === t.batchId);
                                if (batch && (batch.language || 'Telugu') === currentLanguage) return true;
                            }

                            // 3. Fallback: If worker belongs to this language and task has no specific language tag
                            if (!t.taskLanguage && (worker.language || 'Telugu') === currentLanguage) return true;

                            return false;
                        });

                        // If no relevant tasks but worker is in list (likely default team member with no task created yet or just filtered out), create virtual
                        // OR if it's a contributor who was added but hasn't had a task saved yet (handled by addSplitAssignment though)
                        if (relevantTasks.length === 0) {
                             if(defaultTeam.some(dt => dt.id === worker.id)) {
                                 // Default member should have a task row
                             } else {
                                 // Contributor with no relevant task? Should not happen due to displayedWorkers logic, 
                                 // unless task was deleted. If so, hide row.
                                 return null;
                             }
                        }

                        // Use filtered relevant tasks for rendering
                        const tasksToRender = relevantTasks.length > 0 ? relevantTasks : [{
                                workerId: worker.id,
                                person: worker.name,
                                role: worker.role,
                                generations: 0,
                                edits: 0,
                                isOnLeave: !!(leaves[worker.id] && leaves[worker.id].includes(selectedDay)),
                                batchId: (leaves[worker.id] && leaves[worker.id].includes(selectedDay)) ? undefined : getDefaultBatchId(),
                                assignedGenRows: '',
                                assignedEditRows: '',
                                taskLanguage: currentLanguage // Virtual one gets current lang
                            } as TaskAssignment];

                        const rowBgClass = workerIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-100 dark:bg-slate-800/40';

                        return (
                            <div key={worker.id} className={`mb-0 p-1 rounded-xl transition-colors ${rowBgClass}`}>
                                {tasksToRender.map((task, index) => (
                                    <div key={task.id || `virtual-${index}`} className={`grid grid-cols-1 md:grid-cols-12 items-center py-1 gap-2 ${index > 0 ? 'border-t border-slate-200 dark:border-slate-800 mt-1 pt-1' : ''} ${task.isOnLeave ? 'opacity-70' : ''}`}>
                                        
                                        <div className="md:col-span-3 flex items-center gap-2 min-w-0 pr-2">
                                            <div className="flex items-center gap-3">
                                                {index === 0 ? (
                                                    <>
                                                        <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                                                            worker.role === 'Intern' ? 'bg-purple-400' : 
                                                            worker.role === 'Assist' ? 'bg-orange-400' : 
                                                            worker.role === 'Manager' ? 'bg-emerald-500' :
                                                            worker.role === 'TL' ? 'bg-teal-500' :
                                                            'bg-blue-500'
                                                        }`}>{worker.name.charAt(0)}</div>
                                                        <div className="min-w-0">
                                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate" title={worker.name}>{worker.name}</div>
                                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate flex items-center gap-1">
                                                                {worker.role} {worker.language !== currentLanguage && <span className="bg-slate-200 dark:bg-slate-800 px-1 rounded text-slate-600 dark:text-slate-300">{worker.language}</span>}
                                                                {!isCurrentDayLocked && task.plannedGenRows && (
                                                                    <button 
                                                                        onClick={() => copyPlannedForTask(task)}
                                                                        className="ml-1 p-0.5 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                                                        title="Copy Assigned Data"
                                                                    >
                                                                        <CornerDownRight size={10} />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-3 pl-4 opacity-50">
                                                        <CornerDownRight size={16} className="text-slate-400" />
                                                        <span className="text-[10px] font-bold text-slate-500 uppercase">Split</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="md:hidden ml-auto">
                                                {!isCurrentDayLocked && !readOnlyBatches && (
                                                    index === 0 ? (
                                                        <button 
                                                            onClick={() => addSplitAssignment(worker)}
                                                            className="p-1.5 bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                            title="Split Task"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    ) : (
                                                        <button 
                                                            onClick={() => task.id && removeAssignment(task.id)}
                                                            className="p-1.5 bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                            title="Remove Split"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )
                                                )}
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 min-w-0">
                                            <select 
                                                disabled={isCurrentDayLocked}
                                                value={task.isOnLeave ? 'LEAVE' : (task.isHalfDay ? 'HALF_DAY' : (task.batchId || 'DEFAULT'))}
                                                onChange={(e) => handleUpdate(task, 'batchId', e.target.value)}
                                                className={`w-full py-1 h-7 px-2 rounded-md text-xs md:text-[10px] font-bold border outline-none cursor-pointer transition-colors ${
                                                    (task.isOnLeave || task.isHalfDay)
                                                    ? (task.isOnLeave ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-500 dark:text-orange-400')
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 focus:border-blue-500'
                                                } ${isCurrentDayLocked ? 'opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                                            >
                                                {displayBatches.filter(b => (b.progress || 0) < 100).map(b => (
                                                    <option key={b.id} value={b.id}>{b.batchName}</option>
                                                ))}
                                                <option value="DEFAULT">General</option>
                                                <option value="OTHER">Other / Learning</option>
                                                <option value="LEAVE">LEAVE</option>
                                                <option value="HALF_DAY">Half Day</option>
                                            </select>
                                        </div>

                                        {task.batchId === 'OTHER' ? (
                                            <div className="md:col-span-6 flex gap-2 items-center">
                                                <span className="md:hidden text-xs font-bold text-slate-400 dark:text-slate-500 w-12 shrink-0">NOTES</span>
                                                <input 
                                                    type="text" 
                                                    disabled={isCurrentDayLocked}
                                                    value={task.notes || ''} 
                                                    onChange={(e) => handleUpdate(task, 'notes' as any, e.target.value)} 
                                                    className={`flex-1 min-w-0 py-1 h-7 px-2 text-left text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 ${isCurrentDayLocked ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                                    placeholder="What did they work on or learn?"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="md:col-span-3 flex gap-2 items-center">
                                                    <span className="md:hidden text-xs font-bold text-slate-400 dark:text-slate-500 w-8 shrink-0">GEN</span>
                                                    {!task.isOnLeave ? (
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            disabled={isCurrentDayLocked}
                                                            value={task.generations} 
                                                            onChange={(e) => handleUpdate(task, 'generations', e.target.value)} 
                                                            className={`no-spinner w-12 py-1 h-7 px-1 text-center font-mono text-sm font-bold bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-md outline-none focus:ring-1 focus:ring-purple-400 focus:bg-white dark:focus:bg-slate-700 transition-all ${isCurrentDayLocked ? 'opacity-50 cursor-not-allowed text-slate-500 dark:text-slate-600' : 'text-slate-900 dark:text-slate-100'}`} 
                                                            placeholder="0"
                                                        />
                                                    ) : <div className="w-12 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700">-</div>}

                                                    {!task.isOnLeave ? (
                                                        <input 
                                                            type="text" 
                                                            disabled={isCurrentDayLocked}
                                                            value={task.assignedGenRows || (task.assignedRows || '')} 
                                                            onChange={(e) => handleUpdate(task, 'assignedGenRows', e.target.value)} 
                                                            onBlur={(e) => {
                                                                const valid = checkDuplicateRows(e.target.value, task.batchId, 'gen', task.id);
                                                                if (valid !== e.target.value) {
                                                                    handleUpdate(task, 'assignedGenRows', valid);
                                                                }
                                                            }}
                                                            className={`flex-1 min-w-0 py-1 h-7 px-2 text-left font-mono text-xs font-bold border border-purple-200 dark:border-purple-800 rounded-md outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50/30 dark:bg-purple-900/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 ${isCurrentDayLocked ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                                            placeholder=""
                                                        />
                                                    ) : <div className="flex-1 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700">-</div>}
                                                </div>

                                                <div className="md:col-span-3 flex gap-2 items-center">
                                                    <span className="md:hidden text-xs font-bold text-slate-400 dark:text-slate-500 w-8 shrink-0">EDIT</span>
                                                    {!task.isOnLeave ? (
                                                        <input 
                                                            type="number" 
                                                            min="0" 
                                                            disabled={isCurrentDayLocked}
                                                            value={task.edits} 
                                                            onChange={(e) => handleUpdate(task, 'edits', e.target.value)} 
                                                            className={`no-spinner w-12 py-1 h-7 px-1 text-center font-mono text-sm font-bold bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-700 transition-all ${isCurrentDayLocked ? 'opacity-50 cursor-not-allowed text-slate-500 dark:text-slate-600' : 'text-slate-900 dark:text-slate-100'}`} 
                                                            placeholder="0"
                                                        />
                                                    ) : <div className="w-12 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700">-</div>}

                                                    {!task.isOnLeave ? (
                                                        <input 
                                                            type="text" 
                                                            disabled={isCurrentDayLocked}
                                                            value={task.assignedEditRows || ''} 
                                                            onChange={(e) => handleUpdate(task, 'assignedEditRows', e.target.value)} 
                                                            onBlur={(e) => {
                                                                const valid = checkDuplicateRows(e.target.value, task.batchId, 'edit', task.id);
                                                                if (valid !== e.target.value) {
                                                                    handleUpdate(task, 'assignedEditRows', valid);
                                                                }
                                                            }}
                                                            className={`flex-1 min-w-0 py-1 h-7 px-2 text-left font-mono text-xs font-bold border border-blue-200 dark:border-blue-800 rounded-md outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50/30 dark:bg-blue-900/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 ${isCurrentDayLocked ? 'opacity-50 cursor-not-allowed' : ''}`} 
                                                            placeholder=""
                                                        />
                                                    ) : <div className="flex-1 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700">-</div>}
                                                </div>
                                            </>
                                        )}
                                        
                                        <div className="hidden md:flex md:col-span-1 justify-center">
                                            {!isCurrentDayLocked && !readOnlyBatches && (
                                                index === 0 ? (
                                                    <button 
                                                        onClick={() => addSplitAssignment(worker)}
                                                        className="p-1.5 bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                                        title="Split Task"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => task.id && removeAssignment(task.id)}
                                                        className="p-1.5 bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                        title="Remove Split"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                )
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
                 </div>                  {!readOnlyBatches && (
                     <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex justify-end transition-colors">
                        <button onClick={toggleLock} className={`w-full py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${isCurrentDayLocked ? 'bg-white dark:bg-slate-800 border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 dark:shadow-none'}`}>
                           {isCurrentDayLocked ? <><Unlock size={16}/> Unlock Day ({currentLanguage})</> : <><Check size={16}/> Lock & Complete Day ({currentLanguage})</>}
                        </button>
                     </div>
                  )}
            </div>
        </div>

        {/* Duplicate Warning Modal */}
        {duplicateWarning && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 transition-colors">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 transition-colors">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-red-800 dark:text-red-400">Duplicate Assignment Detected</h2>
                    </div>
                    <div className="p-5 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-medium transition-colors">
                        {duplicateWarning}
                    </div>
                    <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900 transition-colors">
                        <button 
                            onClick={() => setDuplicateWarning(null)}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default DailyUpdate;
