import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  ProductionPlan,
  Workload,
  Worker,
  Batch,
  TaskAssignment,
} from "../types";
import {
  Lock,
  Unlock,
  CheckCircle,
  Calendar as CalendarIcon,
  Edit3,
  Film,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Plus,
  Layers,
  PieChart,
  Clock,
  Trash2,
  CornerDownRight,
  Split,
  Hash,
  UserPlus,
  X,
  AlertCircle,
  MessageSquare,
  Crown,
  Medal,
  Award,
  ChevronDown,
  ChevronUp,
  Trophy,
  TrendingUp,
} from "lucide-react";
import { getRank1WorkerName, getTop3WorkerNames, getAllWorkerRankings, Rank1Badge, getCompletedGenVal, getCompletedEditVal, calculateBrandWeights, getBrandWeight } from "../utils/ranking";

interface DailyUpdateProps {
  plan: ProductionPlan;
  workload: Workload;
  workers: Worker[]; // Filtered workers for current team (contains assists too, usually)
  allWorkers?: Worker[]; // All workers for lookup
  batches?: Batch[];
  allBatches?: Batch[];
  leaves?: Record<string, number[]>; // Add leaves prop
  onUpdatePlan: (
    plan: ProductionPlan,
    saveToCloud?: boolean,
    dayToSave?: number,
    assignmentId?: string,
    isDeletion?: boolean,
  ) => void;
  onToggleLeave?: (
    workerId: string,
    day: number,
    forceState?: boolean,
    basePlan?: any,
    duration?: number,
  ) => void;
  onDeleteBatch: (batchId: string) => void;
  onEditBatch: (batch: Batch) => void;
  currentLanguage: string;
  readOnlyBatches?: boolean;
  onNewBatch?: () => void;
  projectMeta?: any;
  onNotifyGoogleChat?: (
    day: number,
    lang: string,
  ) => Promise<{ success: boolean; message?: string }>;
  currentUserWorker?: Worker;
  onNavigateToLeaderboard?: () => void;
}

const renderTeamRankBadge = (rank: number) => {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[10px] font-black border border-amber-500/20 shadow-sm shrink-0 uppercase tracking-wider select-none">
        <Crown size={10} className="fill-amber-500 text-amber-500 shrink-0 animate-pulse" />
        <span>#1</span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded text-[10px] font-black border border-slate-500/20 shadow-sm shrink-0 select-none uppercase tracking-wider">
        <Medal size={10} className="fill-slate-400 text-slate-400 shrink-0" />
        <span>#2</span>
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-700/10 text-amber-800 dark:text-amber-600 rounded text-[10px] font-black border border-amber-700/20 shadow-sm shrink-0 select-none uppercase tracking-wider">
        <Award size={10} className="fill-amber-700 text-amber-700 dark:text-amber-600 shrink-0" />
        <span>#3</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[10px] font-bold border border-slate-200 dark:border-slate-700/50 shrink-0 select-none">
      <span>#{rank}</span>
    </span>
  );
};

let hasShownCompanionPopupGlobal = false;

const DailyUpdate: React.FC<DailyUpdateProps> = ({
  plan,
  workload,
  workers,
  allWorkers = [],
  batches = [],
  allBatches = [],
  leaves = {}, // Default to empty object
  onUpdatePlan,
  onToggleLeave,
  onDeleteBatch,
  onEditBatch,
  currentLanguage,
  readOnlyBatches = false,
  onNewBatch,
  projectMeta,
  onNotifyGoogleChat,
  currentUserWorker,
  onNavigateToLeaderboard,
}) => {
  const [showCompanionPopup, setShowCompanionPopup] = useState(false);
  const [showActiveBatchesMobile, setShowActiveBatchesMobile] = useState(false);
  const [expandedMobileEditorIds, setExpandedMobileEditorIds] = useState<string[]>([]);

  useEffect(() => {
    if (!hasShownCompanionPopupGlobal) {
      setShowCompanionPopup(true);
      hasShownCompanionPopupGlobal = true;
    }
  }, []);

  // Helper to calculate project timeline
  const getProjectStartDate = () => {
    // Parse YYYY-MM-DD manually to construct a Local Date at 00:00
    // This ensures that when we add days, we stay in Local time, so getDate() returns the expected day.
    // This aligns with App.tsx which uses UTC math to derive the same YYYY-MM-DD string.
    const [y, m, d] = workload.startDate.split("-").map(Number);
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
    today.setHours(0, 0, 0, 0);
    return getDayIndexFromDate(today);
  };

  const parseDummies = (str?: string) => {
    const set = new Set<number>();
    if (!str) return set;
    str
      .trim()
      .split(/[\s,]+/)
      .forEach((s) => {
        const n = parseInt(s);
        if (!isNaN(n)) set.add(n);
      });
    return set;
  };

  const parseNormalRows = (str?: string) => {
    if (!str) return new Set<number>();
    return new Set(
      str
        .split(/[\s,]+/)
        .map(Number)
        .filter((n) => !isNaN(n)),
    );
  };

  const countValidRows = (str: string, dummySet: Set<number>) => {
    if (!str) return 0;
    const tokens = str
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean);
    let count = 0;
    tokens.forEach((t) => {
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

  // Initialize day selection with Today preference
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const todayIdx = getTodayIndex();
    if (todayIdx >= 1) return todayIdx;
    const activeIdx =
      plan.schedule.length > 0
        ? plan.schedule.findIndex((d) => !isDayLockedForTeam(d))
        : -1;
    if (activeIdx !== -1) return plan.schedule[activeIdx].day;
    if (plan.schedule.length > 0)
      return plan.schedule[plan.schedule.length - 1].day;
    return 1;
  });

  const [viewDate, setViewDate] = useState(() =>
    getDateFromDayIndex(selectedDay),
  );
  const [showAddWorkerModal, setShowAddWorkerModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [showPending, setShowPending] = useState<Record<string, boolean>>({});

  const top3Ranks = useMemo(() => {
    const listForRank = allWorkers && allWorkers.length > 0 ? allWorkers : workers;
    const allBatchesList = allBatches && allBatches.length > 0 ? allBatches : batches;
    return getTop3WorkerNames(plan, listForRank, workload.startDate, allBatchesList);
  }, [plan, allWorkers, workers, workload.startDate, batches, allBatches]);

  const allWorkerRankings = useMemo(() => {
    const listForRank = allWorkers && allWorkers.length > 0 ? allWorkers : workers;
    const allBatchesList = allBatches && allBatches.length > 0 ? allBatches : batches;
    return getAllWorkerRankings(plan, listForRank, workload.startDate, allBatchesList, 'monthly');
  }, [plan, allWorkers, workers, workload.startDate, batches, allBatches]);

  const [selectedCompanionWorkerId, setSelectedCompanionWorkerId] =
    useState<string>(() => {
      if (currentUserWorker) {
        return currentUserWorker.id;
      }
      const editorsAndInterns = workers.filter(
        (w) => w.role === "Editor" || w.role === "Intern",
      );
      return editorsAndInterns.length > 0
        ? editorsAndInterns[0].id
        : workers.length > 0
          ? workers[0].id
          : "";
    });

  const targetWorker = useMemo(() => {
    if (currentUserWorker) return currentUserWorker;
    const list = allWorkers && allWorkers.length > 0 ? allWorkers : workers;
    return list.find((w) => w.id === selectedCompanionWorkerId);
  }, [currentUserWorker, selectedCompanionWorkerId, allWorkers, workers]);

  const currentUserRankInfo = useMemo(() => {
    if (!targetWorker) return null;
    return (
      allWorkerRankings.find(
        (r) =>
          r.id === targetWorker.id ||
          r.name.trim().toLowerCase() === targetWorker.name.trim().toLowerCase()
      ) || null
    );
  }, [targetWorker, allWorkerRankings]);

  useEffect(() => {
    if (
      currentUserWorker &&
      workers.some((w) => w.id === currentUserWorker.id)
    ) {
      setSelectedCompanionWorkerId(currentUserWorker.id);
    }
  }, [currentUserWorker, workers]);

  // Define currentCalendarDate for display in the UI
  const currentCalendarDate = getDateFromDayIndex(selectedDay);

  // Find existing plan for day or create default
  let currentDayPlan = plan.schedule.find((d) => d.day === selectedDay);

  if (!currentDayPlan) {
    currentDayPlan = {
      day: selectedDay,
      assignments: [],
      dailyTotalGen: 0,
      dailyTotalEdit: 0,
      locked: false,
      lockedTeams: [],
    };
  }

  const isCurrentDayLocked = isDayLockedForTeam(currentDayPlan);

  // --- Worker Display Logic ---
  // 1. Default Team Members (excluding Assist)
  const defaultTeam = useMemo(() => {
    if (!Array.isArray(workers)) return [];
    return workers.filter((w) => w.role !== "Assist");
  }, [workers]);

  // 2. Identify Adhoc/Added workers for this day based on TASKS
  const displayedWorkers = useMemo(() => {
    const relevantWorkerIds = new Set<string>();

    // Add Default Team Ids first
    if (Array.isArray(defaultTeam)) {
      defaultTeam.forEach((w) => relevantWorkerIds.add(w.id));
    }

    // Scan assignments for explicit additions or assist members
    (currentDayPlan.assignments || []).forEach((task) => {
      // If task has explicit language context, use it
      if (task.taskLanguage) {
        if (task.taskLanguage === currentLanguage) {
          relevantWorkerIds.add(task.workerId);
        }
      } else {
        // Fallback: Check if worker's native language matches current view
        // BUT also check if this task was created in this context (e.g. by checking if batch belongs to this lang)
        const worker = Array.isArray(allWorkers) ? allWorkers.find((w) => w.id === task.workerId) : undefined;

        // If worker matches current language, include
        if (worker && (worker.language || "Telugu") === currentLanguage) {
          relevantWorkerIds.add(task.workerId);
        }

        // If worker is from another language but has a task with a batch belonging to this language
        if (worker && (worker.language || "Telugu") !== currentLanguage) {
          const batch = Array.isArray(batches) ? batches.find((b) => b.id === task.batchId) : undefined;
          if (batch && (batch.language || "Telugu") === currentLanguage) {
            relevantWorkerIds.add(task.workerId);
          }
        }
      }
    });

    const list = Array.isArray(allWorkers) ? allWorkers.filter((w) => relevantWorkerIds.has(w.id)) : [];

    // Calculate points for each worker in `list`
    const pointsMap: Record<string, number> = {};
    list.forEach((w) => {
      pointsMap[w.id] = 0;
    });

    if (workload && workload.startDate) {
      const [sy, sm, sd] = workload.startDate.split("-").map(Number);
      const startDate = new Date(Date.UTC(sy, sm - 1, sd));

      const LEADERBOARD_START_DATE = new Date(Date.UTC(2026, 5, 22));
      const allBatchesList = allBatches && allBatches.length > 0 ? allBatches : (batches || []);
      const weights = calculateBrandWeights(plan, workload.startDate, allBatchesList);

      const now = new Date();
      const currentYear = now.getUTCFullYear();
      const currentMonth = now.getUTCMonth();
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));

      (plan.schedule || []).forEach((dayPlan) => {
        const date = new Date(startDate);
        date.setUTCDate(date.getUTCDate() + (dayPlan.day - 1));

        if (date < LEADERBOARD_START_DATE || date < startOfMonth || date > endOfMonth) return;

        (dayPlan.assignments || []).forEach((assignment) => {
          if (pointsMap[assignment.workerId] !== undefined) {
            const batch = allBatchesList.find((b) => b.id === assignment.batchId);
            const brand = (batch?.clientName || "Unassigned").trim();
            const gen = getCompletedGenVal(assignment, allBatchesList);
            const edit = getCompletedEditVal(assignment, allBatchesList);
            const points_ai = gen * getBrandWeight(brand, weights, "AI");
            const points_normal = edit * getBrandWeight(brand, weights, "Normal");
            pointsMap[assignment.workerId] += points_ai + points_normal;
          }
        });
      });
    }

    return list.sort((a, b) => {
      const pointsA = pointsMap[a.id] || 0;
      const pointsB = pointsMap[b.id] || 0;
      if (pointsB !== pointsA) {
        return pointsB - pointsA;
      }
      const aIsDefault = Array.isArray(defaultTeam) && defaultTeam.some((dt) => dt.id === a.id);
      const bIsDefault = Array.isArray(defaultTeam) && defaultTeam.some((dt) => dt.id === b.id);
      if (aIsDefault && !bIsDefault) return -1;
      if (!aIsDefault && bIsDefault) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [
    defaultTeam,
    currentDayPlan.assignments,
    allWorkers,
    currentLanguage,
    batches,
    allBatches,
    plan,
    workload,
  ]);

  // Calculate Team Stats (Gen/Edit Counts for THIS language)
  const teamStats = useMemo(() => {
    let gen = 0;
    let edit = 0;
    (currentDayPlan.assignments || []).forEach((t) => {
      // We include the task if:
      // 1. It is explicitly tagged with this language
      // 2. OR It is NOT tagged, but the worker is part of this team (in filtered 'workers')
      const isRelevant =
        t.taskLanguage === currentLanguage ||
        (!t.taskLanguage && workers.some((w) => w.id === t.workerId));

      if (isRelevant) {
        gen += t.generations;
        edit += t.edits;
      }
    });
    return { gen, edit };
  }, [currentDayPlan.assignments, workers, currentLanguage]);

  const availableToAdd = useMemo(() => {
    // Workers not currently displayed
    const workersArr = Array.isArray(displayedWorkers) ? displayedWorkers : [];
    const displayedIds = new Set(workersArr.map((w) => w.id));
    const allWorkersArr = Array.isArray(allWorkers) ? allWorkers : [];
    return allWorkersArr.filter((w) => !displayedIds.has(w.id));
  }, [allWorkers, displayedWorkers]);

  // Calculate Batch Progress
  const batchProgress = useMemo(() => {
    const stats: Record<string, { 
        completedGenRows: Set<string>; 
        completedEditRows: Set<string>; 
        completedNormalRows: Set<string>;
        legacyGen: number;
        legacyEdit: number;
        legacyNormal: number;
    }> = {};

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

    (plan.schedule || []).forEach((day) => {
      (day.assignments || []).forEach((task) => {
        if (task.batchId && task.batchId !== "DEFAULT") {
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
          
          const isTaskCompleted = (task.status || "Completed") === "Completed" || task.status === "Rework";
          if (isTaskCompleted) {
            const batch = batches.find((b) => b.id === task.batchId);
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

    return batches.map((b) => {
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

        // AI Video Gen
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
      const totalGenNeeded = b.aiVideos;
      const totalEditNeeded = b.aiVideos + b.normalVideos + versionsTotal;
      const totalWorkUnits = totalGenNeeded + totalEditNeeded;

      const completedWorkUnits = assignedGen + assignedEdit + assignedNormal;
      
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

      let percent = totalWorkUnits > 0 ? Math.round((completedWorkUnits / totalWorkUnits) * 100) : 0;
      if (hasPendingRow && percent >= 100) {
        percent = 99; // Cap at 99% if there are physically pending rows
      }

      return {
        ...b,
        progress: Math.min(100, Math.max(0, percent)),
        completedUnits: completedWorkUnits,
        totalUnits: totalWorkUnits,
        completedGen: assignedGen,
        totalGen: totalGenNeeded,
        completedEdit: assignedEdit + assignedNormal,
        totalEdit: totalEditNeeded,
      };
    });
  }, [plan, batches, allWorkers]);

  const activeBatches = useMemo(() => {
    let active = (batchProgress || []).filter((b) => b.status === "active");

    // Split into ongoing (< 100%) and completed (=== 100%)
    const ongoing = active.filter((b) => (b.progress || 0) < 100);
    const completed = active.filter((b) => (b.progress || 0) === 100);

    // Sort completed by createdAt desc to get the latest
    completed.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    ongoing.sort((a, b) => {
      const isASeekho = a.clientName?.toLowerCase().includes("seekho");
      const isBSeekho = b.clientName?.toLowerCase().includes("seekho");
      if (isASeekho && !isBSeekho) return -1;
      if (!isASeekho && isBSeekho) return 1;

      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeB - timeA;
    });

    return [...ongoing, ...completed];
  }, [batchProgress]);

  const displayBatches = useMemo(() => {
    const ongoing = activeBatches.filter((b) => (b.progress || 0) < 100);
    const completed = activeBatches.filter((b) => (b.progress || 0) === 100);
    const lastCompleted = completed.length > 0 ? [completed[0]] : [];
    return [...ongoing, ...lastCompleted];
  }, [activeBatches]);

  const getDefaultBatchId = () => {
    const langBatches = (batches || []).filter(
      (b) =>
        (b.language || "Telugu") === currentLanguage && b.status === "active",
    );

    if (langBatches.length === 0) return "DEFAULT";

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

  const getRelativeDateLabel = (dayIndex: number) => {
    const todayIdx = getTodayIndex();
    if (dayIndex === todayIdx) return "Today";
    if (dayIndex === todayIdx - 1) return "Yesterday";
    if (dayIndex === todayIdx + 1) return "Tomorrow";

    const date = getDateFromDayIndex(dayIndex);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  const renderEditorCompanionSpace = () => {
    return (
      <>
        {showCompanionPopup && (
          <div 
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setShowCompanionPopup(false)}
          >
            <div 
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in zoom-in-95 duration-300 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowCompanionPopup(false)}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-2 mb-2">
                <Crown className="text-amber-500" size={20} />
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-lg">Top Editors</h3>
              </div>

              <div className="flex flex-col gap-3">
                {top3Ranks.rank1 ? (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/30 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-[#F26C21] to-amber-500 flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                      {top3Ranks.rank1.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-base">{top3Ranks.rank1}</span>
                        {renderTeamRankBadge(1)}
                      </div>
                    </div>
                  </div>
                ) : (
                   <div className="text-sm text-slate-500 dark:text-slate-400 text-center py-4">No top editors yet</div>
                )}
                {top3Ranks.rank2 && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-400 to-slate-500 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                      {top3Ranks.rank2.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{top3Ranks.rank2}</span>
                        {renderTeamRankBadge(2)}
                      </div>
                    </div>
                  </div>
                )}
                {top3Ranks.rank3 && (
                  <div className="flex items-center gap-3 p-3 bg-orange-50/50 dark:bg-orange-900/5 border border-orange-100/50 dark:border-orange-900/20 rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-700 to-amber-800 flex items-center justify-center text-white font-bold shadow-sm shrink-0">
                      {top3Ranks.rank3.charAt(0)}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">{top3Ranks.rank3}</span>
                        {renderTeamRankBadge(3)}
                      </div>
                    </div>
                  </div>
                )}

                {currentUserRankInfo && currentUserRankInfo.rank > 3 && (
                  <div className="pt-2.5 mt-1 border-t border-dashed border-slate-200 dark:border-slate-800 flex flex-col gap-1.5">
                    <div className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-0.5">
                      Your Position
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/50 rounded-xl">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 dark:bg-indigo-500 flex items-center justify-center text-white font-black text-xs shadow-sm shrink-0">
                        #{currentUserRankInfo.rank}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1.5">
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate text-sm">
                            {currentUserRankInfo.name}
                          </span>
                          <span className="text-[11px] font-extrabold text-indigo-600 dark:text-indigo-400 bg-indigo-100/80 dark:bg-indigo-900/60 px-2 py-0.5 rounded-md border border-indigo-200/50 dark:border-indigo-800/40">
                            #{currentUserRankInfo.rank} Position
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t border-slate-100 dark:border-slate-800 pt-3 flex flex-col">
                <button
                  onClick={() => {
                    setShowCompanionPopup(false);
                    if (onNavigateToLeaderboard) {
                      onNavigateToLeaderboard();
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#F26C21] to-amber-500 hover:from-[#d95a10] hover:to-amber-600 text-white font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-300 text-sm cursor-pointer"
                >
                  <Trophy size={16} />
                  <span>Check Leaderboard</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const copyPlannedForTask = (task: TaskAssignment) => {
    if (isCurrentDayLocked) return;

    const newPlan = { ...plan, schedule: [...plan.schedule] };
    const dayIdx = newPlan.schedule.findIndex((d) => d.day === selectedDay);
    if (dayIdx === -1) return;

    const newDay = {
      ...newPlan.schedule[dayIdx],
      assignments: [...(newPlan.schedule[dayIdx].assignments || [])],
    };
    const taskIdx = newDay.assignments.findIndex(
      (t) => t.id === task.id || (t.workerId === task.workerId && !t.id),
    );

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
      onUpdatePlan(
        newPlan,
        true,
        selectedDay,
        updatedTask.id || updatedTask.workerId,
      );
    }
  };

  const copyAllPlannedForDay = () => {
    if (isCurrentDayLocked) return;

    const newPlan = { ...plan, schedule: [...plan.schedule] };
    const dayIdx = newPlan.schedule.findIndex((d) => d.day === selectedDay);
    if (dayIdx === -1) return;

    const newDay = {
      ...newPlan.schedule[dayIdx],
      assignments: [...(newPlan.schedule[dayIdx].assignments || [])],
    };

    let changed = false;
    newDay.assignments = newDay.assignments.map((task) => {
      // Only copy if it belongs to current language and has planned data
      if (
        task.taskLanguage === currentLanguage &&
        (task.plannedGenRows || task.plannedEditRows)
      ) {
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
  const checkDuplicateRows = (
    inputStr: string,
    currentTask: TaskAssignment,
    type: "gen" | "edit",
  ) => {
    const batchId = currentTask.batchId;
    if (!inputStr || !batchId || batchId === "DEFAULT" || batchId === "LEAVE")
      return inputStr;

    const batch = batches.find((b) => b.id === batchId);
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

    const currentTaskStatus = currentTask.status || "Completed";

    if (currentTaskStatus === "Rework") {
        // If it's a rework task, we skip checking if other people have completed it.
        // We still format and clean up the input.
        return uniqueTokens.map((t) => t.key).join(" ");
    }

    const warnings: string[] = [];
    const duplicates = new Set<string>();
    const outOfBounds = new Set<string>();

    uniqueTokens.forEach((t) => {
      if (t.num < minRow || t.num > maxRow) {
        outOfBounds.add(t.key);
      }
    });

    if (outOfBounds.size > 0) {
      warnings.push(
        `Row(s) [${Array.from(outOfBounds).join(", ")}] do not belong to the current batch. The valid range is ${minRow} to ${maxRow}.`,
      );
    }

    const dummySet = batch.dummyRows
      ? new Set(
          batch.dummyRows
            .split(/[\s,]+/)
            .map(Number)
            .filter((n) => !isNaN(n)),
        )
      : new Set<number>();
    
    const normalSet = batch.normalRows
      ? new Set(
          batch.normalRows
            .split(/[\s,]+/)
            .map(Number)
            .filter((n) => !isNaN(n)),
        )
      : new Set<number>();

    const ungeneratedAI = new Set<string>();
    const invalidNormalForGen = new Set<string>();
    
    if (type === "gen") {
      uniqueTokens.forEach((t) => {
        if (!outOfBounds.has(t.key) && !dummySet.has(t.num) && normalSet.has(t.num)) {
          invalidNormalForGen.add(t.key);
        }
      });

      if (invalidNormalForGen.size > 0) {
        warnings.push(
          `Row(s) [${Array.from(invalidNormalForGen).join(", ")}] are Normal/Edit videos, not AI videos. They cannot be added as generations.`,
        );
      }
    }

    if (type === "edit") {
      const generatedSet = new Set<string>();
      plan.schedule.forEach((day) => {
        (day.assignments || []).forEach((assignment) => {
          if (assignment.batchId === batchId) {
            const genStr =
              assignment.assignedGenRows || assignment.plannedGenRows || "";
            genStr.split(/[\s,]+/).forEach((s) => {
              const t = normalizeToken(s);
              if (t) generatedSet.add(t.key);
            });
          }
        });
      });

      uniqueTokens.forEach((t) => {
        if (!outOfBounds.has(t.key) && !dummySet.has(t.num) && !normalSet.has(t.num)) {
          // If it's a version, it might not need independent AI generation, but we require the base row to be generated or the version itself
          if (!generatedSet.has(t.key) && !generatedSet.has(`${t.num}`)) {
            ungeneratedAI.add(t.key);
          }
        }
      });

      if (ungeneratedAI.size > 0) {
        warnings.push(
          `Row(s) [${Array.from(ungeneratedAI).join(", ")}] are AI videos but have not been generated yet. Please add them to the generation column first.`,
        );
      }
    }

    plan.schedule.forEach((day) => {
      (day.assignments || []).forEach((assignment) => {
        if ((assignment.status || "Completed") !== "Completed") {
           return;
        }

        if (assignment.batchId === batchId && assignment.id !== currentTask.id) {
          const existingRowsStr =
            type === "gen"
              ? assignment.assignedGenRows || assignment.plannedGenRows || ""
              : assignment.assignedEditRows || assignment.plannedEditRows || "";

          const existingTokens = new Set(
             existingRowsStr.split(/[\s,]+/).map(normalizeToken).filter(Boolean).map(t => t!.key)
          );

          const overlap = uniqueTokens.filter(
            (t) =>
              existingTokens.has(t.key) &&
              !outOfBounds.has(t.key) &&
              !ungeneratedAI.has(t.key) &&
              !invalidNormalForGen.has(t.key),
          );
          if (overlap.length > 0) {
            const workerName =
              workers.find((w) => w.id === assignment.workerId)?.name ||
              "Unknown";
            const exactDate = getDateFromDayIndex(day.day).toLocaleDateString(
              "default",
              { month: "short", day: "numeric", year: "numeric" },
            );
            warnings.push(
              `Row(s) [${overlap.map(t => t.key).join(", ")}] already done by ${workerName} on ${exactDate}.`,
            );
            overlap.forEach((t) => duplicates.add(t.key));
          }
        }
      });
    });

    if (
      warnings.length > 0 ||
      uniqueTokens.length !== tokens.length
    ) {
      if (warnings.length > 0) {
        setDuplicateWarning(warnings.join("\n\n"));
      }
      const cleanTokens = uniqueTokens.filter(
        (t) =>
          !duplicates.has(t.key) &&
          !outOfBounds.has(t.key) &&
          !ungeneratedAI.has(t.key) &&
          !invalidNormalForGen.has(t.key),
      );
      return cleanTokens.map(t => t.key).join(" ");
    }

    return uniqueTokens.map(t => t.key).join(" ");
  };

  const formatRows = (rows: number[]) => {
    if (rows.length === 0) return "";
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
    return ranges.join(", ");
  };

  const getPendingRowsForBatch = (batch: Batch) => {
    const dummySet = parseDummies(batch.dummyRows);
    const normalSet = parseNormalRows(batch.normalRows);

    const completedGenRows = new Set<string>();
    const completedEditRows = new Set<string>();

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

    plan.schedule.forEach((day) => {
      day.assignments.forEach((task) => {
        if (task.batchId === batch.id) {
          const isTaskCompleted = (task.status || "Completed") === "Completed" || task.status === "Rework";
          if (isTaskCompleted) {
            const genStr = task.assignedGenRows || (task as any).plannedGenRows || "";
            if (genStr) {
              genStr
                .trim()
                .split(/[\s,]+/)
                .forEach((s) => {
                  const t = normalizeToken(s);
                  if (t && !dummySet.has(t.num)) {
                    completedGenRows.add(t.key);
                  }
                });
            }
            const editStr = task.assignedEditRows || (task as any).plannedEditRows || "";
            if (editStr) {
              editStr
                .trim()
                .split(/[\s,]+/)
                .forEach((s) => {
                  const t = normalizeToken(s);
                  if (t && !dummySet.has(t.num)) {
                    completedEditRows.add(t.key);
                  }
                });
            }
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
        if (!completedEditRows.has(`${i}`)) {
          pendingNormal.push(i);
        }
      } else {
        const isGenDone = completedGenRows.has(`${i}`) || completedGenRows.has(`${i}h`) || completedGenRows.has(`${i}v`) || completedGenRows.has(`${i}s`);
        if (!isGenDone) {
          pendingGen.push(i);
        }
        
        let isEditPending = false;
        if (batch.horizontalVersions || batch.verticalVersions || batch.squareVersions) {
          if (!completedEditRows.has(`${i}`)) {
              if (batch.horizontalVersions && !completedEditRows.has(`${i}h`)) isEditPending = true;
              if (batch.verticalVersions && !completedEditRows.has(`${i}v`)) isEditPending = true;
              if (batch.squareVersions && !completedEditRows.has(`${i}s`)) isEditPending = true;
          }
        } else {
          if (!completedEditRows.has(`${i}`)) {
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

  const handleUpdate = (
    task: TaskAssignment,
    field:
      | "generations"
      | "edits"
      | "batchId"
      | "assignedGenRows"
      | "assignedEditRows"
      | "notes"
      | "status"
      | "hoursSpent",
    value: any,
  ) => {
    let val = value;
    if (field === "generations" || field === "edits") {
      val = parseInt(value);
      if (isNaN(val)) val = 0;
    } else if (field === "hoursSpent") {
      val = parseFloat(value);
      if (isNaN(val) || val < 0) val = 0;
    }

    const newPlan = { ...plan, schedule: [...plan.schedule] };
    let dayIdx = newPlan.schedule.findIndex((d) => d.day === selectedDay);

    if (dayIdx === -1) {
      const newDayEntry = {
        day: selectedDay,
        assignments: [],
        dailyTotalGen: 0,
        dailyTotalEdit: 0,
        locked: false,
        lockedTeams: [],
      };
      newPlan.schedule.push(newDayEntry);
      newPlan.schedule.sort((a, b) => a.day - b.day);
      dayIdx = newPlan.schedule.findIndex((d) => d.day === selectedDay);
    }

    const newDay = {
      ...newPlan.schedule[dayIdx],
      assignments: [...(newPlan.schedule[dayIdx].assignments || [])],
    };

    let taskIdx = -1;
    if (task.id) {
      taskIdx = newDay.assignments.findIndex((t) => t.id === task.id);
    } else {
      taskIdx = newDay.assignments.findIndex(
        (t) => t.workerId === task.workerId && !t.id,
      );
    }

    // Helper to count rows excluding dummies
    const countRows = (str: string, batchId?: string, isGen?: boolean) => {
      if (!str || str.trim() === "") return 0;
      const tokens = str
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean);

      if (batchId && batchId !== "DEFAULT") {
        const batch = batches.find((b) => b.id === batchId);
        if (batch) {
          const dummySet = batch.dummyRows
            ? new Set(
                batch.dummyRows
                  .trim()
                  .split(/[\s,]+/)
                  .map((s) => parseInt(s))
                  .filter((n) => !isNaN(n)),
              )
            : new Set<number>();

          const normalSet = batch.normalRows
            ? new Set(
                batch.normalRows
                  .trim()
                  .split(/[\s,]+/)
                  .map((s) => parseInt(s))
                  .filter((n) => !isNaN(n)),
              )
            : new Set<number>();

          let count = 0;
          tokens.forEach((t) => {
            const match = t.trim().match(/^0*(\d+)([a-zA-Z]?)$/);
            if (match) {
              const n = parseInt(match[1], 10);
              if (!isNaN(n) && !dummySet.has(n)) {
                if (isGen && normalSet.has(n)) {
                  return;
                }
                if (t.toLowerCase().match(/[hvs]$/)) {
                  count += 0.25;
                } else {
                  count += 1;
                }
              }
            } else {
              const n = parseInt(t);
              if (!isNaN(n) && !dummySet.has(n)) {
                if (isGen && normalSet.has(n)) {
                  return;
                }
                count += 1;
              }
            }
          });
          return count;
        }
      }
      return tokens.length;
    };

    if (taskIdx !== -1) {
      const updatedTask = { ...newDay.assignments[taskIdx] };
      let currentBatchId = updatedTask.batchId;

      if (field === "batchId") {
        if (value === "LEAVE") {
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
        } else if (value === "HALF_DAY") {
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
          if (value === "OTHER") {
            updatedTask.generations = 0;
            updatedTask.edits = 0;
            updatedTask.assignedGenRows = "";
            updatedTask.assignedEditRows = "";
          }
          // Recalculate based on new batch constraints if rows exist
          // ... (rest of logic)
        }
      } else if (field === "assignedGenRows" || field === "assignedEditRows") {
        updatedTask[field] = val;
        const count = countRows(val as string, currentBatchId, field === "assignedGenRows");
        if (field === "assignedGenRows") updatedTask.generations = count;
        if (field === "assignedEditRows") updatedTask.edits = count;
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
        [field]: val,
      };

      let currentBatchId = newTask.batchId;
      if (field === "batchId") {
        if (value === "LEAVE") {
          newTask.isOnLeave = true;
          newTask.isHalfDay = false;
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
        } else if (value === "HALF_DAY") {
          newTask.isOnLeave = false;
          newTask.isHalfDay = true;
          newTask.generations = 0;
          newTask.edits = 0;
          newTask.batchId = undefined;
          currentBatchId = undefined;

          // Push to plan first
          newDay.assignments.push(newTask);
          newPlan.schedule[dayIdx] = newDay;

          if (onToggleLeave) {
            onToggleLeave(task.workerId, selectedDay, true, newPlan, 0.5);
            return; // Skip onUpdatePlan
          }
        } else {
          newTask.isOnLeave = false;
          newTask.isHalfDay = false;
          newTask.batchId = value;
          currentBatchId = value;
        }
      }

      if (field === "assignedGenRows") {
        newTask.generations = countRows(val as string, currentBatchId, true);
      } else if (field === "assignedEditRows") {
        newTask.edits = countRows(val as string, currentBatchId, false);
      }

      // Only push if we haven't already (for non-LEAVE / non-HALF_DAY cases)
      if (field !== "batchId" || (value !== "LEAVE" && value !== "HALF_DAY")) {
        newDay.assignments.push(newTask);
      }
    }

    newDay.dailyTotalGen = newDay.assignments.reduce(
      (sum, t) => sum + t.generations,
      0,
    );
    newDay.dailyTotalEdit = newDay.assignments.reduce(
      (sum, t) => sum + t.edits,
      0,
    );
    newPlan.schedule[dayIdx] = newDay;

    newPlan.summary = {
      ...newPlan.summary,
      totalGenerations: newPlan.schedule.reduce(
        (sum, d) => sum + d.dailyTotalGen,
        0,
      ),
      totalEdits: newPlan.schedule.reduce(
        (sum, d) => sum + d.dailyTotalEdit,
        0,
      ),
    };

    const finalAssignmentId =
      taskIdx !== -1
        ? newDay.assignments[taskIdx].id
        : newDay.assignments[newDay.assignments.length - 1].id;
    onUpdatePlan(
      newPlan,
      true,
      selectedDay,
      finalAssignmentId || task.workerId,
    );
  };

  const addSplitAssignment = (worker: Worker) => {
    const newPlan = { ...plan, schedule: [...plan.schedule] };
    let dayIdx = newPlan.schedule.findIndex((d) => d.day === selectedDay);

    if (dayIdx === -1) {
      const newDayEntry = {
        day: selectedDay,
        assignments: [],
        dailyTotalGen: 0,
        dailyTotalEdit: 0,
        locked: false,
        lockedTeams: [],
      };
      newPlan.schedule.push(newDayEntry);
      newPlan.schedule.sort((a, b) => a.day - b.day);
      dayIdx = newPlan.schedule.findIndex((d) => d.day === selectedDay);
    }

    const newDay = {
      ...newPlan.schedule[dayIdx],
      assignments: [...(newPlan.schedule[dayIdx].assignments || [])],
    };

    const newAssignment: TaskAssignment = {
      id: Math.random().toString(36).substr(2, 9),
      workerId: worker.id,
      person: worker.name,
      role: worker.role,
      generations: 0,
      edits: 0,
      isOnLeave: false,
      batchId: getDefaultBatchId(),
      assignedGenRows: "",
      assignedEditRows: "",
      taskLanguage: currentLanguage, // Mark this task as belonging to current view
    };

    newDay.assignments.push(newAssignment);
    newPlan.schedule[dayIdx] = newDay;
    onUpdatePlan(newPlan, true, selectedDay, newAssignment.id);
    setShowAddWorkerModal(false); // Close modal if used for adding new worker
  };

  const removeAssignment = (assignmentId: string) => {
    const newPlan = { ...plan, schedule: [...plan.schedule] };
    const dayIdx = newPlan.schedule.findIndex((d) => d.day === selectedDay);
    if (dayIdx === -1) return;

    const newDay = { ...newPlan.schedule[dayIdx] };
    newDay.assignments = (newDay.assignments || []).filter(
      (t) => t.id !== assignmentId,
    );

    newDay.dailyTotalGen = newDay.assignments.reduce(
      (sum, t) => sum + t.generations,
      0,
    );
    newDay.dailyTotalEdit = newDay.assignments.reduce(
      (sum, t) => sum + t.edits,
      0,
    );
    newPlan.schedule[dayIdx] = newDay;

    newPlan.summary = {
      ...newPlan.summary,
      totalGenerations: newPlan.schedule.reduce(
        (sum, d) => sum + d.dailyTotalGen,
        0,
      ),
      totalEdits: newPlan.schedule.reduce(
        (sum, d) => sum + d.dailyTotalEdit,
        0,
      ),
    };

    onUpdatePlan(newPlan, true, selectedDay, assignmentId, true);
  };

  const toggleLock = () => {
    const newPlan = { ...plan, schedule: [...plan.schedule] };
    let dayIdx = newPlan.schedule.findIndex((d) => d.day === selectedDay);
    let willLock = false;

    if (dayIdx === -1) {
      const newDayEntry = {
        day: selectedDay,
        assignments: workers.map((w) => ({
          id: Math.random().toString(36).substr(2, 9),
          workerId: w.id,
          person: w.name,
          role: w.role,
          generations: 0,
          edits: 0,
          isOnLeave: false,
          batchId: getDefaultBatchId(),
        })),
        dailyTotalGen: 0,
        dailyTotalEdit: 0,
        locked: false,
        lockedTeams: [currentLanguage],
      };
      newPlan.schedule.push(newDayEntry);
      newPlan.schedule.sort((a, b) => a.day - b.day);
      willLock = true;
    } else {
      const day = newPlan.schedule[dayIdx];
      const currentLockedTeams =
        day.lockedTeams ||
        (day.locked ? ["Telugu", "Tamil", "Malayalam", "Kannada"] : []);

      if (currentLockedTeams.includes(currentLanguage)) {
        day.lockedTeams = (currentLockedTeams || []).filter(
          (l) => l !== currentLanguage,
        );
        willLock = false;
      } else {
        day.lockedTeams = [...currentLockedTeams, currentLanguage];
        willLock = true;
      }
      day.locked = day.lockedTeams.length > 0;
    }
    onUpdatePlan(newPlan, true, selectedDay);

    // Deploy Google Chat Notification if configured on Completion (Lock)
    if (willLock && projectMeta?.googleChatNotifyOnLock && onNotifyGoogleChat) {
      onNotifyGoogleChat(selectedDay, currentLanguage);
    }
  };

  const renderCalendar = () => {
    const startOfWeek = new Date(viewDate);
    startOfWeek.setDate(viewDate.getDate() - viewDate.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      const dayIdx = getDayIndexFromDate(date);
      const dayPlan = plan.schedule.find((p) => p.day === dayIdx);
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
              ? "bg-[#F26C21] border-[#F26C21] text-white shadow-md z-10 scale-105"
              : hasData
                ? isLocked
                  ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-500"
                : "bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 hover:border-orange-200 dark:hover:border-orange-500"
          }`}
        >
          <span
            className={`text-[10px] uppercase font-bold mb-0.5 ${isSelected ? "text-orange-100" : "text-slate-400 dark:text-slate-500"}`}
          >
            {date.toLocaleDateString("en-US", { weekday: "short" })}
          </span>
          <span
            className={`text-lg font-black ${isSelected ? "text-white" : hasData ? "text-slate-700 dark:text-slate-200" : "text-slate-400 dark:text-slate-500"}`}
          >
            {date.getDate()}
          </span>

          {(hasData || isSelected) && (
            <div className="absolute top-1.5 right-1.5">
              {isLocked ? (
                <CheckCircle
                  size={10}
                  className={
                    isSelected
                      ? "text-white"
                      : "text-emerald-500 dark:text-emerald-400"
                  }
                />
              ) : (
                <div
                  className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white" : "bg-[#F26C21]"}`}
                ></div>
              )}
            </div>
          )}
        </button>,
      );
    }
    return days;
  };

  const maxNameLen = Array.isArray(displayedWorkers) && displayedWorkers.length > 0 
    ? Math.max(...displayedWorkers.map(w => w.name.length))
    : 10;
  const editorColWidthPX = Math.max(120, maxNameLen * 9 + 60);

  return (
    <div className="h-full flex flex-col animate-fade-in relative transition-colors">
      {/* ADD WORKER MODAL */}
      {showAddWorkerModal && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[80%] border border-slate-200 dark:border-slate-800">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">
                Add Contributor for Day {selectedDay}
              </h3>
              <button
                onClick={() => setShowAddWorkerModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1">
              {availableToAdd.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 text-sm">
                  No other workers available to add.
                </div>
              ) : (
                <div className="space-y-1">
                  {availableToAdd.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => addSplitAssignment(w)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent hover:border-slate-100 dark:hover:border-slate-700 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm ${
                            w.role === "Intern"
                              ? "bg-purple-400"
                              : w.role === "Assist"
                                ? "bg-orange-400"
                                : w.role === "Manager"
                                  ? "bg-emerald-500"
                                  : w.role === "TL"
                                    ? "bg-teal-500"
                                    : "bg-blue-500"
                          }`}
                        >
                          {w.name.charAt(0)}
                        </div>
                        <div className="text-left">
                          <div className="text-sm font-bold text-slate-700 dark:text-slate-200">
                            {w.name}
                          </div>
                          <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                            <span>{w.role}</span> •{" "}
                            <span>{w.language || "Telugu"}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-slate-300 dark:text-slate-600 group-hover:text-blue-500 dark:group-hover:text-blue-400">
                        <Plus size={16} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {renderEditorCompanionSpace()}

      <div className="flex-1 min-h-0 flex flex-col lg:grid lg:grid-cols-4 gap-6 overflow-y-auto lg:overflow-hidden custom-scrollbar">
        {/* Left Column (Team & Progress) */}
        <div className="lg:col-span-1 flex flex-col gap-4 shrink-0 lg:h-full lg:overflow-y-auto lg:custom-scrollbar">
          <div className="lg:flex-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 lg:overflow-y-auto min-h-0 custom-scrollbar transition-colors">
            <div className={`flex items-center justify-between ${showActiveBatchesMobile ? 'mb-3' : 'mb-0 lg:mb-3'}`}>
              <div 
                className="flex items-center gap-2 cursor-pointer lg:cursor-auto"
                onClick={() => {
                  if (window.innerWidth < 1024) setShowActiveBatchesMobile(!showActiveBatchesMobile);
                }}
              >
                <Layers className="text-[#F26C21]" size={18} />
                <h3 className="font-bold text-slate-700 dark:text-slate-200 text-xs flex items-center">
                  Active Batches
                  <span className="lg:hidden ml-1 text-slate-400">
                    {showActiveBatchesMobile ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </span>
                </h3>
              </div>
              {!readOnlyBatches && onNewBatch && (
                <button
                  onClick={onNewBatch}
                  className="flex items-center gap-1 px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition-all active:scale-95"
                >
                  <Plus size={12} /> New
                </button>
              )}
            </div>
            <div className={`${showActiveBatchesMobile ? 'block' : 'hidden'} lg:block`}>
            {displayBatches.length === 0 ? (
              <div className="text-center py-6 text-slate-400 dark:text-slate-500 text-[10px] bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700 border-dashed">
                No active batches.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {displayBatches.map((batch) => {
                  const isCompleted = batch.progress === 100;
                  return (
                    <div
                      key={batch.id}
                      className={`${isCompleted ? "bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800" : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-700"} rounded-xl p-2 border relative group transition-colors`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div
                            className={`text-[10px] font-black uppercase tracking-wider truncate max-w-[80px] ${isCompleted ? "text-emerald-400 dark:text-emerald-500" : "text-slate-400 dark:text-slate-500"}`}
                          >
                            {batch.clientName}
                          </div>
                          <div
                            className={`text-sm font-bold leading-tight truncate max-w-[100px] ${isCompleted ? "text-emerald-900 dark:text-emerald-100" : "text-slate-800 dark:text-slate-100"}`}
                            title={batch.batchName}
                          >
                            {batch.batchName}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          {isCompleted ? (
                            <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle
                                size={14}
                                className="fill-emerald-100 dark:fill-emerald-900/40"
                              />
                            </div>
                          ) : (
                            <div className="text-lg font-black text-[#F26C21]">
                              {batch.progress}%
                            </div>
                          )}
                        </div>
                      </div>

                      {isCompleted ? (
                        <div className="mt-2 mb-2 flex items-center justify-between">
                          <span className="text-lg font-black text-emerald-500 tracking-widest">
                            COMPLETED
                          </span>
                          {!readOnlyBatches && (
                            <div className="flex gap-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEditBatch(batch);
                                }}
                                className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-[#38bdf8] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm transition-colors"
                                title="Edit Batch"
                              >
                                <Edit3 size={12} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (
                                    window.confirm(
                                      `Delete batch "${batch.batchName}"?`,
                                    )
                                  ) {
                                    onDeleteBatch(batch.id);
                                  }
                                }}
                                className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm transition-colors"
                                title="Delete Batch"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <>
                          <div
                            className={`w-full h-1.5 rounded-full overflow-hidden mb-1 ${isCompleted ? "bg-emerald-200" : "bg-slate-200"}`}
                          >
                            <div
                              className={`h-full transition-all duration-500 ${isCompleted ? "bg-emerald-500" : "bg-[#F26C21]"}`}
                              style={{ width: `${batch.progress}%` }}
                            ></div>
                          </div>
                          <div className="flex justify-between items-end mt-2">
                            <div className="flex flex-col gap-1">
                              <div
                                className={`flex items-center gap-1.5 text-[10px] font-medium ${isCompleted ? "text-emerald-700" : "text-slate-600"}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-emerald-400" : "bg-purple-500"}`}
                                ></span>
                                <span className="font-bold">
                                  {batch.completedGen}
                                </span>
                                <span className="opacity-40">
                                  / {batch.totalGen} G
                                </span>
                              </div>
                              <div
                                className={`flex items-center gap-1.5 text-[10px] font-medium ${isCompleted ? "text-emerald-700" : "text-slate-600"}`}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${isCompleted ? "bg-emerald-600" : "bg-blue-500"}`}
                                ></span>
                                <span className="font-bold">
                                  {batch.completedEdit}
                                </span>
                                <span className="opacity-40">
                                  / {batch.totalEdit} E
                                </span>
                              </div>
                            </div>
                            {!readOnlyBatches && (
                              <div className="flex gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEditBatch(batch);
                                  }}
                                  className="p-1 text-slate-400 hover:text-blue-600 dark:hover:text-[#38bdf8] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm transition-colors"
                                  title="Edit Batch"
                                >
                                  <Edit3 size={12} />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (
                                      window.confirm(
                                        `Delete batch "${batch.batchName}"?`,
                                      )
                                    ) {
                                      onDeleteBatch(batch.id);
                                    }
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-500 dark:hover:text-red-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md shadow-sm transition-colors"
                                  title="Delete Batch"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            )}
                          </div>
                          {(() => {
                              const pending = getPendingRowsForBatch(batch);
                              const pendingAiRows = Array.from(new Set([...pending.pendingGen, ...pending.pendingEdit])).sort((a,b)=>a-b);
                              const pendingNormalRows = pending.pendingNormal;
                              
                              if (pendingAiRows.length === 0 && pendingNormalRows.length === 0) return null;

                              const isExpanded = showPending[batch.id] !== false; // Default true

                              return (
                                  <div className="mt-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                      <button 
                                          onClick={() => setShowPending(prev => ({...prev, [batch.id]: !isExpanded}))}
                                          className="w-full flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                                      >
                                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 tracking-wider">PENDING ROWS</span>
                                          {isExpanded ? <ChevronUp size={12} className="text-slate-400" /> : <ChevronDown size={12} className="text-slate-400" />}
                                      </button>
                                      
                                      {isExpanded && (
                                          <div className="p-2 space-y-2 border-t border-slate-100 dark:border-slate-800">
                                              {pendingAiRows.length > 0 && (
                                                  <div className="flex flex-col gap-1">
                                                      <span className="text-[9px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">AI ({pendingAiRows.length})</span>
                                                      <div className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 break-words leading-relaxed p-1.5 bg-purple-50 dark:bg-purple-900/10 rounded">
                                                          {formatRows(pendingAiRows)}
                                                      </div>
                                                  </div>
                                              )}
                                              {pendingNormalRows.length > 0 && (
                                                  <div className="flex flex-col gap-1">
                                                      <span className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Normal ({pendingNormalRows.length})</span>
                                                      <div className="text-xs font-mono font-medium text-slate-700 dark:text-slate-300 break-words leading-relaxed p-1.5 bg-emerald-50 dark:bg-emerald-900/10 rounded">
                                                          {formatRows(pendingNormalRows)}
                                                      </div>
                                                  </div>
                                              )}
                                          </div>
                                      )}
                                  </div>
                              );
                          })()}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            </div>
          </div>
        </div>

        {/* Right: Condensed Inputs */}
        <div className="lg:col-span-3 flex flex-col bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden relative transition-colors h-auto lg:h-full min-h-[500px] lg:min-h-0">
          {/* Moved Calendar with Compact 3-Day Slider */}
          <div className="flex-none flex flex-col bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 overflow-hidden transition-colors">
            <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50 gap-3">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <CalendarIcon className="text-[#F26C21]" size={12} />
                    Timeline
                  </h2>
                  <span className="text-sm font-black text-slate-800 dark:text-slate-100 leading-none">
                    {viewDate.toLocaleString("default", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                </div>
                {isCurrentDayLocked && (
                  <span className="text-[9px] font-bold uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded gap-1 items-center hidden sm:flex">
                    <Lock size={8} /> Locked ({currentLanguage})
                  </span>
                )}
                <div className="hidden sm:flex gap-2 border-l border-slate-200 dark:border-slate-700 pl-3">
                  <div className="text-center">
                    <span className="block text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500">
                      Gen
                    </span>
                    <span className="text-xs font-black text-purple-600 dark:text-purple-400">
                      {teamStats.gen}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="block text-[8px] uppercase font-bold text-slate-400 dark:text-slate-500">
                      Edit
                    </span>
                    <span className="text-xs font-black text-blue-600 dark:text-blue-400">
                      {teamStats.edit}
                    </span>
                  </div>
                </div>
              </div>
              {/* 3-Day date selector with select dropdown beside it */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedCompanionWorkerId}
                  onChange={(e) => setSelectedCompanionWorkerId(e.target.value)}
                  className="hidden sm:block px-2.5 py-1 text-xs font-bold text-slate-700 bg-white dark:bg-slate-950 dark:text-slate-200 rounded-xl border border-slate-200 dark:border-slate-800 outline-none focus:ring-1 focus:ring-orange-500 shadow-sm h-10 transition-colors"
                >
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>

                <div className="flex items-center gap-1.5 bg-white dark:bg-slate-950 p-1.5 rounded-xl border border-slate-100 dark:border-slate-800 shadow-sm h-10">
                  <button
                    onClick={handlePrevDay}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all hover:scale-110 active:scale-95"
                    title="Previous Day"
                  >
                    <ChevronLeft size={16} />
                  </button>

                  <div className="flex items-center gap-1">
                    {[-1, 0, 1].map((offset) => {
                      const targetDayIdx = selectedDay + offset;
                      if (targetDayIdx < 1) return null;

                      const date = getDateFromDayIndex(targetDayIdx);
                      const isSelected = offset === 0;
                      const dayPlan = plan.schedule.find(
                        (p) => p.day === targetDayIdx,
                      );
                      const isLocked = isDayLockedForTeam(dayPlan);
                      const label = getRelativeDateLabel(targetDayIdx);

                      return (
                        <button
                          key={offset}
                          onClick={() => {
                            setSelectedDay(targetDayIdx);
                            setViewDate(date);
                          }}
                          className={`px-3 py-1 items-center justify-center rounded-lg transition-all min-w-[56px] h-7 ${
                            isSelected
                              ? "bg-[#F26C21] text-white font-bold shadow-md scale-105 z-10 flex flex-col"
                              : "hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hidden md:flex md:flex-col"
                          }`}
                        >
                          <span
                            className={`text-[8px] uppercase tracking-wider font-bold mb-0.5 leading-none ${
                              isSelected
                                ? "text-orange-100"
                                : "text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {label}
                          </span>
                          <span
                            className={`text-xs font-black leading-none flex items-center gap-0.5 ${
                              isSelected
                                ? "text-white"
                                : "text-slate-705 dark:text-slate-205"
                            }`}
                          >
                            {date.getDate()}
                            {isLocked && (
                              <span className="w-1 h-1 rounded-full bg-emerald-500"></span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleNextDay}
                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 dark:text-slate-400 transition-all hover:scale-110 active:scale-95"
                    title="Next Day"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Task List */}
          <div 
            className="flex-1 overflow-y-auto px-4 pb-4 pt-0 space-y-0 custom-scrollbar bg-white dark:bg-slate-900 transition-colors"
            style={{ "--editor-col-width": `${editorColWidthPX}px` } as React.CSSProperties}
          >
            {/* Desktop Header with Add Button */}
            <div 
              className="hidden md:grid gap-2 px-2 py-2 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800 rounded-t-lg items-center transition-colors md:grid-cols-[length:var(--editor-col-width)_minmax(140px,1.5fr)_minmax(0,2fr)_minmax(0,2fr)_28px]"
            >
              <div className="min-w-0">Editor</div>
              <div className="min-w-0">Batch & Status</div>
              <div className="text-center flex items-center justify-center gap-1.5 min-w-0">
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
              <div className="text-center min-w-0">Editing</div>
              <div className="text-center"></div>
            </div>

            {Array.isArray(displayedWorkers) && displayedWorkers.length > 0 ? (
              displayedWorkers.map((worker, workerIdx) => {
                let workerTasks = (currentDayPlan.assignments || []).filter(
                  (t) => t.workerId === worker.id,
                );

                // Filter tasks again for display to only show relevant ones
                const relevantTasks = (workerTasks || []).filter((t) => {
                  // 1. Explicitly tagged with current language
                  if (t.taskLanguage === currentLanguage) return true;

                  // 2. If not tagged, check if the BATCH belongs to this language
                  if (t.batchId && t.batchId !== "DEFAULT") {
                    const batch = batches.find((b) => b.id === t.batchId);
                    if (
                      batch &&
                      (batch.language || "Telugu") === currentLanguage
                    )
                      return true;
                  }

                  // 3. Fallback: If worker belongs to this language and task has no specific language tag
                  if (
                    !t.taskLanguage &&
                    (worker.language || "Telugu") === currentLanguage
                  )
                    return true;

                  return false;
                });

                // If no relevant tasks but worker is in list (likely default team member with no task created yet or just filtered out), create virtual
                // OR if it's a contributor who was added but hasn't had a task saved yet (handled by addSplitAssignment though)
                if (relevantTasks.length === 0) {
                  if (defaultTeam.some((dt) => dt.id === worker.id)) {
                    // Default member should have a task row
                  } else {
                    // Contributor with no relevant task? Should not happen due to displayedWorkers logic,
                    // unless task was deleted. If so, hide row.
                    return null;
                  }
                }

                // Use filtered relevant tasks for rendering
                const tasksToRender =
                  relevantTasks.length > 0
                    ? relevantTasks
                    : [
                        {
                          workerId: worker.id,
                          person: worker.name,
                          role: worker.role,
                          generations: 0,
                          edits: 0,
                          isOnLeave: !!(
                            leaves[worker.id] &&
                            leaves[worker.id].includes(selectedDay)
                          ),
                          batchId:
                            leaves[worker.id] &&
                            leaves[worker.id].includes(selectedDay)
                              ? undefined
                              : getDefaultBatchId(),
                          assignedGenRows: "",
                          assignedEditRows: "",
                          taskLanguage: currentLanguage, // Virtual one gets current lang
                        } as TaskAssignment,
                      ];

                const rowBgClass = workerIdx % 2 === 0 ? "bg-white dark:bg-slate-900" : "bg-slate-100 dark:bg-slate-800/40";
                const isExpandedMobile = worker.id === currentUserWorker?.id || expandedMobileEditorIds.includes(worker.id);

                return (
                  <div
                    key={worker.id}
                    className={`mb-0 p-1 rounded-xl transition-colors ${rowBgClass}`}
                  >
                    {tasksToRender.map((task, index) => {
                      if (!isExpandedMobile && index > 0) return null;

                      return (
                      <div
                        key={task.id || `virtual-${index}`}
                        className={`grid grid-cols-1 md:grid-cols-[length:var(--editor-col-width)_minmax(140px,1.5fr)_minmax(0,2fr)_minmax(0,2fr)_28px] items-center py-1 gap-2 ${index > 0 ? "border-t border-slate-200 dark:border-slate-800 mt-1 pt-1" : ""} ${task.isOnLeave ? "opacity-70" : ""}`}
                      >
                        <div className="flex items-center gap-2 min-w-0 pr-2">
                          <div className="flex items-center gap-3">
                            {index === 0 ? (
                              <>
                                <div className="min-w-0">
                                  <div
                                    className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate flex items-center gap-1.5 cursor-pointer md:cursor-auto"
                                    title={worker.name}
                                    onClick={() => {
                                      if (window.innerWidth < 768 && worker.id !== currentUserWorker?.id) {
                                        setExpandedMobileEditorIds(prev => 
                                          prev.includes(worker.id) ? prev.filter(id => id !== worker.id) : [...prev, worker.id]
                                        );
                                      }
                                    }}
                                  >
                                    {renderTeamRankBadge(workerIdx + 1)}
                                    <span>{worker.name}</span>
                                    {worker.id !== currentUserWorker?.id && (
                                      <span className="md:hidden ml-1 text-slate-400">
                                        {isExpandedMobile ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                      </span>
                                    )}
                                  </div>
                                  {!isCurrentDayLocked &&
                                    task.plannedGenRows && (
                                      <div className={`text-[10px] text-slate-400 dark:text-slate-500 truncate items-center gap-1 ${!isExpandedMobile ? "hidden md:flex" : "flex"}`}>
                                        <button
                                          onClick={() =>
                                            copyPlannedForTask(task)
                                          }
                                          className="p-0.5 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                                          title="Copy Assigned Data"
                                        >
                                          <CornerDownRight size={10} />
                                        </button>
                                      </div>
                                    )}
                                </div>
                              </>
                            ) : (
                              <div className="flex items-center gap-3 pl-4 opacity-50">
                                <CornerDownRight
                                  size={16}
                                  className="text-slate-400"
                                />
                                <span className="text-[10px] font-bold text-slate-500 uppercase">
                                  Split
                                </span>
                              </div>
                            )}
                          </div>

                          <div className={`md:hidden ml-auto ${!isExpandedMobile ? "hidden" : "block"}`}>
                            {!isCurrentDayLocked &&
                              !readOnlyBatches &&
                              (index === 0 ? (
                                <button
                                  onClick={() => addSplitAssignment(worker)}
                                  className="p-1.5 bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                  title="Split Task"
                                >
                                  <Plus size={16} />
                                </button>
                              ) : (
                                <button
                                  onClick={() =>
                                    task.id && removeAssignment(task.id)
                                  }
                                  className="p-1.5 bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                  title="Remove Split"
                                >
                                  <Trash2 size={16} />
                                </button>
                              ))}
                          </div>
                        </div>

                        <div className={`min-w-0 grid-cols-2 gap-1.5 ${!isExpandedMobile ? "hidden md:grid" : "grid"}`}>
                          {/* Batch Select */}
                          <select
                            disabled={isCurrentDayLocked}
                            value={
                              task.isOnLeave
                                ? "LEAVE"
                                : task.isHalfDay
                                  ? "HALF_DAY"
                                  : task.batchId || "DEFAULT"
                            }
                            onChange={(e) =>
                              handleUpdate(task, "batchId", e.target.value)
                            }
                            className={`w-full py-1 h-7 px-2 rounded-md text-xs md:text-[10px] font-bold border outline-none cursor-pointer transition-colors ${
                              task.isOnLeave || task.isHalfDay
                                ? task.isOnLeave
                                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-500 dark:text-red-400"
                                  : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-500 dark:text-orange-400"
                                : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-blue-300 dark:hover:border-blue-500 focus:border-blue-500"
                            } ${isCurrentDayLocked ? "opacity-50 cursor-not-allowed bg-slate-100 dark:bg-slate-800" : ""}`}
                          >
                            {(() => {
                              const base = displayBatches.filter(
                                (b) => (b.progress || 0) < 100,
                              );
                              if (
                                task.batchId &&
                                task.batchId !== "DEFAULT" &&
                                task.batchId !== "OTHER" &&
                                task.batchId !== "LEAVE" &&
                                task.batchId !== "HALF_DAY"
                              ) {
                                const alreadyIn = base.some(
                                  (b) => b.id === task.batchId,
                                );
                                if (!alreadyIn) {
                                  const assignedBatch = (batches || []).find(
                                    (b) => b.id === task.batchId,
                                  );
                                  if (assignedBatch) {
                                    return [...base, assignedBatch];
                                  }
                                }
                              }
                              return base;
                            })().map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.batchName}
                              </option>
                            ))}
                            <option value="DEFAULT">General</option>
                            <option value="OTHER">Other / Learning</option>
                            <option value="LEAVE">LEAVE</option>
                            <option value="HALF_DAY">Half Day</option>
                          </select>

                          {/* Status Select */}
                          <select
                            disabled={
                              isCurrentDayLocked ||
                              task.isOnLeave ||
                              task.isHalfDay
                            }
                            value={task.status || "Completed"}
                            onChange={(e) =>
                              handleUpdate(task, "status", e.target.value)
                            }
                            className={`w-full py-1 h-7 px-1 rounded-md text-xs md:text-[10px] font-black border outline-none cursor-pointer transition-colors ${
                              (task.status || "Completed") === "Completed"
                                ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 focus:border-emerald-500"
                                : (task.status || "Completed") === "In Progress"
                                  ? "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800 hover:border-amber-400 focus:border-amber-500"
                                  : "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-450 border-rose-200 dark:border-rose-800 hover:border-rose-400 focus:border-rose-500"
                            }`}
                          >
                            <option
                              className="bg-white dark:bg-slate-850 text-emerald-700 dark:text-emerald-405 font-bold"
                              value="Completed"
                            >
                              Completed
                            </option>
                            <option
                              className="bg-white dark:bg-slate-850 text-amber-700 dark:text-amber-400 font-bold"
                              value="In Progress"
                            >
                              In Progress
                            </option>
                            <option
                              className="bg-white dark:bg-slate-850 text-rose-700 dark:text-rose-450 font-bold"
                              value="Rework"
                            >
                              Re-edit
                            </option>
                          </select>
                        </div>

                        {task.batchId === "OTHER" ? (
                          <div className={`md:col-span-2 gap-2 items-center ${!isExpandedMobile ? "hidden md:flex" : "flex"}`}>
                            <span className="md:hidden text-xs font-bold text-slate-400 dark:text-slate-500 w-12 shrink-0">
                              NOTES
                            </span>
                            <input
                              type="text"
                              disabled={isCurrentDayLocked}
                              value={task.notes || ""}
                              onChange={(e) =>
                                handleUpdate(
                                  task,
                                  "notes" as any,
                                  e.target.value,
                                )
                              }
                              className={`flex-1 min-w-0 py-1 h-7 px-2 text-left text-xs font-medium border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-blue-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-600 ${isCurrentDayLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                              placeholder="What did they work on or learn?"
                            />
                          </div>
                        ) : (
                          <>
                            <div className={`gap-1.5 items-center min-w-0 ${!isExpandedMobile ? "hidden md:flex" : "flex"}`}>
                              <span className="md:hidden text-xs font-bold text-slate-400 dark:text-slate-500 w-8 shrink-0">
                                GEN
                              </span>
                              {!task.isOnLeave ? (
                                <input
                                  type="number"
                                  min="0"
                                  disabled={isCurrentDayLocked}
                                  value={task.generations}
                                  onChange={(e) =>
                                    handleUpdate(
                                      task,
                                      "generations",
                                      e.target.value,
                                    )
                                  }
                                  className={`no-spinner w-12 py-1 h-7 px-1 text-center font-mono text-sm font-bold bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800 rounded-md outline-none focus:ring-1 focus:ring-purple-400 focus:bg-white dark:focus:bg-slate-700 transition-all ${isCurrentDayLocked ? "opacity-50 cursor-not-allowed text-slate-500 dark:text-slate-600" : "text-slate-900 dark:text-slate-100"}`}
                                  placeholder="0"
                                />
                              ) : (
                                <div className="w-12 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                  -
                                </div>
                              )}

                              {!task.isOnLeave ? (
                                <input
                                  type="text"
                                  disabled={isCurrentDayLocked}
                                  value={
                                    task.assignedGenRows ||
                                    task.assignedRows ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    handleUpdate(
                                      task,
                                      "assignedGenRows",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={(e) => {
                                    const valid = checkDuplicateRows(
                                      e.target.value,
                                      task,
                                      "gen",
                                    );
                                    if (valid !== e.target.value) {
                                      handleUpdate(
                                        task,
                                        "assignedGenRows",
                                        valid,
                                      );
                                    }
                                  }}
                                  className={`flex-1 min-w-0 py-1 h-7 px-2 text-left font-mono text-xs font-bold border border-purple-200 dark:border-purple-800 rounded-md outline-none focus:ring-1 focus:ring-purple-400 bg-purple-50/30 dark:bg-purple-900/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 ${isCurrentDayLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                                  placeholder=""
                                />
                              ) : (
                                <div className="flex-1 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                  -
                                </div>
                              )}
                            </div>

                            <div className={`gap-1.5 items-center min-w-0 ${!isExpandedMobile ? "hidden md:flex" : "flex"}`}>
                              <span className="md:hidden text-xs font-bold text-slate-400 dark:text-slate-500 w-8 shrink-0">
                                EDIT
                              </span>
                              {!task.isOnLeave ? (
                                <input
                                  type="number"
                                  min="0"
                                  disabled={isCurrentDayLocked}
                                  value={task.edits}
                                  onChange={(e) =>
                                    handleUpdate(task, "edits", e.target.value)
                                  }
                                  className={`no-spinner w-12 py-1 h-7 px-1 text-center font-mono text-sm font-bold bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 rounded-md outline-none focus:ring-1 focus:ring-blue-400 focus:bg-white dark:focus:bg-slate-700 transition-all ${isCurrentDayLocked ? "opacity-50 cursor-not-allowed text-slate-500 dark:text-slate-600" : "text-slate-900 dark:text-slate-100"}`}
                                  placeholder="0"
                                />
                              ) : (
                                <div className="w-12 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                  -
                                </div>
                              )}

                              {!task.isOnLeave ? (
                                <input
                                  type="text"
                                  disabled={isCurrentDayLocked}
                                  value={task.assignedEditRows || ""}
                                  onChange={(e) =>
                                    handleUpdate(
                                      task,
                                      "assignedEditRows",
                                      e.target.value,
                                    )
                                  }
                                  onBlur={(e) => {
                                    const valid = checkDuplicateRows(
                                      e.target.value,
                                      task,
                                      "edit",
                                    );
                                    if (valid !== e.target.value) {
                                      handleUpdate(
                                        task,
                                        "assignedEditRows",
                                        valid,
                                      );
                                    }
                                  }}
                                  className={`flex-1 min-w-0 py-1 h-7 px-2 text-left font-mono text-xs font-bold border border-blue-200 dark:border-blue-800 rounded-md outline-none focus:ring-1 focus:ring-blue-400 bg-blue-50/30 dark:bg-blue-900/10 text-slate-900 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-700 ${isCurrentDayLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                                  placeholder=""
                                />
                              ) : (
                                <div className="flex-1 h-7 flex items-center justify-center text-slate-300 dark:text-slate-700">
                                  -
                                </div>
                              )}
                            </div>
                          </>
                        )}

                        <div className="hidden md:flex justify-center shrink-0">
                          {!isCurrentDayLocked &&
                            !readOnlyBatches &&
                            (index === 0 ? (
                              <button
                                onClick={() => addSplitAssignment(worker)}
                                className="p-1.5 bg-slate-100 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                                title="Split Task"
                              >
                                <Plus size={14} />
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  task.id && removeAssignment(task.id)
                                }
                                className="p-1.5 bg-slate-100 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                title="Remove Split"
                              >
                                <Trash2 size={14} />
                              </button>
                            ))}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8 text-slate-400 text-sm">
                No team members found for this language on this day.
              </div>
            )}
          </div>{" "}
          {!readOnlyBatches && (
            <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex gap-3 justify-end transition-colors">
              {projectMeta?.googleChatSpaceId && (
                <button
                  onClick={() =>
                    onNotifyGoogleChat &&
                    onNotifyGoogleChat(selectedDay, currentLanguage)
                  }
                  className="px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-bold text-sm shadow-sm flex items-center justify-center gap-2 transition-all active:scale-95"
                  title="Broadcast Assignments to Google Chat"
                >
                  <MessageSquare size={16} className="text-[#34A853]" />
                  <span>Broadcast to Chat</span>
                </button>
              )}
              <button
                onClick={toggleLock}
                className={`${projectMeta?.googleChatSpaceId ? "flex-1" : "w-full"} py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${isCurrentDayLocked ? "bg-white dark:bg-slate-800 border border-emerald-500 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20" : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-200 dark:shadow-none"}`}
                id="toggleDailyLockButton"
              >
                {isCurrentDayLocked ? (
                  <>
                    <Unlock size={16} /> Unlock Day ({currentLanguage})
                  </>
                ) : (
                  <>
                    <Check size={16} /> Lock & Complete Day ({currentLanguage})
                  </>
                )}
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
                <AlertCircle
                  className="text-red-600 dark:text-red-400"
                  size={20}
                />
              </div>
              <h2 className="text-lg font-bold text-red-800 dark:text-red-400">
                Duplicate Assignment Detected
              </h2>
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
