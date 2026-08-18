import React, { useState, useMemo } from 'react';
import { ProductionPlan, Workload, Worker, Batch, TaskAssignment, AIInsightsResponse } from '../types';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Trash2, Split, Zap, FileVideo, PenTool, CornerDownRight, AlertCircle, Brain, AlertTriangle, Loader2, Star, TrendingUp, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { generateAIInsights } from '../services/geminiService';
import { getRank1WorkerName, getTop3WorkerNames, Rank1Badge } from '../utils/ranking';

interface AssignWorkProps {
  plan: ProductionPlan;
  workload: Workload;
  workers: Worker[];
  allWorkers?: Worker[];
  batches?: Batch[];
  allBatches?: Batch[];
  onUpdatePlan: (plan: ProductionPlan, saveToCloud?: boolean, dayToSave?: number, assignmentId?: string, isDeletion?: boolean) => void;
  onToggleLeave?: (workerId: string, day: number, forceState?: boolean, basePlan?: any, duration?: number) => void;
  currentLanguage: string;
  apiKey?: string;
}

const AssignWork: React.FC<AssignWorkProps> = ({ 
  plan, 
  workload, 
  workers, 
  allWorkers = [],
  batches = [], 
  allBatches = [],
  onUpdatePlan,
  onToggleLeave,
  currentLanguage,
  apiKey = ''
}) => {
  const getProjectStartDate = () => {
      const [y, m, d] = workload.startDate.split('-').map(Number);
      return new Date(y, m - 1, d);
  };
  
  const getDayIndexFromDate = (date: Date) => {
    const start = getProjectStartDate();
    const d2 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffTime = d2.getTime() - start.getTime();
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

  const [selectedDay, setSelectedDay] = useState<number>(() => {
      const todayIdx = getTodayIndex();
      return todayIdx >= 1 ? todayIdx : 1;
  });

  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [viewDate, setViewDate] = useState(() => getDateFromDayIndex(selectedDay));

  const top3Ranks = useMemo(() => {
    const listForRank = allWorkers && allWorkers.length > 0 ? allWorkers : workers;
    const allBatchesList = allBatches && allBatches.length > 0 ? allBatches : batches;
    return getTop3WorkerNames(plan, listForRank, workload.startDate, allBatchesList);
  }, [plan, allWorkers, workers, workload.startDate, batches, allBatches]);

  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [insightsExpanded, setInsightsExpanded] = useState(true);

  const handleGenerateInsights = async () => {
    if (!apiKey) {
      setInsightsError("API Key is required to generate AI insights.");
      return;
    }

    setInsightsLoading(true);
    setInsightsError(null);
    setInsightsExpanded(true);

    try {
      const result = await generateAIInsights(apiKey, plan, allWorkers.length > 0 ? allWorkers : workers, batches);
      setInsights(result);
    } catch (err: any) {
      setInsightsError(err.message || "Failed to generate insights.");
    } finally {
      setInsightsLoading(false);
    }
  };

  const currentCalendarDate = getDateFromDayIndex(selectedDay);

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

  const defaultTeam = useMemo(() => {
    if (!Array.isArray(workers)) return [];
    return workers.filter(w => w.role !== 'Assist');
  }, [workers]);

  const displayedWorkers = useMemo(() => {
      const relevantWorkerIds = new Set<string>();
      if (Array.isArray(defaultTeam)) {
          defaultTeam.forEach(w => relevantWorkerIds.add(w.id));
      }
      (currentDayPlan.assignments || []).forEach(task => {
          if (task.taskLanguage) {
              if (task.taskLanguage === currentLanguage) {
                  relevantWorkerIds.add(task.workerId);
              }
          } else {
              const worker = Array.isArray(allWorkers) ? allWorkers.find(w => w.id === task.workerId) : undefined;
              if (worker && (worker.language || 'Telugu') === currentLanguage) {
                  relevantWorkerIds.add(task.workerId);
              }
              if (worker && (worker.language || 'Telugu') !== currentLanguage) {
                  const batch = Array.isArray(batches) ? batches.find(b => b.id === task.batchId) : undefined;
                  if (batch && (batch.language || 'Telugu') === currentLanguage) {
                      relevantWorkerIds.add(task.workerId);
                  }
              }
          }
      });
      const list = Array.isArray(allWorkers) ? allWorkers.filter(w => relevantWorkerIds.has(w.id)) : [];
      return list.sort((a, b) => {
          const aIsDefault = Array.isArray(defaultTeam) && defaultTeam.some(dt => dt.id === a.id);
          const bIsDefault = Array.isArray(defaultTeam) && defaultTeam.some(dt => dt.id === b.id);
          if (aIsDefault && !bIsDefault) return -1;
          if (!aIsDefault && bIsDefault) return 1;
          return 0;
      });
  }, [defaultTeam, currentDayPlan.assignments, allWorkers, currentLanguage, batches]);

  const activeBatches = useMemo(() => {
      let active = batches.filter(b => b.status === 'active' && (b.language || 'Telugu') === currentLanguage);
      
      const ongoing = active.filter(b => (b.progress || 0) < 100);
      const completed = active.filter(b => (b.progress || 0) === 100);
      
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
  }, [batches, currentLanguage]);

  const displayBatches = useMemo(() => {
      const ongoing = activeBatches.filter(b => (b.progress || 0) < 100);
      const completed = activeBatches.filter(b => (b.progress || 0) === 100);
      const lastCompleted = completed.length > 0 ? [completed[0]] : [];
      return [...ongoing, ...lastCompleted];
  }, [activeBatches]);

  // Calendar logic
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
      if (selectedDay > 1) {
          setSelectedDay(selectedDay - 1);
          setViewDate(getDateFromDayIndex(selectedDay - 1));
      }
  };

  const handleNextDay = () => {
      setSelectedDay(selectedDay + 1);
      setViewDate(getDateFromDayIndex(selectedDay + 1));
  };

  const renderCalendar = () => {
      const startDate = new Date(viewDate);
      startDate.setDate(viewDate.getDate() - viewDate.getDay());
      const days = [];
      for (let i = 0; i < 7; i++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const dayIdx = getDayIndexFromDate(d);
          const isSelected = dayIdx === selectedDay;
          const isToday = dayIdx === getTodayIndex();
          const dayPlan = plan.schedule.find(p => p.day === dayIdx);
          const hasAssignments = dayPlan && dayPlan.assignments && dayPlan.assignments.length > 0;
          
          days.push(
              <button
                  key={i}
                  onClick={() => {
                      setSelectedDay(dayIdx);
                      setViewDate(d);
                  }}
                  className={`flex flex-col items-center p-2 rounded-xl border transition-all ${
                      isSelected 
                          ? 'bg-[#F26C21] border-[#F26C21] text-white shadow-md transform scale-105' 
                          : isToday
                              ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/40'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-[#F26C21] hover:shadow-sm'
                  }`}
              >
                  <span className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-orange-100' : 'text-slate-400 dark:text-slate-500'}`}>
                      {d.toLocaleString('default', { weekday: 'short' })}
                  </span>
                  <span className={`text-lg font-black ${isSelected ? 'text-white' : 'text-slate-700 dark:text-slate-200'}`}>
                      {d.getDate()}
                  </span>
                  <div className="flex gap-1 mt-1 h-1.5">
                      {hasAssignments && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-400'}`}></div>}
                  </div>
              </button>
          );
      }
      return days;
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

  const countValidRows = (str: string, dummySet: Set<number>) => {
      if (!str) return 0;
      const tokens = str.trim().split(/[\s,]+/).filter(Boolean);
      let count = 0;
      tokens.forEach(t => {
          const n = parseInt(t);
          if (!isNaN(n) && !dummySet.has(n)) {
              if (t.toLowerCase().match(/[hvs]$/)) {
                  count += 0.25;
              } else {
                  count += 1;
              }
          }
      });
      return count;
  };

  const getPendingRowsForBatch = (batch: Batch) => {
      const dummySet = parseDummies(batch.dummyRows);
      const normalSet = parseNormalRows(batch.normalRows);
      
      const assignedGenRows = new Set<string>();
      const assignedEditRows = new Set<string>();
      
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

      plan.schedule.forEach(day => {
          day.assignments.forEach(task => {
              if (task.batchId === batch.id) {
                  const genStr = task.assignedGenRows || task.plannedGenRows || "";
                  if (genStr) {
                      genStr.trim().split(/[\s,]+/).forEach(s => {
                          const t = normalizeToken(s);
                          if (t && !dummySet.has(t.num)) {
                              assignedGenRows.add(t.key);
                          }
                      });
                  }
                  const editStr = task.assignedEditRows || task.plannedEditRows || "";
                  if (editStr) {
                      editStr.trim().split(/[\s,]+/).forEach(s => {
                          const t = normalizeToken(s);
                          if (t && !dummySet.has(t.num)) {
                              assignedEditRows.add(t.key);
                          }
                      });
                  }
              }
          });
      });
      
      const start = batch.startRow !== undefined ? batch.startRow : 2;
      const end = batch.endRow !== undefined ? batch.endRow : (batch.aiVideos + batch.normalVideos + start - 1);
      
      const pendingGen: number[] = [];
      const pendingEdit: number[] = [];
      const pendingNormal: number[] = [];
      
      for (let i = start; i <= end; i++) {
          if (dummySet.has(i)) continue;
          
          if (normalSet.has(i)) {
              if (!assignedEditRows.has(`${i}`)) {
                  pendingNormal.push(i);
              }
          } else {
              const isGenAssigned = assignedGenRows.has(`${i}`) || assignedGenRows.has(`${i}h`) || assignedGenRows.has(`${i}v`) || assignedGenRows.has(`${i}s`);
              if (!isGenAssigned) {
                  pendingGen.push(i);
              }
              
              let isEditPending = false;
              if (batch.horizontalVersions || batch.verticalVersions || batch.squareVersions) {
                  if (!assignedEditRows.has(`${i}`)) {
                      if (batch.horizontalVersions && !assignedEditRows.has(`${i}h`)) isEditPending = true;
                      if (batch.verticalVersions && !assignedEditRows.has(`${i}v`)) isEditPending = true;
                      if (batch.squareVersions && !assignedEditRows.has(`${i}s`)) isEditPending = true;
                  }
              } else {
                  if (!assignedEditRows.has(`${i}`)) {
                      isEditPending = true;
                  }
              }
              
              if (isEditPending) {
                  pendingEdit.push(i);
              }
          }
      }
      
      return { pendingGen, pendingEdit, pendingNormal };
  };

  const checkDuplicateRows = (inputStr: string, batchId: string | undefined, type: 'gen' | 'edit', currentTaskId: string | undefined) => {
    if (!inputStr || !batchId || batchId === 'DEFAULT' || batchId === 'LEAVE') return inputStr;
    
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return inputStr;

    const totalRows = batch.aiVideos + batch.normalVideos;
    const maxRow = batch.endRow !== undefined ? batch.endRow : totalRows + 1;
    const minRow = batch.startRow !== undefined ? batch.startRow : 2;

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

    const tokens = inputStr.split(/[\s,]+/).map(normalizeToken).filter((t): t is NonNullable<typeof t> => Boolean(t));
    if (tokens.length === 0) return inputStr;
    
    // Remove internal duplicates
    const seen = new Set<string>();
    const uniqueTokens = tokens.filter(t => {
       if (seen.has(t.key)) return false;
       seen.add(t.key);
       return true;
    });

    let currentTaskStatus = "Completed";
    plan.schedule.forEach(day => {
        (day.assignments || []).forEach(assignment => {
            if (assignment.id === currentTaskId) {
                currentTaskStatus = assignment.status || "Completed";
            }
        });
    });

    if (currentTaskStatus === "Rework") {
        return uniqueTokens.map(t => t.key).join(' ');
    }

    const warnings: string[] = [];
    const duplicates = new Set<string>();
    const outOfBounds = new Set<string>();

    uniqueTokens.forEach(t => {
        if (t.num < minRow || t.num > maxRow) {
            outOfBounds.add(t.key);
        }
    });

    if (outOfBounds.size > 0) {
        warnings.push(`Row(s) [${Array.from(outOfBounds).join(', ')}] do not belong to the current batch. The valid range is ${minRow} to ${maxRow}.`);
    }

    const dummySet = batch.dummyRows ? new Set(batch.dummyRows.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))) : new Set<number>();
    const normalSet = batch.normalRows ? new Set(batch.normalRows.split(/[\s,]+/).map(Number).filter(n => !isNaN(n))) : new Set<number>();
    
    const ungeneratedAI = new Set<string>();
    const invalidNormalForGen = new Set<string>();

    if (type === 'gen') {
        // Allow users to freely assign AI gens without normalSet restrictions
    }

    if (type === 'edit') {
        const generatedSet = new Set<string>();
        plan.schedule.forEach(day => {
            (day.assignments || []).forEach(assignment => {
               if (assignment.batchId === batchId) {
                   const genStr = assignment.assignedGenRows || assignment.plannedGenRows || '';
                   genStr.split(/[\s,]+/).forEach(s => {
                       const t = normalizeToken(s);
                       if (t) generatedSet.add(t.key);
                   });
               }
            });
        });

        uniqueTokens.forEach(t => {
            if (!outOfBounds.has(t.key) && !dummySet.has(t.num) && !normalSet.has(t.num)) {
                // If it's a version, it might not need independent AI generation, but we require the base row to be generated or the version itself
                if (!generatedSet.has(t.key) && !generatedSet.has(`${t.num}`)) {
                    ungeneratedAI.add(t.key);
                }
            }
        });
        
        if (ungeneratedAI.size > 0) {
            warnings.push(`Row(s) [${Array.from(ungeneratedAI).join(', ')}] are AI videos but have not been generated yet. Please add them to the generation column first.`);
        }
    }

    plan.schedule.forEach(day => {
      (day.assignments || []).forEach(assignment => {
        // Skip duplicate checking if the task is "In Progress", meaning it's not finished
        // so the user can enter the rows again today.
        if ((assignment.status || "Completed") !== "Completed") {
           return;
        }

        if (assignment.batchId === batchId && assignment.id !== currentTaskId) {
          const existingRowsStr = type === 'gen' 
            ? (assignment.assignedGenRows || assignment.plannedGenRows || '')
            : (assignment.assignedEditRows || assignment.plannedEditRows || '');
            
          const existingTokens = new Set(
             existingRowsStr.split(/[\s,]+/).map(normalizeToken).filter(Boolean).map(t => t!.key)
          );
          
          const overlap = uniqueTokens.filter(t => existingTokens.has(t.key) && !outOfBounds.has(t.key) && !ungeneratedAI.has(t.key) && !invalidNormalForGen.has(t.key));
          if (overlap.length > 0) {
            const workerName = workers.find(w => w.id === assignment.workerId)?.name || 'Unknown';
            const exactDate = getDateFromDayIndex(day.day).toLocaleDateString('default', { month: 'short', day: 'numeric', year: 'numeric' });
            warnings.push(`Row(s) [${overlap.map(t => t.key).join(', ')}] already assigned to ${workerName} on ${exactDate}.`);
            overlap.forEach(t => duplicates.add(t.key));
          }
        }
      });
    });

    if (warnings.length > 0 || uniqueTokens.length !== tokens.length) {
      if (warnings.length > 0) {
          setDuplicateWarning(warnings.join('\n\n'));
      }
      const cleanTokens = uniqueTokens.filter(t => !duplicates.has(t.key) && !outOfBounds.has(t.key) && !ungeneratedAI.has(t.key) && !invalidNormalForGen.has(t.key));
      return cleanTokens.map(t => t.key).join(' ');
    }
    
    return uniqueTokens.map(t => t.key).join(' ');
  };

  const handleUpdate = (task: TaskAssignment, field: 'plannedGenerations' | 'plannedEdits' | 'batchId' | 'plannedGenRows' | 'plannedEditRows' | 'notes', value: any) => {
      const newPlan = { ...plan };
      const dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      
      if (dayIdx === -1) {
          const newDay: any = {
              day: selectedDay,
              assignments: [],
              dailyTotalGen: 0,
              dailyTotalEdit: 0,
              locked: false,
              lockedTeams: []
          };
          newPlan.schedule.push(newDay);
      }
      
      const updatedDayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      const newDay = { ...newPlan.schedule[updatedDayIdx], assignments: [...(newPlan.schedule[updatedDayIdx].assignments || [])] };
      
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
                  updatedTask.isHalfDay = false;
                  updatedTask.batchId = undefined;
                  if (onToggleLeave) onToggleLeave(task.workerId, selectedDay, true, newPlan);
              } else if (value === 'HALF_DAY') {
                  updatedTask.isOnLeave = false;
                  updatedTask.isHalfDay = true;
                  updatedTask.batchId = undefined;
                  if (onToggleLeave) onToggleLeave(task.workerId, selectedDay, true, newPlan, 0.5);
              } else {
                  if (updatedTask.isOnLeave || updatedTask.isHalfDay) {
                      updatedTask.isOnLeave = false;
                      updatedTask.isHalfDay = false;
                      if (onToggleLeave) onToggleLeave(task.workerId, selectedDay, false, newPlan);
                  }
                  updatedTask.batchId = value;
              }
              updatedTask.plannedGenRows = '';
              updatedTask.plannedEditRows = '';
              updatedTask.plannedGenerations = 0;
              updatedTask.plannedEdits = 0;
          } else if (field === 'plannedGenRows' || field === 'plannedEditRows') {
             updatedTask[field] = value;
             const batch = batches.find(b => b.id === updatedTask.batchId);
             const dummySet = batch ? parseDummies(batch.dummyRows) : new Set<number>();
             const count = countValidRows(value, dummySet);
             if (field === 'plannedGenRows') updatedTask.plannedGenerations = count;
             if (field === 'plannedEditRows') updatedTask.plannedEdits = count;
          } else {
              updatedTask[field] = value;
          }
          
          newDay.assignments[taskIdx] = updatedTask;
      } else {
          const newTask: TaskAssignment = {
              id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
              workerId: task.workerId,
              person: task.person,
              role: task.role,
              generations: 0,
              edits: 0,
              plannedGenerations: 0,
              plannedEdits: 0,
              isOnLeave: field === 'batchId' && value === 'LEAVE',
              isHalfDay: field === 'batchId' && value === 'HALF_DAY',
              batchId: (field === 'batchId' && value !== 'LEAVE' && value !== 'HALF_DAY') ? value : undefined,
              plannedGenRows: field === 'plannedGenRows' ? value : '',
              plannedEditRows: field === 'plannedEditRows' ? value : '',
              taskLanguage: currentLanguage
          };

          if (field === 'batchId') {
              if (value === 'LEAVE' && onToggleLeave) {
                  newDay.assignments.push(newTask);
                  newPlan.schedule[updatedDayIdx] = newDay;
                  onToggleLeave(task.workerId, selectedDay, true, newPlan);
                  return;
              }
              if (value === 'HALF_DAY' && onToggleLeave) {
                  newDay.assignments.push(newTask);
                  newPlan.schedule[updatedDayIdx] = newDay;
                  onToggleLeave(task.workerId, selectedDay, true, newPlan, 0.5);
                  return;
              }
          }
          
          if (field === 'plannedGenRows') {
             const batch = batches.find(b => b.id === newTask.batchId);
             const dummySet = batch ? parseDummies(batch.dummyRows) : new Set<number>();
             newTask.plannedGenerations = countValidRows(value, dummySet);
          } else if (field === 'plannedEditRows') {
             const batch = batches.find(b => b.id === newTask.batchId);
             const dummySet = batch ? parseDummies(batch.dummyRows) : new Set<number>();
             newTask.plannedEdits = countValidRows(value, dummySet);
          } else if (field === 'plannedGenerations' || field === 'plannedEdits') {
              newTask[field] = value;
          }
          
          newDay.assignments.push(newTask);
      }

      newPlan.schedule[updatedDayIdx] = newDay;
      
      const finalAssignmentId = taskIdx !== -1 ? newDay.assignments[taskIdx].id : newDay.assignments[newDay.assignments.length - 1].id;
      onUpdatePlan(newPlan, true, selectedDay, finalAssignmentId || task.workerId);
  };

  const addSplitAssignment = (worker: Worker) => {
      const newPlan = { ...plan };
      const dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      
      if (dayIdx === -1) {
          newPlan.schedule.push({
              day: selectedDay,
              assignments: [],
              dailyTotalGen: 0,
              dailyTotalEdit: 0,
              locked: false,
              lockedTeams: []
          });
      }
      
      const updatedDayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      const newDay = { ...newPlan.schedule[updatedDayIdx], assignments: [...(newPlan.schedule[updatedDayIdx].assignments || [])] };
      
      const newAssignment: TaskAssignment = {
          id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
          workerId: worker.id,
          person: worker.name,
          role: worker.role,
          generations: 0,
          edits: 0,
          plannedGenerations: 0,
          plannedEdits: 0,
          plannedGenRows: '',
          plannedEditRows: '',
          taskLanguage: currentLanguage
      };
      
      newDay.assignments.push(newAssignment);
      newPlan.schedule[updatedDayIdx] = newDay;
      onUpdatePlan(newPlan, true, selectedDay, newAssignment.id);
  };

  const removeAssignment = (assignmentId: string) => {
      const newPlan = { ...plan };
      const dayIdx = newPlan.schedule.findIndex(d => d.day === selectedDay);
      if (dayIdx === -1) return;
      
      const newDay = { ...newPlan.schedule[dayIdx] };
      newDay.assignments = (newDay.assignments || []).filter(t => t.id !== assignmentId);
      
      newPlan.schedule[dayIdx] = newDay;
      onUpdatePlan(newPlan, true, selectedDay, assignmentId, true);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors">
        <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-12 gap-6 overflow-y-auto lg:overflow-hidden custom-scrollbar pt-2">
            
            {/* Left Column (Calendar & Pending) */}
            <div className="lg:col-span-4 flex flex-col gap-4 shrink-0 lg:h-full lg:overflow-y-auto lg:custom-scrollbar">
                <div className="flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 overflow-y-auto min-h-0 custom-scrollbar transition-colors">
                    {(() => {
                        const pendingData = displayBatches.map(b => ({
                            batch: b,
                            pending: getPendingRowsForBatch(b)
                        }));
                        
                        const totalPendingGen = pendingData.reduce((sum, d) => sum + d.pending.pendingGen.length, 0);
                        const totalPendingEdit = pendingData.reduce((sum, d) => sum + d.pending.pendingEdit.length, 0);
                        const totalPendingNormal = pendingData.reduce((sum, d) => sum + d.pending.pendingNormal.length, 0);

                        return (
                            <>
                                {/* PENDING GEN */}
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm shrink-0 transition-colors">
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-black text-xs tracking-widest uppercase">
                                            <Zap size={14} className="fill-current" /> PENDING GEN
                                        </div>
                                        <div className="bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs font-black px-2 py-0.5 rounded-md">
                                            {totalPendingGen}
                                        </div>
                                    </div>
                                    <div className="p-3 flex flex-col gap-4 bg-white dark:bg-slate-900 transition-colors">
                                        {pendingData.filter(d => d.pending.pendingGen.length > 0).map(d => (
                                            <div key={d.batch.id} className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    <span>{d.batch.batchName}</span>
                                                    <span className="text-slate-400 dark:text-slate-500">{d.pending.pendingGen.length} rows</span>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-600 dark:text-slate-400 font-mono leading-relaxed tracking-wider transition-colors">
                                                    {d.pending.pendingGen.join(' ')}
                                                </div>
                                            </div>
                                        ))}
                                        {pendingData.filter(d => d.pending.pendingGen.length > 0).length === 0 && (
                                            <div className="text-xs text-slate-400 dark:text-slate-600 text-center py-2 font-medium">No pending rows</div>
                                        )}
                                    </div>
                                </div>

                                {/* PENDING AI EDIT */}
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm shrink-0 transition-colors">
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-black text-xs tracking-widest uppercase">
                                            <FileVideo size={14} className="fill-current" /> PENDING AI EDIT
                                        </div>
                                        <div className="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-black px-2 py-0.5 rounded-md">
                                            {totalPendingEdit}
                                        </div>
                                    </div>
                                    <div className="p-3 flex flex-col gap-4 bg-white dark:bg-slate-900 transition-colors">
                                        {pendingData.filter(d => d.pending.pendingEdit.length > 0).map(d => (
                                            <div key={d.batch.id} className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    <span>{d.batch.batchName}</span>
                                                    <span className="text-slate-400 dark:text-slate-500">{d.pending.pendingEdit.length} rows</span>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-600 dark:text-slate-400 font-mono leading-relaxed tracking-wider transition-colors">
                                                    {d.pending.pendingEdit.join(' ')}
                                                </div>
                                            </div>
                                        ))}
                                        {pendingData.filter(d => d.pending.pendingEdit.length > 0).length === 0 && (
                                            <div className="text-xs text-slate-400 dark:text-slate-600 text-center py-2 font-medium">No pending rows</div>
                                        )}
                                    </div>
                                </div>

                                {/* PENDING NORMAL */}
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col shadow-sm shrink-0 transition-colors">
                                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                        <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-black text-xs tracking-widest uppercase">
                                            <PenTool size={14} className="fill-current" /> PENDING NORMAL
                                        </div>
                                        <div className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-black px-2 py-0.5 rounded-md">
                                            {totalPendingNormal}
                                        </div>
                                    </div>
                                    <div className="p-3 flex flex-col gap-4 bg-white dark:bg-slate-900 transition-colors">
                                        {pendingData.filter(d => d.pending.pendingNormal.length > 0).map(d => (
                                            <div key={d.batch.id} className="flex flex-col gap-1.5">
                                                <div className="flex justify-between items-center text-xs font-bold text-slate-700 dark:text-slate-200">
                                                    <span>{d.batch.batchName}</span>
                                                    <span className="text-slate-400 dark:text-slate-500">{d.pending.pendingNormal.length} rows</span>
                                                </div>
                                                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-600 dark:text-slate-400 font-mono leading-relaxed tracking-wider transition-colors">
                                                    {d.pending.pendingNormal.join(' ')}
                                                </div>
                                            </div>
                                        ))}
                                        {pendingData.filter(d => d.pending.pendingNormal.length > 0).length === 0 && (
                                            <div className="text-xs text-slate-400 dark:text-slate-600 text-center py-2 font-medium">No pending rows</div>
                                        )}
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            </div>

            {/* Right Column */}
            <div className="lg:col-span-8 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative transition-colors h-auto lg:h-full min-h-[500px] lg:min-h-0">
                 {/* Moved Calendar */}
                 <div className="flex-none flex flex-col bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
                    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 transition-colors">
                        <div className="flex items-center gap-4">
                            <h2 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <CalendarIcon className="text-[#F26C21]" size={16} />
                                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                            </h2>
                        </div>
                        <div className="flex gap-1">
                            <button onClick={goToPreviousWeek} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"><ChevronLeft size={16} /></button>
                            <button onClick={goToNextWeek} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400"><ChevronRight size={16} /></button>
                        </div>
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 transition-colors">
                        <div className="grid grid-cols-7 gap-1.5">
                            {renderCalendar()}
                        </div>
                    </div>
                 </div>

                 {/* Task List */}
                 <div className="flex-1 overflow-y-auto p-4 space-y-0 custom-scrollbar bg-white dark:bg-slate-900 transition-colors">
                     {/* Desktop Header */}
                     <div className="hidden md:grid grid-cols-12 gap-2 px-2 py-2 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 rounded-t-lg items-center transition-colors">
                         <div className="col-span-3">Editor</div>
                         <div className="col-span-2">Batch</div>
                         <div className="col-span-3 text-center">Generation</div>
                         <div className="col-span-3 text-center">Editing</div>
                         <div className="col-span-1 text-center"></div>
                     </div>

                     {Array.isArray(displayedWorkers) && displayedWorkers.map((worker, workerIdx) => {
                        let workerTasks = (currentDayPlan.assignments || []).filter(t => t.workerId === worker.id);
                        
                        if (workerTasks.length === 0) {
                            workerTasks = [{
                                workerId: worker.id,
                                person: worker.name,
                                role: worker.role,
                                generations: 0,
                                edits: 0,
                                plannedGenerations: 0,
                                plannedEdits: 0,
                                plannedGenRows: '',
                                plannedEditRows: '',
                            } as TaskAssignment];
                        }

                        const rowBgClass = workerIdx % 2 === 0 ? 'bg-white dark:bg-slate-900' : 'bg-slate-50/50 dark:bg-slate-800/40';

                        return (
                            <div key={worker.id} className={`mb-0 p-1 rounded-xl transition-colors ${rowBgClass}`}>
                                {workerTasks.map((task, index) => (
                                    <div key={task.id || `virtual-${index}`} className={`grid grid-cols-1 md:grid-cols-12 items-center py-1 gap-2 ${index > 0 ? 'border-t border-slate-200 dark:border-slate-800 mt-1 pt-1' : ''}`}>
                                        
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
                                                            <div className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1" title={worker.name}>
                                                                <span>{worker.name}</span>
                                                                <Rank1Badge 
                                                                    workerName={worker.name} 
                                                                    rank1Name={top3Ranks.rank1} 
                                                                    rank2Name={top3Ranks.rank2} 
                                                                    rank3Name={top3Ranks.rank3} 
                                                                    size={10} 
                                                                />
                                                            </div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div className="flex items-center gap-3 pl-4 opacity-50">
                                                        <CornerDownRight size={16} className="text-slate-400 dark:text-slate-500" />
                                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Split</span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="md:hidden ml-auto">
                                                {index === 0 ? (
                                                    <button 
                                                        onClick={() => addSplitAssignment(worker)}
                                                        className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                        title="Split Task"
                                                    >
                                                        <Plus size={16} />
                                                    </button>
                                                ) : (
                                                    <button 
                                                        onClick={() => task.id && removeAssignment(task.id)}
                                                        className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                        title="Remove Split"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>

                                        <div className="md:col-span-2 flex flex-col justify-center min-w-0">
                                            <select 
                                                value={task.isOnLeave ? 'LEAVE' : (task.isHalfDay ? 'HALF_DAY' : (task.batchId || ''))} 
                                                onChange={(e) => handleUpdate(task, 'batchId', e.target.value)}
                                                className={`w-full py-1 h-7 px-2 rounded-md text-xs md:text-[10px] font-bold border outline-none cursor-pointer transition-colors ${
                                                    (task.isOnLeave || task.isHalfDay)
                                                    ? (task.isOnLeave ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400' : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-500 dark:text-orange-400')
                                                    : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 focus:border-blue-500'
                                                }`}
                                            >
                                                <option value="">Select Batch...</option>
                                                {(() => {
                                                    const base = displayBatches.filter(b => (b.progress || 0) < 100);
                                                    if (task.batchId && task.batchId !== 'OTHER' && task.batchId !== 'LEAVE' && task.batchId !== 'HALF_DAY') {
                                                        const alreadyIn = base.some(b => b.id === task.batchId);
                                                        if (!alreadyIn) {
                                                            const assignedBatch = (batches || []).find(b => b.id === task.batchId);
                                                            if (assignedBatch) {
                                                                return [...base, assignedBatch];
                                                            }
                                                        }
                                                    }
                                                    return base;
                                                })().map(b => (
                                                    <option key={b.id} value={b.id}>{b.batchName}</option>
                                                ))}
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
                                                    placeholder="What are you working on?" 
                                                    value={task.notes || ''} 
                                                    onChange={(e) => handleUpdate(task, 'notes', e.target.value)} 
                                                    className="flex-1 min-w-0 py-1 h-7 px-2 text-left text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600"
                                                />
                                            </div>
                                        ) : (
                                            <>
                                                <div className="md:col-span-3 flex gap-2 items-center min-w-0">
                                                    <span className="md:hidden text-xs font-bold text-slate-400 dark:text-slate-500 w-8 shrink-0">GEN</span>
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        value={task.plannedGenerations || 0} 
                                                        onChange={(e) => handleUpdate(task, 'plannedGenerations', parseInt(e.target.value) || 0)} 
                                                        className="no-spinner w-12 py-1 h-7 px-1 text-center font-mono text-sm font-bold bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-md outline-none focus:ring-1 focus:ring-purple-400 focus:bg-white dark:focus:bg-slate-700 transition-all text-slate-900 dark:text-slate-100"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="e.g. 1-5" 
                                                        value={task.plannedGenRows || ''} 
                                                        onChange={(e) => handleUpdate(task, 'plannedGenRows', e.target.value)} 
                                                        onBlur={(e) => handleUpdate(task, 'plannedGenRows', checkDuplicateRows(e.target.value, task.batchId, 'gen', task.id))}
                                                        className="flex-1 min-w-0 py-1 h-7 px-2 text-left font-mono text-xs font-bold border border-purple-200 dark:border-purple-800 rounded-md outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50/30 dark:bg-purple-900/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                                    />
                                                </div>

                                                <div className="md:col-span-3 flex gap-2 items-center min-w-0">
                                                    <span className="md:hidden text-xs font-bold text-slate-400 dark:text-slate-500 w-8 shrink-0">EDIT</span>
                                                    <input 
                                                        type="number" 
                                                        min="0"
                                                        value={task.plannedEdits || 0} 
                                                        onChange={(e) => handleUpdate(task, 'plannedEdits', parseInt(e.target.value) || 0)} 
                                                        className="no-spinner w-12 py-1 h-7 px-1 text-center font-mono text-sm font-bold bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-700 transition-all text-slate-900 dark:text-slate-100"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="e.g. 1-5" 
                                                        value={task.plannedEditRows || ''} 
                                                        onChange={(e) => handleUpdate(task, 'plannedEditRows', e.target.value)} 
                                                        onBlur={(e) => handleUpdate(task, 'plannedEditRows', checkDuplicateRows(e.target.value, task.batchId, 'edit', task.id))}
                                                        className="flex-1 min-w-0 py-1 h-7 px-2 text-left font-mono text-xs font-bold border border-blue-200 dark:border-blue-800 rounded-md outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50/30 dark:bg-blue-900/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700"
                                                    />
                                                </div>
                                            </>
                                        )}

                                        <div className="hidden md:flex md:col-span-1 justify-center">
                                            {index === 0 ? (
                                                <button 
                                                    onClick={() => addSplitAssignment(worker)}
                                                    className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md transition-colors"
                                                    title="Split Task"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => task.id && removeAssignment(task.id)}
                                                    className="p-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                                                    title="Remove Split"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        );
                     })}
                 </div>
            </div>
        </div>
        
        {/* Duplicate Warning Modal */}
        {duplicateWarning && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 transition-colors">
                    <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-red-50 dark:bg-red-900/20 transition-colors">
                        <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                            <AlertCircle className="text-red-600 dark:text-red-400" size={20} />
                        </div>
                        <h2 className="text-lg font-bold text-red-800 dark:text-red-400">Assignment Warning</h2>
                    </div>
                    <div className="p-5 overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-medium transition-colors">
                        {duplicateWarning}
                    </div>
                    <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50 dark:bg-slate-900 transition-colors">
                        <button 
                            onClick={() => setDuplicateWarning(null)}
                            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-sm rounded-lg shadow-lg shadow-red-200 dark:shadow-none transition-all active:scale-95"
                        >
                            Got It
                        </button>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
};

export default AssignWork;
