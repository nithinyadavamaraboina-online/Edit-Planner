
import React, { useState, useMemo } from 'react';
import { ProductionPlan, Workload } from '../types';
import { AlertTriangle, Users, Layers, UserMinus, UserCheck, X, Sparkles, Activity, CheckSquare, Clock, Lock, Unlock, RefreshCw, PenTool, BarChart3, ChevronRight } from 'lucide-react';

interface PlanDashboardProps {
  plan: ProductionPlan;
  workload: Workload;
  projectStatus?: 'planning' | 'active'; 
  onUpdatePlan: (plan: ProductionPlan) => void;
  onToggleLeave?: (workerId: string, day: number) => void;
  onClose?: () => void;
  onRePlan?: () => void;
  hasApiKey?: boolean;
}

const PlanDashboard: React.FC<PlanDashboardProps> = ({ 
    plan, 
    workload, 
    projectStatus = 'planning',
    onUpdatePlan, 
    onToggleLeave, 
    onClose, 
    onRePlan, 
    hasApiKey = false 
}) => {
  const { schedule, constraints, risks } = plan;
  
  const [activeTab, setActiveTab] = useState<number | 'ALL'>('ALL');

  const displayedSchedule = activeTab === 'ALL' 
    ? (schedule || [])
    : (schedule || []).filter(d => d.day === activeTab);

  const stats = useMemo(() => {
    const currentDayIndex = typeof activeTab === 'number' ? activeTab : schedule.length;
    
    // Consider all days up to the active tab (inclusive)
    const completedGen = schedule.reduce((sum, d) => sum + d.dailyTotalGen, 0);
    const completedEdit = schedule.reduce((sum, d) => sum + d.dailyTotalEdit, 0);

    const lockedDays = (schedule || []).filter(d => d.locked);
    
    const activeDayPlan = schedule.find(d => d.day === currentDayIndex);
    const dayGen = activeDayPlan?.dailyTotalGen || 0;
    const dayEdit = activeDayPlan?.dailyTotalEdit || 0;

    const totalGenTarget = workload.aiVideos;
    const totalEditTarget = workload.totalVideos; 

    const pendingGens = Math.max(0, totalGenTarget - completedGen);
    const pendingEdits = Math.max(0, totalEditTarget - completedEdit);
    
    const genPercent = totalGenTarget > 0 ? Math.min(100, Math.round((completedGen / totalGenTarget) * 100)) : 0;
    const editPercent = totalEditTarget > 0 ? Math.min(100, Math.round((completedEdit / totalEditTarget) * 100)) : 0;
    
    const aiVideosAvailableForEdit = completedGen;
    const estimatedAiEditsDone = Math.min(completedEdit, aiVideosAvailableForEdit);
    const estimatedNormalEditsDone = Math.max(0, completedEdit - estimatedAiEditsDone);
    const queueAiPending = Math.max(0, aiVideosAvailableForEdit - estimatedAiEditsDone);
    const queueNormalPending = Math.max(0, workload.normalVideos - estimatedNormalEditsDone);
    const backlog = queueAiPending + queueNormalPending;

    return {
      dayGen,
      dayEdit,
      completedGen,
      completedEdit,
      pendingGens,
      pendingEdits,
      genPercent,
      editPercent,
      backlog,
      queueAiPending,
      queueNormalPending,
      totalGenTarget,
      totalEditTarget,
      hasLockedDays: lockedDays.length > 0
    };
  }, [activeTab, schedule, workload]);

  const handleValueChange = (dayIndex: number, workerId: string, field: 'generations' | 'edits', value: string) => {
      const newValue = parseInt(value) || 0;
      const newPlan = { ...plan, schedule: [...plan.schedule] };
      const dayPlanIndex = newPlan.schedule.findIndex(d => d.day === dayIndex);
      if(dayPlanIndex === -1) return;

      const newDayPlan = { ...newPlan.schedule[dayPlanIndex], assignments: [...newPlan.schedule[dayPlanIndex].assignments] };
      const taskIndex = newDayPlan.assignments.findIndex(t => t.workerId === workerId);
      if(taskIndex === -1) return;

      newDayPlan.assignments[taskIndex] = { ...newDayPlan.assignments[taskIndex], [field]: newValue };
      newDayPlan.dailyTotalGen = newDayPlan.assignments.reduce((sum, t) => sum + t.generations, 0);
      newDayPlan.dailyTotalEdit = newDayPlan.assignments.reduce((sum, t) => sum + t.edits, 0);

      newPlan.schedule[dayPlanIndex] = newDayPlan;
      newPlan.summary = {
          ...newPlan.summary,
          totalGenerations: newPlan.schedule.reduce((sum, d) => sum + d.dailyTotalGen, 0),
          totalEdits: newPlan.schedule.reduce((sum, d) => sum + d.dailyTotalEdit, 0)
      };

      onUpdatePlan(newPlan);
  };

  const toggleDayLock = (dayIndex: number) => {
    const newPlan = { ...plan, schedule: [...plan.schedule] };
    const dayPlanIndex = newPlan.schedule.findIndex(d => d.day === dayIndex);
    if(dayPlanIndex !== -1) {
       newPlan.schedule[dayPlanIndex].locked = !newPlan.schedule[dayPlanIndex].locked;
       onUpdatePlan(newPlan);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 animate-fade-in">
      
      {/* TOP ROW: Stats & Tracker */}
      <div className="flex-none grid grid-cols-1 xl:grid-cols-12 gap-4 min-h-0">
         {/* TRACKER CARD */}
         <div className={`xl:col-span-7 rounded-2xl p-5 border shadow-sm relative overflow-hidden flex flex-col justify-center ${projectStatus === 'active' ? 'bg-slate-900 border-slate-800 text-white' : 'bg-white border-dashed border-slate-300'}`}>
            {projectStatus === 'active' ? (
                <>
                  <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                     <Activity size={120} />
                  </div>
                  <div className="flex justify-between items-start mb-4 relative z-10">
                    <div>
                        <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                            <Activity className="text-emerald-400" size={20} /> Project Velocity
                        </h3>
                    </div>
                    <div className="text-xs font-medium text-slate-400 bg-slate-800 px-2 py-1 rounded">Live Tracking</div>
                  </div>
                  <div className="grid grid-cols-2 gap-8 relative z-10">
                     <div>
                        <div className="flex justify-between items-end mb-1">
                           <span className="text-xs font-bold text-purple-300 uppercase">Generations</span>
                           <span className="text-xl font-black">{stats.genPercent}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-purple-500" style={{ width: `${stats.genPercent}%` }}></div>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">{stats.completedGen} / {stats.totalGenTarget} videos</div>
                     </div>
                     <div>
                        <div className="flex justify-between items-end mb-1">
                           <span className="text-xs font-bold text-blue-300 uppercase">Edits</span>
                           <span className="text-xl font-black">{stats.editPercent}%</span>
                        </div>
                        <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                           <div className="h-full bg-blue-500" style={{ width: `${stats.editPercent}%` }}></div>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500">{stats.completedEdit} / {stats.totalEditTarget} videos</div>
                     </div>
                  </div>
                </>
            ) : (
                <div className="flex items-center gap-4 text-slate-400">
                    <div className="bg-slate-100 p-3 rounded-full"><PenTool size={24} /></div>
                    <div>
                        <h3 className="font-bold text-lg text-slate-700">Draft Mode</h3>
                        <p className="text-sm">Start execution to enable live tracking.</p>
                    </div>
                </div>
            )}
         </div>

         {/* STATS GRID */}
         <div className="xl:col-span-5 grid grid-cols-2 gap-4">
             <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase text-slate-400">Total Backlog</span>
                    <Clock size={16} className="text-orange-400" />
                </div>
                <div>
                    <span className="text-3xl font-black text-slate-800">{stats.backlog}</span>
                    <span className="text-xs text-slate-400 block">videos waiting</span>
                </div>
             </div>
             <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col justify-between">
                <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black uppercase text-slate-400">Remaining</span>
                    <BarChart3 size={16} className="text-blue-400" />
                </div>
                <div>
                    <span className="text-3xl font-black text-slate-800">{stats.pendingEdits}</span>
                    <span className="text-xs text-slate-400 block">edits to go</span>
                </div>
             </div>
         </div>
      </div>

      {/* MIDDLE: SCHEDULE TABLE (Fills remaining space) */}
      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
         {/* Table Header / Tabs */}
         <div className="flex-none p-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-4">
             <div className="flex items-center gap-2">
                 <div className="bg-white p-1.5 rounded-md border border-slate-200 shadow-sm">
                     <Layers size={18} className="text-slate-600"/>
                 </div>
                 <h3 className="font-bold text-slate-700 text-sm">Schedule</h3>
             </div>
             
             {/* Simple Day Toggle */}
             <div className="flex gap-1 bg-slate-200 p-1 rounded-lg overflow-x-auto max-w-[60%] scrollbar-hide">
                <button
                    onClick={() => setActiveTab('ALL')}
                    className={`px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all ${activeTab === 'ALL' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Full Plan
                </button>
                {schedule.map(d => (
                    <button
                        key={d.day}
                        onClick={() => setActiveTab(d.day)}
                        className={`px-3 py-1 rounded-md text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1 ${activeTab === d.day ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        {d.locked && <Lock size={10} />} Day {d.day}
                    </button>
                ))}
             </div>
         </div>

         {/* Scrollable Table Body */}
         <div className="flex-1 overflow-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-white z-10 shadow-sm">
                    <tr className="text-[10px] uppercase font-black text-slate-400 tracking-wider border-b border-slate-100">
                        <th className="p-2 bg-slate-50/80 backdrop-blur-sm w-48">Editor</th>
                        <th className="p-2 text-center w-20 bg-slate-50/80 backdrop-blur-sm">Gen</th>
                        <th className="p-2 text-center w-20 bg-slate-50/80 backdrop-blur-sm">Edit</th>
                        <th className="p-2 text-center w-24 bg-slate-50/80 backdrop-blur-sm">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {displayedSchedule.map(dayPlan => (
                        <React.Fragment key={dayPlan.day}>
                            {activeTab === 'ALL' && (
                                <tr className="bg-slate-50/50">
                                    <td colSpan={4} className="px-4 py-1.5 border-y border-slate-100">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-black uppercase text-slate-500">Day {dayPlan.day}</span>
                                            {projectStatus === 'active' && (
                                                 <button 
                                                 onClick={() => toggleDayLock(dayPlan.day)}
                                                 className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border flex items-center gap-1 transition-all ${
                                                   dayPlan.locked 
                                                     ? 'bg-green-100 border-green-200 text-green-700 hover:bg-green-200' 
                                                     : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-100'
                                                 }`}
                                               >
                                                 {dayPlan.locked ? <Lock size={10} /> : <Unlock size={10} />}
                                                 {dayPlan.locked ? 'Locked' : 'Lock'}
                                               </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            )}
                            {dayPlan.assignments.map((task, idx) => (
                                <tr key={`${dayPlan.day}-${task.workerId}`} className={`hover:bg-slate-50/80 group transition-colors ${task.isOnLeave ? 'bg-red-50/30' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-100')}`}>
                                    <td className="p-2 border-r border-slate-50">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                                                task.role === 'Intern' ? 'bg-purple-100 text-purple-600' : 
                                                task.role === 'Assist' ? 'bg-orange-100 text-orange-600' : 
                                                task.role === 'Manager' ? 'bg-emerald-100 text-emerald-600' :
                                                task.role === 'TL' ? 'bg-teal-100 text-teal-600' :
                                                'bg-blue-100 text-blue-600'
                                            }`}>
                                                {task.person.charAt(0)}
                                            </div>
                                            <div>
                                                <div className={`text-sm font-bold ${task.isOnLeave ? 'text-slate-400' : 'text-slate-800'}`}>{task.person}</div>
                                                <div className="text-[10px] font-medium text-slate-400">{task.role}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-2 text-center">
                                        {task.isOnLeave ? <span className="text-slate-200">-</span> : (
                                            <input 
                                                type="number" 
                                                disabled={dayPlan.locked}
                                                className={`w-12 py-1 text-center text-sm font-bold border rounded bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#F26C21] outline-none ${dayPlan.locked ? 'text-slate-400 bg-transparent border-transparent' : 'border-slate-200 text-slate-800'}`}
                                                value={task.generations}
                                                onChange={(e) => handleValueChange(dayPlan.day, task.workerId, 'generations', e.target.value)}
                                            />
                                        )}
                                    </td>
                                    <td className="p-2 text-center">
                                        {task.isOnLeave ? <span className="text-slate-200">-</span> : (
                                            <input 
                                                type="number" 
                                                disabled={dayPlan.locked}
                                                className={`w-12 py-1 text-center text-sm font-bold border rounded bg-slate-50 focus:bg-white focus:ring-2 focus:ring-[#F26C21] outline-none ${dayPlan.locked ? 'text-slate-400 bg-transparent border-transparent' : 'border-slate-200 text-slate-800'}`}
                                                value={task.edits}
                                                onChange={(e) => handleValueChange(dayPlan.day, task.workerId, 'edits', e.target.value)}
                                            />
                                        )}
                                    </td>
                                    <td className="p-2 text-center">
                                        {!task.isOnLeave ? (
                                            !dayPlan.locked && (
                                                <button onClick={() => onToggleLeave?.(task.workerId, dayPlan.day)} className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100">
                                                    <UserMinus size={16} />
                                                </button>
                                            )
                                        ) : (
                                            <button onClick={() => onToggleLeave?.(task.workerId, dayPlan.day)} className="px-2 py-0.5 bg-red-100 text-red-600 text-[10px] font-bold uppercase rounded-full hover:bg-green-100 hover:text-green-600 transition-colors">
                                                On Leave
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                            {/* Daily Total Row */}
                            <tr className="bg-slate-50/80 border-b border-slate-100">
                                <td className="p-2 pl-4 text-[10px] uppercase font-black text-slate-400">Total Output</td>
                                <td className="p-2 text-center text-sm font-black text-slate-700">{dayPlan.dailyTotalGen}</td>
                                <td className="p-2 text-center text-sm font-black text-slate-700">{dayPlan.dailyTotalEdit}</td>
                                <td></td>
                            </tr>
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
         </div>
      </div>

      {/* BOTTOM ROW: Risks (Small Collapsible or just inline if space allows) */}
      {risks.length > 0 && (
         <div className="flex-none bg-yellow-50 rounded-xl p-3 border border-yellow-200 flex items-start gap-3">
             <AlertTriangle className="text-yellow-600 flex-shrink-0 mt-0.5" size={16} />
             <div className="text-xs text-yellow-800 font-medium">
                {risks.join(', ')}
             </div>
         </div>
      )}
    </div>
  );
};

export default PlanDashboard;
