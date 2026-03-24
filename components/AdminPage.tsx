
import React, { useMemo } from 'react';
import { Worker, Batch, ProductionPlan } from '../types';
import { Shield, LayoutGrid, Clock, CheckCircle, Zap, Globe, Trophy, ArrowLeft } from 'lucide-react';

interface AdminPageProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  onBack: () => void;
  batches: Batch[];
  plan: ProductionPlan | null;
  projectMeta: { id?: string; name: string; notes: string } | null;
}

const AdminPage: React.FC<AdminPageProps> = ({ 
    workers, 
    batches,
    plan,
    onBack,
    projectMeta
}) => {
  
  const handleShareDashboard = () => {
    if (!projectMeta?.id) return;
    const url = `${window.location.origin}${window.location.pathname}?mode=dashboard&id=${projectMeta.id}`;
    navigator.clipboard.writeText(url);
    alert("Dashboard link copied to clipboard!");
  };
  
  const editorVelocities = useMemo(() => {
    if (!plan || !plan.schedule) return {};
    const velocities: Record<string, { totalUnits: number, daysWorked: number }> = {};
    
    plan.schedule.forEach(day => {
        day.assignments.forEach(assignment => {
            const workerId = assignment.workerId;
            if (!velocities[workerId]) velocities[workerId] = { totalUnits: 0, daysWorked: 0 };
            
            const units = assignment.generations + assignment.edits;
            if (units > 0) {
                velocities[workerId].totalUnits += units;
                velocities[workerId].daysWorked += 1;
            }
        });
    });
    
    const avgVelocities: Record<string, number> = {};
    Object.keys(velocities).forEach(workerId => {
        avgVelocities[workerId] = velocities[workerId].daysWorked > 0 
            ? velocities[workerId].totalUnits / velocities[workerId].daysWorked 
            : 0;
    });
    
    return avgVelocities;
  }, [plan]);

  const getBatchAnalysis = (batch: Batch) => {
    const { 
        id,
        aiVideos, normalVideos, 
        completedGen, completedEdit, 
        startDate, endDate 
    } = batch;

    const totalWorkUnits = aiVideos + (aiVideos + normalVideos);
    const cGen = completedGen || 0;
    const cEdit = completedEdit || 0;
    const completedUnits = cGen + cEdit;
    const remainingUnits = totalWorkUnits - completedUnits;
    const progress = totalWorkUnits > 0 ? Math.round((completedUnits / totalWorkUnits) * 100) : 0;

    const today = new Date();
    today.setHours(0,0,0,0);
    const start = startDate ? new Date(startDate) : new Date();
    start.setHours(0,0,0,0);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(0,0,0,0);

    const msPerDay = 1000 * 60 * 60 * 24;
    const daysPassed = Math.max(0, (today.getTime() - start.getTime()) / msPerDay);
    
    let predictedDate = null;

    if (progress < 100 && plan && plan.schedule) {
        const lastDay = plan.schedule[plan.schedule.length - 1];
        const activeAssignments = lastDay.assignments.filter(a => a.batchId === id);
        
        const combinedActiveVelocity = activeAssignments.reduce((sum, a) => sum + (editorVelocities[a.workerId] || 0), 0);
        
        const velocity = combinedActiveVelocity > 0 ? combinedActiveVelocity : (daysPassed > 0 ? (completedUnits / daysPassed) : 0);
        
        if (velocity > 0) {
            const predictedDaysNeeded = remainingUnits / velocity;
            const pDate = new Date(today);
            pDate.setDate(today.getDate() + Math.ceil(predictedDaysNeeded));
            predictedDate = pDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        }
    }

    let status: 'ontrack' | 'risk' | 'delayed' | 'completed' | 'due_today' = 'ontrack';
    let predictionData = 0;

    if (progress >= 100) {
        status = 'completed';
    } else if (today > end) {
        status = 'delayed';
        predictionData = Math.ceil((today.getTime() - end.getTime()) / msPerDay);
    } else {
        const actualVelocity = daysPassed > 0 ? (completedUnits / daysPassed) : 0;
        
        if (actualVelocity > 0) {
            const daysRemaining = Math.ceil((end.getTime() - today.getTime()) / msPerDay);
            const daysNeeded = remainingUnits / actualVelocity;
            const buffer = daysRemaining - daysNeeded;
            
            if (buffer < 0) {
                status = 'delayed';
                predictionData = Math.abs(buffer);
            } else if (buffer < 0.5) { 
                status = 'risk';
            } else {
                status = 'ontrack';
                predictionData = buffer;
            }
        }
    }

    return { status, progress, remainingUnits, predictionData, endDate, predictedDate };
  };

  const batchesByLang = useMemo(() => {
    const allBatches = (batches || []).filter(b => b.status === 'active');
    const grouped: Record<string, { active: Batch[], completed: Batch[] }> = {};

    allBatches.forEach(b => {
        const lang = b.language || 'Telugu';
        if (!grouped[lang]) grouped[lang] = { active: [], completed: [] };

        const total = b.aiVideos + (b.aiVideos + b.normalVideos);
        const done = (b.completedGen || 0) + (b.completedEdit || 0);
        const p = total > 0 ? Math.round((done / total) * 100) : 0;

        if (p >= 100) {
            grouped[lang].completed.push(b);
        } else {
            grouped[lang].active.push(b);
        }
    });
    return grouped;
  }, [batches]);

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
        case 'delayed': return 'bg-red-100 text-red-700 border-red-200';
        case 'risk': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'due_today': return 'bg-orange-100 text-[#F26C21] border-orange-200';
        default: return 'bg-emerald-50 text-emerald-600 border-emerald-200';
    }
  };

  const getStatusLabel = (status: string, extra: number) => {
     switch(status) {
        case 'completed': return 'Done';
        case 'delayed': return `+${Math.ceil(extra)} Days`;
        case 'risk': return 'Risk';
        case 'due_today': return 'Due Today';
        default: return 'On Track';
    }
  };

    const getLangTheme = (lang: string) => {
    const lower = (lang || '').toLowerCase();
    if (lower.includes('telugu')) return { 
        bg: 'bg-white', 
        border: 'border-orange-200', 
        icon: 'text-orange-600 bg-orange-50', 
        title: 'text-orange-900' 
    };
    if (lower.includes('hindi')) return { 
        bg: 'bg-white', 
        border: 'border-sky-200', 
        icon: 'text-sky-600 bg-sky-50', 
        title: 'text-sky-900' 
    };
    if (lower.includes('tamil')) return { 
        bg: 'bg-white', 
        border: 'border-violet-200', 
        icon: 'text-violet-600 bg-violet-50', 
        title: 'text-violet-900' 
    };
    return { 
        bg: 'bg-white', 
        border: 'border-slate-200', 
        icon: 'text-slate-600 bg-slate-50', 
        title: 'text-slate-900' 
    };
  };

  return (
    <div className="w-full h-full bg-slate-50 dark:bg-slate-950 p-6 overflow-y-auto custom-scrollbar flex-1 transition-colors duration-300">
      <div className="w-full space-y-8 max-w-[1920px] mx-auto">
        
        {/* Header Removed */}
        
        {Object.keys(batchesByLang).length === 0 ? (
            <div className="text-center py-32">
                <LayoutGrid className="mx-auto mb-4 text-slate-300 dark:text-slate-700" size={64} />
                <h2 className="text-2xl font-bold text-slate-400 dark:text-slate-600">No Projects Found</h2>
                <p className="text-slate-400 dark:text-slate-500 mt-2">Active projects will appear here.</p>
            </div>
        ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {Object.entries(batchesByLang).map(([lang, group]) => {
                    const { active, completed } = group as { active: Batch[], completed: Batch[] };
                    const theme = getLangTheme(lang);
                    const hasActive = active.length > 0;
                    const hasCompleted = completed.length > 0;
                    
                    // Filter workers for this language
                    const langWorkers = workers.filter(w => (w.language || 'Telugu') === lang);
                    
                    if (!hasActive && !hasCompleted) return null;

                    return (
                        <section key={lang} className={`flex flex-col gap-4 p-4 rounded-[2rem] border shadow-sm ${theme.bg} ${theme.border} transition-all duration-300 animate-in fade-in slide-in-from-bottom-2`}>
                            {/* Language Header */}
                            <div className="border-b border-slate-100 dark:border-slate-800 pb-6 text-center">
                                <h2 className={`text-3xl font-black leading-none ${theme.title}`}>{lang}</h2>
                                <div className="flex justify-center gap-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1.5">
                                    {hasActive && <span>{active.length} Active</span>}
                                    {hasCompleted && <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> {completed.length} Completed</span>}
                                </div>
                            </div>
                            
                            {/* Active Projects Grid */}
                            {hasActive && (
                                <div className={`grid ${active.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3'} gap-4`}>
                                    {active.map(batch => {
                                        const { status, progress, remainingUnits, predictionData, endDate, predictedDate } = getBatchAnalysis(batch);
                                        const statusColor = getStatusColor(status);
                                        const isCompleted = status === 'completed' || progress >= 100;

                                        return (
                                            <div key={batch.id} className={`${isCompleted ? 'bg-emerald-50/50 border-emerald-200' : 'bg-slate-50 border-slate-200'} rounded-xl p-3 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group relative border shadow-sm flex flex-col justify-between h-full`}>
                                                
                                                <div>
                                                    {/* Header */}
                                                    <div className="flex justify-between items-start mb-2">
                                                        <div className="min-w-0 pr-2">
                                                            <div className={`text-[9px] font-bold uppercase tracking-wide truncate mb-0.5 ${isCompleted ? 'text-emerald-500' : 'text-slate-400'}`}>{batch.clientName}</div>
                                                            <h3 className={`text-sm font-black leading-tight truncate ${isCompleted ? 'text-emerald-900' : 'text-slate-800'}`} title={batch.batchName}>
                                                                {batch.batchName}
                                                            </h3>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Progress Bar */}
                                                    <div className="mb-3">
                                                        <div className="flex justify-between items-end mb-1">
                                                            <span className={`text-[9px] font-bold uppercase ${isCompleted ? 'text-emerald-500' : 'text-slate-400'}`}>Progress</span>
                                                            <span className={`text-lg font-black ${status === 'completed' ? 'text-emerald-600' : 'text-slate-700'}`}>{progress}%</span>
                                                        </div>
                                                        <div className={`w-full h-2 rounded-full overflow-hidden mb-2 ${isCompleted ? 'bg-emerald-200' : 'bg-slate-200'}`}>
                                                            <div 
                                                                className={`h-full rounded-full transition-all duration-500 ${
                                                                    status === 'delayed' ? 'bg-red-500' : 
                                                                    status === 'risk' ? 'bg-amber-400' : 
                                                                    status === 'completed' ? 'bg-emerald-500' :
                                                                    'bg-[#F26C21]'
                                                                }`}
                                                                style={{ width: `${progress}%` }}
                                                            ></div>
                                                        </div>
                                                        <div className={`w-full py-1 rounded-md border text-center text-[9px] font-bold uppercase tracking-wide ${statusColor}`}>
                                                            {getStatusLabel(status, predictionData)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Footer Info */}
                                                <div className={`flex justify-between items-center pt-2 border-t ${isCompleted ? 'border-emerald-100' : 'border-slate-200'}`}>
                                                    <div className="flex flex-col">
                                                        <span className={`text-[8px] font-bold uppercase ${isCompleted ? 'text-emerald-400' : 'text-slate-400'}`}>Deadline</span>
                                                        <span className={`text-xs font-bold ${status === 'delayed' ? 'text-red-500' : (isCompleted ? 'text-emerald-800' : 'text-slate-700')}`}>
                                                            {endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-[8px] font-bold uppercase ${isCompleted ? 'text-emerald-400' : 'text-slate-400'}`}>Pending</span>
                                                        <span className={`text-xs font-bold ${isCompleted ? 'text-emerald-800' : 'text-slate-700'}`}>
                                                            {remainingUnits} Units
                                                        </span>
                                                    </div>
                                                </div>
                                                {!isCompleted && predictedDate && (
                                                    <div className="mt-1 text-center text-[10px] border-t border-slate-200 pt-1">
                                                        <span className="text-indigo-600 font-bold">Predicted: {predictedDate}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {/* Completed Projects (Compact) */}
                            {hasCompleted && (
                                <div className="mt-4">
                                    <h3 className="text-xs font-black uppercase text-emerald-600/70 mb-4 flex items-center gap-2 tracking-widest">
                                        <Trophy size={14} /> Completed History
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3 gap-4 opacity-80 hover:opacity-100 transition-opacity">
                                        {completed.map(batch => (
                                            <div key={batch.id} className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-4 flex items-center justify-between transition-all hover:bg-emerald-50 hover:shadow-md cursor-default">
                                                <div className="min-w-0 pr-2">
                                                    <div className="text-[9px] font-bold uppercase text-emerald-600/60 truncate mb-0.5">{batch.clientName}</div>
                                                    <div className="text-sm font-black text-emerald-800 truncate" title={batch.batchName}>{batch.batchName}</div>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center">
                                                        <CheckCircle size={16} />
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>
                    );
                })}
            </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
