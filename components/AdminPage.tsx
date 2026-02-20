
import React, { useMemo } from 'react';
import { Worker, Batch, ProductionPlan } from '../types';
import { Shield, LayoutGrid, Clock, Calendar, CheckCircle, Zap, Globe, Trophy, ArrowLeft } from 'lucide-react';

interface AdminPageProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  languages: string[];
  setLanguages: React.Dispatch<React.SetStateAction<string[]>>;
  onBack: () => void;
  currentLanguage: string;
  batches: Batch[];
  plan: ProductionPlan | null;
}

const AdminPage: React.FC<AdminPageProps> = ({ 
    workers, 
    batches,
    plan,
    onBack
}) => {
  
  const getBatchAnalysis = (batch: Batch) => {
    const { 
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
    const totalDuration = Math.max(1, (end.getTime() - start.getTime()) / msPerDay);
    const daysPassed = Math.max(0, (today.getTime() - start.getTime()) / msPerDay);
    const daysRemaining = Math.ceil((end.getTime() - today.getTime()) / msPerDay);

    let status: 'ontrack' | 'risk' | 'delayed' | 'completed' | 'due_today' = 'ontrack';
    let predictionData = 0;

    if (progress >= 100) {
        status = 'completed';
    } else if (today > end) {
        status = 'delayed';
        predictionData = Math.ceil((today.getTime() - end.getTime()) / msPerDay);
    } else if (daysRemaining === 0) {
        status = 'due_today';
        if (remainingUnits > 0) {
             if (remainingUnits > 5) { 
                 predictionData = 1;
             }
        }
    } else {
        const actualVelocity = daysPassed > 0 ? (completedUnits / daysPassed) : 0;
        
        if (actualVelocity > 0) {
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

            if (remainingUnits <= 10 && daysRemaining >= 1 && buffer > -1) {
                status = 'ontrack';
            }

        } else {
            if (daysPassed / totalDuration > 0.25) status = 'risk';
        }
    }

    return { status, progress, remainingUnits, predictionData, endDate };
  };

  const batchesByLang = useMemo(() => {
    const allBatches = batches.filter(b => b.status === 'active');
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
        case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
        case 'delayed': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800';
        case 'risk': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
        case 'due_today': return 'bg-orange-100 text-[#F26C21] border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800';
        default: return 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800/50';
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
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-orange-200 dark:border-orange-900/30', 
        icon: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400', 
        title: 'text-orange-900 dark:text-orange-100' 
    };
    if (lower.includes('hindi')) return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-sky-200 dark:border-sky-900/30', 
        icon: 'text-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-400', 
        title: 'text-sky-900 dark:text-sky-100' 
    };
    if (lower.includes('tamil')) return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-violet-200 dark:border-violet-900/30', 
        icon: 'text-violet-600 bg-violet-50 dark:bg-violet-900/20 dark:text-violet-400', 
        title: 'text-violet-900 dark:text-violet-100' 
    };
    return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-slate-200 dark:border-slate-800', 
        icon: 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400', 
        title: 'text-slate-900 dark:text-slate-100' 
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
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                {Object.entries(batchesByLang).map(([lang, group]) => {
                    const { active, completed } = group as { active: Batch[], completed: Batch[] };
                    const theme = getLangTheme(lang);
                    const hasActive = active.length > 0;
                    const hasCompleted = completed.length > 0;
                    
                    if (!hasActive && !hasCompleted) return null;

                    return (
                        <section key={lang} className={`flex flex-col gap-8 p-8 rounded-[2.5rem] border shadow-sm ${theme.bg} ${theme.border} transition-all duration-300 animate-in fade-in slide-in-from-bottom-2`}>
                            {/* Language Header */}
                            <div className="flex items-center gap-4 border-b border-slate-100 dark:border-slate-800 pb-6">
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm ${theme.icon}`}>
                                    {lang.charAt(0)}
                                </div>
                                <div>
                                    <h2 className={`text-3xl font-black leading-none ${theme.title}`}>{lang}</h2>
                                    <div className="flex gap-4 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1.5">
                                        {hasActive && <span>{active.length} Active</span>}
                                        {hasCompleted && <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={12} /> {completed.length} Completed</span>}
                                    </div>
                                </div>
                            </div>

                            {/* Active Projects Grid */}
                            {hasActive && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                                    {active.map(batch => {
                                        const { status, progress, remainingUnits, predictionData, endDate } = getBatchAnalysis(batch);
                                        const statusColor = getStatusColor(status);
                                        const isCompleted = status === 'completed' || progress >= 100;

                                        return (
                                            <div key={batch.id} className={`${isCompleted ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-800'} rounded-xl p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group relative border shadow-sm flex flex-col justify-between h-full`}>
                                                
                                                <div>
                                                    {/* Header */}
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div className="min-w-0 pr-2">
                                                            <div className={`text-[10px] font-bold uppercase tracking-wide truncate mb-1 ${isCompleted ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>{batch.clientName}</div>
                                                            <h3 className={`text-lg font-black leading-tight truncate ${isCompleted ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-800 dark:text-slate-200'}`} title={batch.batchName}>
                                                                {batch.batchName}
                                                            </h3>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Progress Bar */}
                                                    <div className="mb-5">
                                                        <div className="flex justify-between items-end mb-2">
                                                            <span className={`text-[10px] font-bold uppercase ${isCompleted ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>Progress</span>
                                                            <span className={`text-2xl font-black ${status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>{progress}%</span>
                                                        </div>
                                                        <div className={`w-full h-2.5 rounded-full overflow-hidden mb-3 ${isCompleted ? 'bg-emerald-200 dark:bg-emerald-900/40' : 'bg-slate-200 dark:bg-slate-700'}`}>
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
                                                        <div className={`w-full py-1.5 rounded-md border text-center text-[10px] font-bold uppercase tracking-wide ${statusColor}`}>
                                                            {getStatusLabel(status, predictionData)}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Footer Info */}
                                                <div className={`flex justify-between items-center pt-4 border-t ${isCompleted ? 'border-emerald-100 dark:border-emerald-900/30' : 'border-slate-200 dark:border-slate-700/50'}`}>
                                                    <div className="flex flex-col">
                                                        <span className={`text-[9px] font-bold uppercase ${isCompleted ? 'text-emerald-400 dark:text-emerald-500/70' : 'text-slate-400 dark:text-slate-500'}`}>Deadline</span>
                                                        <span className={`text-sm font-bold ${status === 'delayed' ? 'text-red-500' : (isCompleted ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300')}`}>
                                                            {endDate ? new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                                                        </span>
                                                    </div>
                                                    <div className="flex flex-col items-end">
                                                        <span className={`text-[9px] font-bold uppercase ${isCompleted ? 'text-emerald-400 dark:text-emerald-500/70' : 'text-slate-400 dark:text-slate-500'}`}>Pending</span>
                                                        <span className={`text-sm font-bold ${isCompleted ? 'text-emerald-800 dark:text-emerald-300' : 'text-slate-700 dark:text-slate-300'}`}>
                                                            {remainingUnits} Units
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                            
                            {/* Completed Projects (Compact) */}
                            {hasCompleted && (
                                <div className="mt-4">
                                    <h3 className="text-xs font-black uppercase text-emerald-600/70 dark:text-emerald-400/70 mb-4 flex items-center gap-2 tracking-widest">
                                        <Trophy size={14} /> Completed History
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-3 gap-4 opacity-80 hover:opacity-100 transition-opacity">
                                        {completed.map(batch => (
                                            <div key={batch.id} className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:shadow-md cursor-default">
                                                <div className="min-w-0 pr-2">
                                                    <div className="text-[9px] font-bold uppercase text-emerald-600/60 dark:text-emerald-400/60 truncate mb-0.5">{batch.clientName}</div>
                                                    <div className="text-sm font-black text-emerald-800 dark:text-emerald-100 truncate" title={batch.batchName}>{batch.batchName}</div>
                                                </div>
                                                <div className="flex-shrink-0">
                                                    <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
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
