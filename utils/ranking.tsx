import React from 'react';
import { ProductionPlan, Worker } from '../types';
import { Crown, Medal, Award } from 'lucide-react';

export function parseDummies(str?: string): Set<number> {
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
}

export function countValidRows(str: string, dummySet: Set<number>): number {
  if (!str) return 0;
  const tokens = str
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  let count = 0;
  tokens.forEach((t) => {
    const n = parseInt(t);
    if (!isNaN(n) && !dummySet.has(n)) {
      count++;
    }
  });
  return count;
}

export function getCompletedGenVal(assignment: any, batches?: any[]): number {
  const isCompleted = (assignment.status || 'Completed') === 'Completed' || assignment.status === 'Rework';
  if (!isCompleted) return 0;

  const batch = (batches || []).find((b) => b.id === assignment.batchId);
  const dummySet = batch ? parseDummies(batch.dummyRows) : new Set<number>();
  
  if (assignment.assignedGenRows && assignment.assignedGenRows.trim()) {
    return countValidRows(assignment.assignedGenRows, dummySet);
  }
  return assignment.generations || 0;
}

export function getCompletedEditVal(assignment: any, batches?: any[]): number {
  const isCompleted = (assignment.status || 'Completed') === 'Completed' || assignment.status === 'Rework';
  if (!isCompleted) return 0;

  const batch = (batches || []).find((b) => b.id === assignment.batchId);
  const dummySet = batch ? parseDummies(batch.dummyRows) : new Set<number>();
  
  if (assignment.assignedEditRows && assignment.assignedEditRows.trim()) {
    return countValidRows(assignment.assignedEditRows, dummySet);
  }
  return assignment.edits || 0;
}

export interface BrandWeights {
  weight_ai: Record<string, number>;
  weight_normal: Record<string, number>;
  global_avg_ai: number;
  global_avg_normal: number;
}

export function calculateBrandWeights(
  plan: ProductionPlan,
  startDateStr: string,
  batches: any[] = []
): BrandWeights {
  const LEADERBOARD_START_DATE = new Date(Date.UTC(2026, 5, 22)); // June 22, 2026
  
  const total_hours_ai: Record<string, number> = {};
  const total_completed_ai: Record<string, number> = {};
  const total_hours_normal: Record<string, number> = {};
  const total_completed_normal: Record<string, number> = {};

  let global_hours_ai = 0;
  let global_completed_ai = 0;
  let global_hours_normal = 0;
  let global_completed_normal = 0;

  if (plan && plan.schedule && startDateStr) {
    const [sy, sm, sd] = startDateStr.split('-').map(Number);
    const startDate = new Date(Date.UTC(sy, sm - 1, sd));

    plan.schedule.forEach((dayPlan) => {
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + (dayPlan.day - 1));

      // We only use data from the leaderboard period up to today to calculate average weights
      const now = new Date();
      const todayUTC = new Date(now);
      todayUTC.setUTCHours(23, 59, 59, 999);

      if (date < LEADERBOARD_START_DATE || date > todayUTC) {
        return;
      }

      const assignments = dayPlan.assignments || [];
      
      // Group by worker to calculate their actual hours per assignment on this day
      const workerAssignmentsMap: Record<string, typeof assignments> = {};
      assignments.forEach((assignment) => {
        if (!workerAssignmentsMap[assignment.workerId]) {
          workerAssignmentsMap[assignment.workerId] = [];
        }
        workerAssignmentsMap[assignment.workerId].push(assignment);
      });

      Object.entries(workerAssignmentsMap).forEach(([workerId, workerAssignments]) => {
        const explicitHours = workerAssignments.reduce((sum, a) => sum + (a.hoursSpent || 0), 0);
        const remainingHours = Math.max(0, 8 - explicitHours);
        const unspecifiedAssignments = workerAssignments.filter((a) => !(a.hoursSpent > 0));
        
        const totalUnspecifiedUnits = unspecifiedAssignments.reduce((sum, ua) => {
          return sum + getCompletedGenVal(ua, batches) + getCompletedEditVal(ua, batches);
        }, 0);

        workerAssignments.forEach((a) => {
          let calculatedHours = 0;
          if (a.hoursSpent > 0) {
            calculatedHours = a.hoursSpent;
          } else {
            if (totalUnspecifiedUnits > 0) {
              const units = getCompletedGenVal(a, batches) + getCompletedEditVal(a, batches);
              calculatedHours = (remainingHours * units) / totalUnspecifiedUnits;
            } else if (unspecifiedAssignments.length > 0) {
              calculatedHours = remainingHours / unspecifiedAssignments.length;
            }
          }

          const completedGen = getCompletedGenVal(a, batches);
          const completedEdit = getCompletedEditVal(a, batches);
          const totalCompletedUnits = completedGen + completedEdit;

          let hours_ai = 0;
          let hours_normal = 0;

          if (totalCompletedUnits > 0) {
            hours_ai = (calculatedHours * completedGen) / totalCompletedUnits;
            hours_normal = (calculatedHours * completedEdit) / totalCompletedUnits;
          }

          const batch = (batches || []).find((b) => b.id === a.batchId);
          const brand = (batch?.clientName || 'Unassigned').trim();

          if (!total_hours_ai[brand]) total_hours_ai[brand] = 0;
          if (!total_completed_ai[brand]) total_completed_ai[brand] = 0;
          if (!total_hours_normal[brand]) total_hours_normal[brand] = 0;
          if (!total_completed_normal[brand]) total_completed_normal[brand] = 0;

          total_hours_ai[brand] += hours_ai;
          total_completed_ai[brand] += completedGen;
          total_hours_normal[brand] += hours_normal;
          total_completed_normal[brand] += completedEdit;

          global_hours_ai += hours_ai;
          global_completed_ai += completedGen;
          global_hours_normal += hours_normal;
          global_completed_normal += completedEdit;
        });
      });
    });
  }

  const global_avg_ai = global_completed_ai > 0 ? (global_hours_ai / global_completed_ai) : 1.5;
  const global_avg_normal = global_completed_normal > 0 ? (global_hours_normal / global_completed_normal) : 1.5;

  const weight_ai: Record<string, number> = {};
  const weight_normal: Record<string, number> = {};

  const allBrands = new Set<string>([
    ...Object.keys(total_completed_ai),
    ...Object.keys(total_completed_normal)
  ]);

  allBrands.forEach((brand) => {
    const brandGenCount = total_completed_ai[brand] || 0;
    const brandEditCount = total_completed_normal[brand] || 0;

    weight_ai[brand] = brandGenCount > 0 
      ? (total_hours_ai[brand] / brandGenCount) 
      : global_avg_ai;

    weight_normal[brand] = brandEditCount > 0 
      ? (total_hours_normal[brand] / brandEditCount) 
      : global_avg_normal;
  });

  return {
    weight_ai,
    weight_normal,
    global_avg_ai,
    global_avg_normal
  };
}

export function getBrandWeight(
  brand: string,
  weights: BrandWeights,
  type: 'AI' | 'Normal'
): number {
  const brandKey = brand.trim();
  if (type === 'AI') {
    return weights.weight_ai[brandKey] !== undefined 
      ? weights.weight_ai[brandKey] 
      : weights.global_avg_ai;
  } else {
    return weights.weight_normal[brandKey] !== undefined 
      ? weights.weight_normal[brandKey] 
      : weights.global_avg_normal;
  }
}

export interface WorkerRanking {
  id: string;
  name: string;
  role: string;
  points: number;
  rank: number;
}

export function getAllWorkerRankings(
  plan: ProductionPlan, 
  workers: Worker[], 
  startDateStr: string, 
  batches?: any[],
  timeFrame: 'weekly' | 'monthly' | 'yearly' | 'all-time' = 'monthly'
): WorkerRanking[] {
  if (!plan || !workers || !startDateStr) return [];
  
  const [sy, sm, sd] = startDateStr.split('-').map(Number);
  const startDate = new Date(Date.UTC(sy, sm - 1, sd));

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();

  const currentDayOfWeek = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
  const startOfWeek = new Date(now);
  startOfWeek.setUTCDate(now.getUTCDate() - currentDayOfWeek + 1);
  startOfWeek.setUTCHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
  endOfWeek.setUTCHours(23, 59, 59, 999);

  const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
  const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));
  
  const workerPoints: Record<string, { id: string; name: string; role: string; points: number }> = {};
  
  workers.forEach(w => {
    if (w.role !== 'Manager') {
      workerPoints[w.id] = { id: w.id, name: w.name, role: w.role, points: 0 };
    }
  });

  const weights = calculateBrandWeights(plan, startDateStr, batches);

  (plan.schedule || []).forEach(dayPlan => {
    const date = new Date(startDate);
    date.setUTCDate(date.getUTCDate() + (dayPlan.day - 1));
    
    // Leaderboard calculations start from June 22, 2026
    const LEADERBOARD_START_DATE = new Date(Date.UTC(2026, 5, 22));
    if (date < LEADERBOARD_START_DATE) {
      return;
    }

    let includeDay = false;
    switch (timeFrame) {
      case 'weekly':
        includeDay = date >= startOfWeek && date <= endOfWeek;
        break;
      case 'monthly':
        includeDay = date >= startOfMonth && date <= endOfMonth;
        break;
      case 'yearly':
        includeDay = date.getUTCFullYear() === currentYear;
        break;
      case 'all-time':
        includeDay = true;
        break;
    }

    if (!includeDay) return;

    (dayPlan.assignments || []).forEach(assignment => {
      if (workerPoints[assignment.workerId]) {
        const batch = (batches || []).find(b => b.id === assignment.batchId);
        const brand = (batch?.clientName || 'Unassigned').trim();
        
        const gen = getCompletedGenVal(assignment, batches);
        const edit = getCompletedEditVal(assignment, batches);
        
        const points_ai = gen * getBrandWeight(brand, weights, 'AI');
        const points_normal = edit * getBrandWeight(brand, weights, 'Normal');
        
        workerPoints[assignment.workerId].points += (points_ai + points_normal);
      }
    });
  });

  const sorted = Object.values(workerPoints)
    .filter(w => w.role !== 'Manager')
    .sort((a, b) => {
      if (b.points !== a.points) {
        return b.points - a.points;
      }
      return a.name.localeCompare(b.name);
    });

  return sorted.map((item, index) => ({
    ...item,
    rank: index + 1
  }));
}

export function getRank1WorkerName(plan: ProductionPlan, workers: Worker[], startDateStr: string, batches?: any[]): string | null {
  const top3 = getTop3WorkerNames(plan, workers, startDateStr, batches);
  return top3.rank1;
}

export function getTop3WorkerNames(
  plan: ProductionPlan, 
  workers: Worker[], 
  startDateStr: string, 
  batches?: any[],
  timeFrame: 'weekly' | 'monthly' | 'yearly' | 'all-time' = 'monthly'
): { rank1: string | null; rank2: string | null; rank3: string | null } {
  const rankings = getAllWorkerRankings(plan, workers, startDateStr, batches, timeFrame);
  
  const rank1Item = rankings.find(r => r.rank === 1 && r.points > 0);
  const rank2Item = rankings.find(r => r.rank === 2 && r.points > 0);
  const rank3Item = rankings.find(r => r.rank === 3 && r.points > 0);

  const activeNonManagers = workers.filter(w => w.role !== 'Manager');
  return {
    rank1: rank1Item ? rank1Item.name : (rankings[0]?.name || (activeNonManagers[0] ? activeNonManagers[0].name : null)),
    rank2: rank2Item ? rank2Item.name : (rankings[1]?.name || (activeNonManagers[1] ? activeNonManagers[1].name : null)),
    rank3: rank3Item ? rank3Item.name : (rankings[2]?.name || (activeNonManagers[2] ? activeNonManagers[2].name : null)),
  };
}

interface Rank1BadgeProps {
  workerName: string;
  rank1Name: string | null;
  rank2Name?: string | null;
  rank3Name?: string | null;
  size?: number;
}

export const Rank1Badge: React.FC<Rank1BadgeProps> = ({ workerName, rank1Name, rank2Name, rank3Name, size = 11 }) => {
  if (rank1Name && workerName === rank1Name) {
    return (
      <span 
        className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded text-[9px] font-black border border-amber-500/20 shadow-sm shrink-0 animate-pulse select-none uppercase tracking-wider"
        title="Rank #1 Editor"
      >
        <Crown size={size} className="fill-amber-500 shrink-0 text-amber-500" />
        <span>#1</span>
      </span>
    );
  }

  if (rank2Name && workerName === rank2Name) {
    return (
      <span 
        className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-slate-500/10 text-slate-600 dark:text-slate-300 rounded text-[9px] font-black border border-slate-500/20 shadow-sm shrink-0 select-none uppercase tracking-wider"
        title="Rank #2 Editor"
      >
        <Medal size={size} className="fill-slate-400 shrink-0 text-slate-400" />
        <span>#2</span>
      </span>
    );
  }

  if (rank3Name && workerName === rank3Name) {
    return (
      <span 
        className="inline-flex items-center gap-0.5 px-1 py-0.2 bg-amber-700/10 text-amber-800 dark:text-amber-600 rounded text-[9px] font-black border border-amber-700/20 shadow-sm shrink-0 select-none uppercase tracking-wider"
        title="Rank #3 Editor"
      >
        <Award size={size} className="fill-amber-700 shrink-0 text-amber-700 dark:text-amber-600" />
        <span>#3</span>
      </span>
    );
  }
  
  return null;
};
