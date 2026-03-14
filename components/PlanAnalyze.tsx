
import React, { useMemo } from 'react';
import { ProductionPlan, Workload, Worker, Batch, User } from '../types';
import { AlertTriangle, CheckCircle, TrendingUp, Calendar, Zap, Layers, Clock, LayoutGrid, CheckSquare, Globe, Target, Save } from 'lucide-react';

interface PlanAnalyzeProps {
  plan: ProductionPlan;
  workload: Workload;
  workers: Worker[];
  leaves?: Record<string, number[]>;
  batches?: Batch[];
  projectStatus?: 'planning' | 'active'; 
  onUpdatePlan: (plan: ProductionPlan, saveToCloud: boolean) => void;
  onToggleLeave?: (workerId: string, day: number) => void;
  currentUser: User;
  onSavePlan?: () => void;
}

const PlanAnalyze: React.FC<PlanAnalyzeProps> = ({ 
    plan,
    workload,
    workers,
    leaves = {},
    batches = [],
    projectStatus,
    currentUser,
    onSavePlan
}) => {
  const { schedule } = plan;
  const selectedBatchId = 'ALL'; // Fixed to ALL for aggregate view

  // Filter batches based on user role
  const visibleBatches = useMemo(() => {
    return currentUser.role === 'admin' 
        ? batches 
        : batches.filter(b => (b.language || 'Telugu') === currentUser.language);
  }, [batches, currentUser]);

  const activeBatchesDetailed = useMemo(() => {
    return visibleBatches.filter(b => b.status === 'active');
  }, [visibleBatches]);

  // 1. Calculate Stats based on Selection (ALL)
  const stats = useMemo(() => {
    // Dates Setup
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startDate = new Date(workload.startDate);
    startDate.setHours(0, 0, 0, 0);
    const msPerDay = 1000 * 60 * 60 * 24;
    const currentDayNum = Math.floor((today.getTime() - startDate.getTime()) / msPerDay) + 1;

    let totalGenScope = 0;
    let totalEditScope = 0;
    let completedGen = 0;
    let completedEdit = 0;
    let targetEndDate = new Date(workload.endDate);
    
    // Default to language overview
    const scopeName = currentUser.role === 'admin' ? "Global Overview" : `${currentUser.language} Overview`;
    
    if (activeBatchesDetailed.length > 0) {
        totalGenScope = activeBatchesDetailed.reduce((sum, b) => sum + b.aiVideos, 0);
        totalEditScope = activeBatchesDetailed.reduce((sum, b) => sum + b.aiVideos + b.normalVideos, 0);
        
        const dates = activeBatchesDetailed.map(b => b.endDate ? new Date(b.endDate).getTime() : 0).filter(d => d > 0);
        if (dates.length > 0) targetEndDate = new Date(Math.max(...dates));
    } else {
        // Fallback for simple demo mode (no batches)
        totalGenScope = workload.aiVideos;
        totalEditScope = workload.aiVideos + workload.normalVideos;
    }

    // Forecast start logic
    const currentDayPlan = schedule.find(d => d.day === currentDayNum);
    const workDoneToday = currentDayPlan ? (currentDayPlan.dailyTotalGen + currentDayPlan.dailyTotalEdit) : 0;
    const treatTodayAsPast = currentDayPlan?.locked || workDoneToday > 0;
    
    let forecastStartDate: Date;
    if (treatTodayAsPast) {
        forecastStartDate = new Date(today.getTime() + msPerDay); 
    } else {
        forecastStartDate = today; 
    }
    if (forecastStartDate < startDate) forecastStartDate = startDate;
    const forecastStartDayNum = Math.floor((forecastStartDate.getTime() - startDate.getTime()) / msPerDay) + 1;

    // Calculate Completed
    const pastDays = schedule.filter(d => d.day < forecastStartDayNum);
    
    pastDays.forEach(day => {
        day.assignments.forEach(task => {
            const worker = workers.find(w => w.id === task.workerId);
            const taskLang = worker?.language || 'Telugu';
            const matchesViewScope = currentUser.role === 'admin' || taskLang === currentUser.language;
            
            if (matchesViewScope) {
                if (activeBatchesDetailed.length > 0) {
                    const activeBatchIds = new Set(activeBatchesDetailed.map(b => b.id));
                    if (task.batchId && activeBatchIds.has(task.batchId)) {
                            completedGen += task.generations;
                            completedEdit += task.edits;
                    }
                } else {
                    completedGen += task.generations;
                    completedEdit += task.edits;
                }
            }
        });
    });
    
    targetEndDate.setHours(0, 0, 0, 0);

    const pendingGen = Math.max(0, totalGenScope - completedGen);
    const pendingEdit = Math.max(0, totalEditScope - completedEdit);
    
    const timeDiff = targetEndDate.getTime() - forecastStartDate.getTime();
    const daysLeft = Math.round(timeDiff / msPerDay) + 1;

    return {
        scopeName,
        completedGen,
        completedEdit,
        totalGenScope,
        totalEditScope,
        pendingGen,
        pendingEdit,
        daysLeft,
        forecastStartDate,
        forecastStartDayNum,
        targetEndDate,
        includeToday: !treatTodayAsPast
    };
  }, [plan, workload, activeBatchesDetailed, schedule, visibleBatches, currentUser, workers]);

  // 2. Predictive Forecasting Algorithm
  const forecast = useMemo(() => {
      if (stats.pendingGen === 0 && stats.pendingEdit === 0 && stats.daysLeft <= 0) return [];
      
      const projectedSchedule = [];
      let remainingGen = stats.pendingGen;
      let remainingEdit = stats.pendingEdit;
      
      const maxIterations = Math.max(0, stats.daysLeft);
      
      // Filter available workers based on Role/Language
      const usableWorkers = currentUser.role === 'admin' 
        ? workers 
        : workers.filter(w => w.language === currentUser.language);

      for (let i = 0; i < maxIterations; i++) {
          const forecastDayNum = stats.forecastStartDayNum + i;
          const date = new Date(stats.forecastStartDate);
          date.setDate(date.getDate() + i);
          date.setHours(0,0,0,0);
          
          const dayAssignments: any[] = [];
          const availableWorkers = usableWorkers.filter(w => !(leaves[w.id] || []).includes(forecastDayNum));
          
          availableWorkers.forEach(w => {
              let genLoad = 0;
              let editLoad = 0;

              // Assign Generation
              if (remainingGen > 0 && w.genCapacity > 0) {
                  const capacity = w.genCapacity;
                  const share = w.role === 'Intern' ? capacity : Math.ceil(remainingGen / Math.max(1, availableWorkers.filter(ed => ed.genCapacity>0).length));
                  genLoad = Math.min(capacity, remainingGen, share);
                  remainingGen -= genLoad;
              }

              // Assign Edit
              if (remainingEdit > 0 && w.editCapacity > 0) {
                  const genUsage = w.genCapacity > 0 ? (genLoad / w.genCapacity) : 0;
                  const maxEdit = Math.floor((1 - genUsage) * w.editCapacity);
                  const editTarget = Math.ceil(remainingEdit / Math.max(1, availableWorkers.length));
                  editLoad = Math.min(maxEdit, remainingEdit, editTarget);
                  remainingEdit -= editLoad;
              }

              if (genLoad > 0 || editLoad > 0) {
                dayAssignments.push({
                    workerId: w.id,
                    name: w.name,
                    role: w.role,
                    gen: genLoad,
                    edit: editLoad
                });
              }
          });

          const totalGen = dayAssignments.reduce((sum, a) => sum + a.gen, 0);
          const totalEdit = dayAssignments.reduce((sum, a) => sum + a.edit, 0);

          if (totalGen > 0 || totalEdit > 0) {
            projectedSchedule.push({
                day: forecastDayNum,
                date: date,
                assignments: dayAssignments,
                totalGen,
                totalEdit
            });
          }
          
          if (remainingGen <= 0 && remainingEdit <= 0) break;
      }
      return projectedSchedule;
  }, [stats, workers, leaves, currentUser]);

  return (
    <div className="flex flex-col h-full w-full gap-6 animate-fade-in">
      
      {/* 1. HEADER & METRICS */}
      <div className="flex-none flex items-center justify-between mb-2">
          <h2 className="text-xl font-black text-slate-800">Production Analysis</h2>
          {projectStatus === 'planning' && onSavePlan && (
              <button 
                onClick={onSavePlan}
                className="flex items-center gap-2 px-4 py-2 bg-[#F26C21] text-white rounded-lg font-bold shadow-lg hover:bg-[#d95a10] transition-all active:scale-95"
              >
                  <Save size={18} /> Save & Activate Plan
              </button>
          )}
      </div>

      <div className="flex-none grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                  <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wide">Forecast Scope</h2>
                  <div className="text-xl font-black text-slate-800 mt-1">{stats.scopeName}</div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-slate-500 text-xs font-medium">
                  <Target size={14} />
                  <span>Target: {stats.targetEndDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
              </div>
          </div>

          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5"><Calendar size={64} /></div>
             <div className="text-sm font-bold text-slate-400 uppercase tracking-wide">Time Remaining</div>
             <div className={`text-4xl font-black mt-2 ${stats.daysLeft <= 2 ? 'text-red-500' : 'text-slate-800'}`}>
                 {stats.daysLeft > 0 ? stats.daysLeft : 0} <span className="text-sm text-slate-400 font-bold">days</span>
             </div>
          </div>

          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5"><Zap size={64} /></div>
             <div className="text-sm font-bold text-slate-400 uppercase tracking-wide">Pending Generation</div>
             <div className="text-4xl font-black mt-2 text-purple-600">
                 {stats.pendingGen} <span className="text-sm text-slate-400 font-bold">videos</span>
             </div>
          </div>

          <div className="md:col-span-1 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-5"><TrendingUp size={64} /></div>
             <div className="text-sm font-bold text-slate-400 uppercase tracking-wide">Pending Edits</div>
             <div className="text-4xl font-black mt-2 text-blue-600">
                 {stats.pendingEdit} <span className="text-sm text-slate-400 font-bold">videos</span>
             </div>
          </div>
      </div>

      {/* 2. FORECAST TABLE */}
      <div className="flex-1 min-h-0 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
         <div className="flex-none p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                    <TrendingUp className="text-emerald-600" size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 text-base">Production Forecast</h3>
                    <p className="text-xs text-slate-500">
                        Estimated capacity plan for next {Math.max(stats.daysLeft, forecast.length)} days
                    </p>
                </div>
            </div>
         </div>
         <div className="flex-1 overflow-auto custom-scrollbar relative">
             {forecast.length > 0 ? (
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-20 shadow-sm">
                        <tr className="bg-slate-50/95 backdrop-blur text-[11px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-200">
                            <th className="p-4 sticky left-0 z-30 bg-slate-50 border-r border-slate-200 w-40">Date</th>
                            <th className="p-4 text-center border-r border-slate-200 w-24 bg-slate-50">Daily Total</th>
                            {(currentUser.role === 'admin' ? workers : workers.filter(w => w.language === currentUser.language)).map(w => (
                                <th key={w.id} className="p-4 text-center border-r border-slate-100 min-w-[120px] bg-slate-50">
                                    <div className="flex flex-col items-center gap-1">
                                        <span className="text-slate-700 font-bold">{w.name}</span>
                                        <span className="text-[9px] bg-slate-200 px-1.5 rounded text-slate-500 font-bold">
                                            {w.role === 'Intern' ? 'GEN' : 'EDIT'}
                                        </span>
                                    </div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {forecast.map((day, idx) => (
                            <tr key={day.day} className="hover:bg-slate-50 transition-colors group">
                                <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 border-r border-slate-100 z-10">
                                    <div className="flex items-center gap-3">
                                        <div className="text-2xl font-black text-slate-200 group-hover:text-slate-300 w-8 text-right">{idx + 1}</div>
                                        <div>
                                            <div className="font-bold text-slate-700 text-sm whitespace-nowrap">{day.date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                                            <div className="text-[10px] text-slate-400 font-bold uppercase">Day {day.day}</div>
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="p-3 text-center border-r border-slate-100 bg-slate-50/30">
                                    <div className="flex flex-col gap-1 items-center justify-center">
                                        {day.totalGen > 0 && <span className="text-[10px] font-black text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full shadow-sm">{day.totalGen} G</span>}
                                        {day.totalEdit > 0 && <span className="text-[10px] font-black text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full shadow-sm">{day.totalEdit} E</span>}
                                    </div>
                                </td>

                                {(currentUser.role === 'admin' ? workers : workers.filter(w => w.language === currentUser.language)).map(w => {
                                    const task = day.assignments.find((a: any) => a.workerId === w.id);
                                    if (!task) return <td key={w.id} className="text-center p-3 text-slate-200 border-r border-slate-50">-</td>;
                                    
                                    return (
                                        <td key={w.id} className="p-3 border-r border-slate-50 text-center">
                                            <div className="flex flex-col gap-1 items-center">
                                                {task.gen > 0 && (
                                                    <div className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-100 px-3 py-1 rounded-lg w-full shadow-sm">
                                                        {task.gen} Gen
                                                    </div>
                                                )}
                                                {task.edit > 0 && (
                                                    <div className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-lg w-full shadow-sm">
                                                        {task.edit} Edit
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
             ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-10 text-center opacity-60">
                    <CheckCircle className="text-emerald-500 mb-4" size={64} />
                    <h3 className="text-2xl font-black text-emerald-900">Work Complete</h3>
                    <p className="text-slate-500 font-medium">No pending work to forecast.</p>
                </div>
             )}
         </div>
      </div>
    </div>
  );
};

export default PlanAnalyze;
