
import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, limit, onSnapshot, getFirestore } from 'firebase/firestore';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { Batch } from '../types';
import { LayoutGrid, CheckCircle, Trophy, Moon, Sun } from 'lucide-react';

// Re-using the config from your service or hardcoding for the view to ensure standalone capability
const firebaseConfig = {
    apiKey: "AIzaSyBQ43797xkZC0mhWg_8z3SzELYIzRT-xMY",
    authDomain: "wedo-ai.firebaseapp.com",
    projectId: "wedo-ai",
    storageBucket: "wedo-ai.firebasestorage.app",
    messagingSenderId: "241094368552",
    appId: "1:241094368552:web:589e6d5ddb416ed853841d",
    measurementId: "G-ZMXFL519KC"
};

const getDb = () => {
    return getApps().length === 0 ? getFirestore(initializeApp(firebaseConfig)) : getFirestore(getApp());
};

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
    if (lower.includes('kannada')) return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-emerald-200 dark:border-emerald-900/30', 
        icon: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400', 
        title: 'text-emerald-900 dark:text-emerald-100' 
    };
    if (lower.includes('malayalam')) return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-rose-200 dark:border-rose-900/30', 
        icon: 'text-rose-600 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-400', 
        title: 'text-rose-900 dark:text-rose-100' 
    };
    return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-slate-200 dark:border-slate-800', 
        icon: 'text-slate-600 bg-slate-50 dark:bg-slate-800 dark:text-slate-400', 
        title: 'text-slate-900 dark:text-slate-100' 
    };
};

const ProjectCard: React.FC<{ batch: Batch }> = ({ batch }) => {
    const { 
        batchName, clientName, 
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

    let status = 'ontrack'; 
    let predictionData = 0;

    if (progress >= 100) {
        status = 'completed';
    } else if (today > end) {
        status = 'delayed';
        predictionData = Math.ceil((today.getTime() - end.getTime()) / msPerDay);
    } else if (daysRemaining === 0) {
        status = 'due_today';
        if (remainingUnits > 5) {
             predictionData = 0; 
        }
    } else {
        const actualVelocity = daysPassed > 0 ? (completedUnits / daysPassed) : 0;
        if (actualVelocity > 0) {
            const daysNeededToFinish = remainingUnits / actualVelocity;
            const buffer = daysRemaining - daysNeededToFinish;
            
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

    const statusColor = getStatusColor(status);
    const isCompleted = status === 'completed' || progress >= 100;

    return (
        <div className={`${isCompleted ? 'bg-emerald-50/50 border-emerald-200 dark:bg-emerald-900/10 dark:border-emerald-800' : 'bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-800'} rounded-xl p-5 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 relative group border shadow-sm flex flex-col h-full justify-between`}>
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                    <div className="min-w-0 pr-2 flex-1">
                        <div className={`text-[10px] font-bold uppercase tracking-wide truncate mb-1 ${isCompleted ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>{clientName}</div>
                        <h3 className={`text-lg font-black leading-tight truncate ${isCompleted ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-800 dark:text-slate-200'}`} title={batchName}>
                            {batchName}
                        </h3>
                    </div>
                </div>
                
                {/* Progress Bar */}
                <div className="mb-5">
                    <div className="flex justify-between items-end mb-2">
                        <span className={`text-[10px] font-bold uppercase ${isCompleted ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>Progress</span>
                        <span className={`text-2xl font-black ${isCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-200'}`}>{progress}%</span>
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
                        {status === 'completed' ? 'Done' : `${remainingUnits} Units`}
                        </span>
                </div>
            </div>
        </div>
    );
};

const PublicDashboard: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [batches, setBatches] = useState<Batch[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        const db = getDb();
        const q = query(collection(db, "production_plans"), orderBy("createdAt", "desc"), limit(1));
        
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            if (!snapshot.empty) {
                const data = snapshot.docs[0].data();
                const loadedBatches = (data.batches || []) as Batch[];
                loadedBatches.sort((a, b) => (a.status === 'active' ? -1 : 1));
                
                setBatches(loadedBatches);
                setLastUpdated(data.updatedAt?.toDate() || new Date());
            }
            setLoading(false);
        }, (error) => {
            console.error("Error connecting to live stream:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className={`min-h-screen flex flex-col items-center justify-center ${isDarkMode ? 'bg-slate-950' : 'bg-slate-50'}`}>
                <div className="relative">
                    <div className="w-12 h-12 border-4 border-slate-200 dark:border-slate-800 border-t-[#F26C21] rounded-full animate-spin"></div>
                </div>
                <div className="mt-4 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Connecting to Live Data...</div>
            </div>
        );
    }

    const batchesByLang: Record<string, { active: Batch[], completed: Batch[] }> = batches.reduce((acc, batch) => {
        const lang = batch.language || 'Telugu';
        if (!acc[lang]) acc[lang] = { active: [], completed: [] };

        const total = batch.aiVideos + (batch.aiVideos + batch.normalVideos);
        const done = (batch.completedGen || 0) + (batch.completedEdit || 0);
        const p = total > 0 ? (done / total) * 100 : 0;
        
        if(batch.status === 'active') {
            if (Math.round(p) >= 100) {
                acc[lang].completed.push(batch);
            } else {
                acc[lang].active.push(batch);
            }
        }
        return acc;
    }, {} as Record<string, { active: Batch[], completed: Batch[] }>);

    return (
        <div className={isDarkMode ? "dark" : ""}>
            <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20 transition-colors duration-300">
                {/* Header */}
                <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50 shadow-sm transition-colors duration-300">
                    <div className="w-full px-6 h-20 flex items-center justify-between max-w-[1920px] mx-auto">
                        <div className="flex items-center gap-4">
                            <img src="https://wedomarketing.co.in/wp-content/uploads/2024/04/cropped-1-1536x880.png" alt="WeDo" className="h-9 w-auto" />
                            <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-white">Live Dashboard</h1>
                        </div>
                        <div className="flex items-center gap-6">
                            <div className="text-right hidden sm:block">
                                <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Last Sync</div>
                                <div className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">{lastUpdated ? lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second: '2-digit'}) : '--:--'}</div>
                            </div>
                            
                            <button 
                                onClick={() => setIsDarkMode(!isDarkMode)}
                                className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                            >
                                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                            </button>

                            <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded-full border border-emerald-100 dark:border-emerald-800 shadow-sm">
                                <div className="relative w-2.5 h-2.5">
                                    <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                                </div>
                                <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Live</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="w-full px-4 md:px-8 py-10 max-w-[1920px] mx-auto">
                    {Object.keys(batchesByLang).length === 0 ? (
                            <div className="text-center py-32">
                            <LayoutGrid size={64} className="text-slate-200 dark:text-slate-700 mx-auto mb-6" />
                            <h2 className="text-2xl font-bold text-slate-300 dark:text-slate-600">Waiting for Projects...</h2>
                            <p className="text-slate-400 dark:text-slate-500 text-sm mt-3">Data will appear here automatically when created.</p>
                            </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-12">
                            {Object.entries(batchesByLang).map(([lang, { active, completed }]) => {
                                const hasActive = active.length > 0;
                                const hasCompleted = completed.length > 0;
                                if(!hasActive && !hasCompleted) return null;

                                const theme = getLangTheme(lang);
                                
                                return (
                                    <div key={lang} className={`flex flex-col gap-8 p-8 rounded-[2.5rem] border shadow-sm ${theme.bg} ${theme.border} transition-all duration-300 animate-in fade-in slide-in-from-bottom-4`}>
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

                                        {hasActive && (
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                                                {active.map(batch => (
                                                    <ProjectCard key={batch.id} batch={batch} />
                                                ))}
                                            </div>
                                        )}

                                        {hasCompleted && (
                                            <div className="mt-4">
                                                <h3 className="text-xs font-black uppercase text-emerald-600/70 dark:text-emerald-400/70 mb-4 flex items-center gap-2 tracking-widest">
                                                    <Trophy size={14} /> Completed History
                                                </h3>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 opacity-80 hover:opacity-100 transition-opacity">
                                                    {completed.map(batch => (
                                                        <div key={batch.id} className="bg-emerald-50/30 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:shadow-md cursor-default">
                                                            <div className="min-w-0 pr-2">
                                                                <div className="text-[9px] font-bold uppercase text-emerald-600/50 dark:text-emerald-400/50 truncate mb-0.5">{batch.clientName}</div>
                                                                <div className="text-sm font-bold text-emerald-900 dark:text-emerald-100 truncate" title={batch.batchName}>{batch.batchName}</div>
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
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PublicDashboard;
