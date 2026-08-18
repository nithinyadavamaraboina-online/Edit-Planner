
import React, { useState, useMemo } from 'react';
import { Worker, Batch, ProductionPlan } from '../types';
import { Shield, LayoutGrid, Clock, CheckCircle, Zap, Globe, Trophy, ArrowLeft, BarChart3, Users, Play, Star, Calendar, ChevronDown, ChevronUp, Search } from 'lucide-react';

interface AdminPageProps {
  workers: Worker[];
  onBack: () => void;
  batches: Batch[];
  plan: ProductionPlan | null;
  projectMeta: { id?: string; name: string; notes: string } | null;
  onError?: (msg: string) => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ 
    workers, 
    batches,
    plan,
    onBack,
    projectMeta,
    onError
}) => {
  const [activeTab, setActiveTab] = useState<'projects' | 'brands'>('projects');
  const [expandedBrands, setExpandedBrands] = useState<Record<string, boolean>>({});
  const [brandSearchQuery, setBrandSearchQuery] = useState('');
  
  const handleShareDashboard = () => {
    if (!projectMeta?.id) return;
    const url = `${window.location.origin}/editors-dashboard.html?id=${projectMeta.id}`;
    navigator.clipboard.writeText(url);
    if (onError) {
        onError("Dashboard link copied to clipboard!");
    } else {
        alert("Dashboard link copied to clipboard!");
    }
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

  // Premium Brand Efficiency & Editor Tracking Analysis
  const brandEfficiencyData = useMemo(() => {
    if (!plan || !plan.schedule) return [];

    const brandData: Record<string, {
      brandName: string;
      totalGenerations: number;
      totalEdits: number;
      totalUnits: number;
      editorDays: number;
      totalHours: number;
      editors: Record<string, { 
        name: string; 
        language: string; 
        totalUnits: number; 
        editorDays: number;
        totalHours: number;
      }>;
      languages: Record<string, { 
        totalUnits: number; 
        editorDays: number;
        totalHours: number;
      }>;
    }> = {};

    plan.schedule.forEach(day => {
      day.assignments.forEach(assignment => {
        const batchId = assignment.batchId;
        if (!batchId) return;

        const batch = (batches || []).find(b => b.id === batchId);
        if (!batch) return;

        const brand = (batch.clientName || 'Unassigned').trim();
        if (!brand) return;

        if (!brandData[brand]) {
          brandData[brand] = {
            brandName: brand,
            totalGenerations: 0,
            totalEdits: 0,
            totalUnits: 0,
            editorDays: 0,
            totalHours: 0,
            editors: {},
            languages: {}
          };
        }

        const info = brandData[brand];
        const gens = assignment.generations || 0;
        const edits = assignment.edits || 0;
        const units = gens + edits;
        const hours = assignment.hoursSpent || 0;

        if (units > 0 || hours > 0) {
          info.totalGenerations += gens;
          info.totalEdits += edits;
          info.totalUnits += units;
          info.totalHours += hours;
          if (units > 0) {
            info.editorDays += 1;
          }

          // Editor tracking
          const workerId = assignment.workerId;
          const worker = workers.find(w => w.id === workerId);
          const workerName = worker?.name || assignment.person || 'Unknown Editor';
          const lang = worker?.language || assignment.taskLanguage || batch.language || 'Telugu';

          if (!info.editors[workerId]) {
            info.editors[workerId] = {
              name: workerName,
              language: lang,
              totalUnits: 0,
              editorDays: 0,
              totalHours: 0
            };
          }
          info.editors[workerId].totalUnits += units;
          if (units > 0) {
            info.editors[workerId].editorDays += 1;
          }
          info.editors[workerId].totalHours += hours;

          // Language breakdown
          if (!info.languages[lang]) {
            info.languages[lang] = {
              totalUnits: 0,
              editorDays: 0,
              totalHours: 0
            };
          }
          info.languages[lang].totalUnits += units;
          if (units > 0) {
            info.languages[lang].editorDays += 1;
          }
          info.languages[lang].totalHours += hours;
        }
      });
    });

    return Object.values(brandData).map(item => {
      const avgEfficiency = item.editorDays > 0 ? (item.totalUnits / item.editorDays) : 0;
      
      const brandAvgHoursPerVideo = item.totalHours > 0 && item.totalUnits > 0 
        ? item.totalHours / item.totalUnits 
        : 0;

      const editorsArray = Object.values(item.editors).map(ed => {
        const avgHours = ed.totalHours > 0 && ed.totalUnits > 0 
          ? ed.totalHours / ed.totalUnits 
          : 0;
        return {
          ...ed,
          efficiency: ed.editorDays > 0 ? (ed.totalUnits / ed.editorDays) : 0,
          avgHoursPerVideo: avgHours
        };
      }).sort((a, b) => b.efficiency - a.efficiency);

      const languagesArray = Object.entries(item.languages).map(([lang, stats]) => ({
        language: lang,
        totalUnits: stats.totalUnits,
        editorDays: stats.editorDays,
        totalHours: stats.totalHours,
        efficiency: stats.editorDays > 0 ? (stats.totalUnits / stats.editorDays) : 0,
        avgHoursPerVideo: stats.totalHours > 0 && stats.totalUnits > 0 ? stats.totalHours / stats.totalUnits : 0
      })).sort((a, b) => b.efficiency - a.efficiency);

      // Predictions for active batches of this brand
      const predictions = (batches || [])
        .filter(b => b.status === 'active' && (b.clientName || '').trim() === item.brandName)
        .map(b => {
          const totalVideos = (b.aiVideos || 0) + (b.normalVideos || 0);
          // Let's assume progress property represents completed, or calculate from rows
          const completedVideos = (b.completedEdit || 0) + (b.completedNormal || 0);
          const remainingVideos = Math.max(0, totalVideos - completedVideos);
          
          const speedEstimate = brandAvgHoursPerVideo > 0 ? brandAvgHoursPerVideo : 1.2; // 1.2 hrs fallback per video
          const predictedHoursToWrap = remainingVideos * speedEstimate;
          const daysToWrap = avgEfficiency > 0 ? (remainingVideos / avgEfficiency) : remainingVideos;

          return {
            batchId: b.id,
            batchName: b.batchName,
            totalVideos,
            completedVideos,
            remainingVideos,
            predictedHoursToWrap,
            daysToWrap,
            isUsingFallback: brandAvgHoursPerVideo === 0
          };
        });

      // Determine editing style complexity category based on average units per day
      let complexity = 'Standard Complexity';
      let complexityColor = 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400';
      if (avgEfficiency > 11) {
        complexity = 'Swift Style (Quick Edits)';
        complexityColor = 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400';
      } else if (avgEfficiency < 8) {
        complexity = 'High Complexity (Time Consuming Edits)';
        complexityColor = 'text-rose-500 bg-rose-50 dark:bg-rose-900/20 dark:text-rose-450';
      }

      return {
        ...item,
        avgEfficiency,
        brandAvgHoursPerVideo,
        complexity,
        complexityColor,
        editors: editorsArray,
        languages: languagesArray,
        predictions
      };
    }).sort((a, b) => b.totalUnits - a.totalUnits);
  }, [plan, batches, workers]);

  const getBatchAnalysis = (batch: Batch) => {
    const { 
        id,
        aiVideos, normalVideos, 
        completedGen, completedEdit, completedNormal,
        horizontalVersions, verticalVersions, squareVersions,
        startDate, endDate 
    } = batch;

    const versionsTotal = ((horizontalVersions || 0) + (verticalVersions || 0) + (squareVersions || 0)) * 0.25;
    const totalWorkUnits = aiVideos + (aiVideos + normalVideos) + versionsTotal;
    const cGen = completedGen || 0;
    const cEdit = completedEdit || 0;
    const cNormal = completedNormal || 0;
    const completedUnits = cGen + cEdit + cNormal;
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

        const versionsTotal = ((b.horizontalVersions || 0) + (b.verticalVersions || 0) + (b.squareVersions || 0)) * 0.25;
        const total = b.aiVideos + (b.aiVideos + b.normalVideos) + versionsTotal;
        const done = (b.completedGen || 0) + (b.completedEdit || 0) + (b.completedNormal || 0);
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
        case 'completed': return 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 border-emerald-200 dark:border-emerald-800';
        case 'delayed': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800';
        case 'risk': return 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800';
        case 'due_today': return 'bg-orange-100 dark:bg-orange-900/30 text-[#F26C21] dark:text-orange-400 border-orange-200 dark:border-orange-800';
        default: return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800';
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
        border: 'border-orange-200 dark:border-orange-800', 
        icon: 'text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-900/20', 
        title: 'text-orange-900 dark:text-orange-100' 
    };
    if (lower.includes('hindi')) return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-sky-200 dark:border-sky-800', 
        icon: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-900/20', 
        title: 'text-sky-900 dark:text-sky-100' 
    };
    if (lower.includes('tamil')) return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-violet-200 dark:border-violet-800', 
        icon: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20', 
        title: 'text-violet-900 dark:text-violet-100' 
    };
    return { 
        bg: 'bg-white dark:bg-slate-900', 
        border: 'border-slate-200 dark:border-slate-800', 
        icon: 'text-slate-600 bg-slate-50 dark:text-slate-400 dark:bg-slate-800', 
        title: 'text-slate-900 dark:text-slate-100' 
    };
  };

  return (
    <div className="w-full h-full bg-slate-50 p-6 overflow-y-auto custom-scrollbar flex-1 transition-colors duration-300">
      <div className="w-full space-y-8 max-w-[1920px] mx-auto">
        
        {/* Top Navigation & Header */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center border-b border-slate-200 dark:border-slate-800 pb-6">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight flex items-center gap-3">
              <Shield className="text-[#F26C21]" size={28} />
              Production Workspace Details
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Monitor active language projects, view brand editor average speeds, and analyze batch wrapped forecasts.
            </p>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200/50 dark:border-slate-700/50 shadow-inner">
            <button
              id="active-batches-tab"
              onClick={() => setActiveTab('projects')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm tracking-wide transition-all ${
                activeTab === 'projects'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-md scale-[1.02]'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
              }`}
            >
              <LayoutGrid size={16} />
              Active Batches
            </button>
            <button
              id="brand-analytics-tab"
              onClick={() => setActiveTab('brands')}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs md:text-sm tracking-wide transition-all ${
                activeTab === 'brands'
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-md scale-[1.02]'
                  : 'text-slate-550 dark:text-slate-400 hover:text-slate-850 dark:hover:text-slate-200'
              }`}
            >
              <BarChart3 size={16} />
              Brand & Editor Analytics
              <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-amber-500 text-[8px] text-white font-extrabold items-center justify-center">!</span>
              </span>
            </button>
          </div>
        </div>

        {activeTab === 'projects' ? (
          Object.keys(batchesByLang).length === 0 ? (
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
                      
                      if (!hasActive && !hasCompleted) return null;

                      return (
                          <section key={lang} className={`flex flex-col gap-4 p-4 rounded-[2rem] border shadow-sm ${theme.bg} ${theme.border} transition-all duration-300 animate-in fade-in slide-in-from-bottom-2`}>
                              {/* Language Header */}
                              <div className="border-b border-slate-100 dark:border-slate-800 pb-6 text-center">
                                  <h2 className={`text-3xl font-black leading-none ${theme.title}`}>{lang}</h2>
                              </div>
                              
                              {/* Active Projects Grid */}
                              {hasActive && (
                                  <div className="grid grid-cols-1 gap-4">
                                      {active.map(batch => {
                                          const { status, progress, remainingUnits, predictionData, endDate, predictedDate } = getBatchAnalysis(batch);
                                          const isCompleted = status === 'completed' || progress >= 100;

                                          return (
                                              <div key={batch.id} className={`${isCompleted ? 'bg-emerald-50/30 dark:bg-emerald-900/10 border-emerald-100 dark:border-emerald-800' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'} rounded-2xl p-4 transition-all duration-300 group relative border shadow-sm flex flex-col justify-between h-full`}>
                                                  
                                                  <div>
                                                      {/* Header */}
                                                      <div className="flex justify-between items-start mb-4">
                                                          <div className="min-w-0 pr-2">
                                                              <div className={`text-[10px] font-bold uppercase tracking-widest truncate mb-1 ${isCompleted ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>{batch.clientName}</div>
                                                              <h3 className={`text-base font-black leading-tight truncate ${isCompleted ? 'text-emerald-900 dark:text-emerald-100' : 'text-slate-800 dark:text-slate-100'}`} title={batch.batchName}>
                                                                  {batch.batchName}
                                                              </h3>
                                                          </div>
                                                          <div className="flex flex-col items-end">
                                                              <span className={`text-[9px] font-bold uppercase tracking-wider ${isCompleted ? 'text-emerald-400 dark:text-emerald-500' : 'text-slate-400 dark:text-slate-500'}`}>Pending</span>
                                                              <span className={`text-sm font-bold ${isCompleted ? 'text-emerald-800 dark:text-emerald-200' : 'text-slate-700 dark:text-slate-300'}`}>
                                                                  {remainingUnits} Units
                                                              </span>
                                                          </div>
                                                      </div>
                                                      
                                                      {/* Progress Bar */}
                                                      <div className="mb-2">
                                                          <div className="flex justify-between items-end mb-1.5">
                                                              <span className={`text-[10px] font-bold uppercase tracking-wider ${isCompleted ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`}>Progress</span>
                                                              <span className={`text-xl font-black ${status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-white'}`}>{progress}%</span>
                                                          </div>
                                                          <div className={`w-full h-2 rounded-full overflow-hidden ${isCompleted ? 'bg-emerald-200 dark:bg-emerald-800/50' : 'bg-slate-100 dark:bg-slate-700'}`}>
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
                                      <h3 className="text-xs font-black uppercase text-emerald-600/70 mb-4 flex items-center gap-2 tracking-widest">
                                          <Trophy size={14} /> Completed History
                                      </h3>
                                      <div className="grid grid-cols-1 gap-4 opacity-80 hover:opacity-100 transition-opacity">
                                          {completed
                                              .sort((a, b) => new Date(b.endDate || 0).getTime() - new Date(a.endDate || 0).getTime())
                                              .slice(0, 1)
                                              .map(batch => (
                                              <div key={batch.id} className="bg-emerald-50/50 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-800 rounded-xl p-4 flex items-center justify-between transition-all hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:shadow-md cursor-default">
                                                  <div className="min-w-0 pr-2">
                                                      <div className="text-[9px] font-bold uppercase text-emerald-600/60 dark:text-emerald-400/60 truncate mb-0.5">{batch.clientName}</div>
                                                      <div className="text-sm font-black text-emerald-800 dark:text-emerald-100 truncate" title={batch.batchName}>{batch.batchName}</div>
                                                  </div>
                                                  <div className="flex-shrink-0">
                                                      <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
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
          )
        ) : (
          /* Brand-wise Efficiency Tracker View */
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Meta context card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-900 dark:to-slate-900/40 p-6 rounded-[2rem] border border-blue-100/40 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2">
                  <Star className="text-yellow-500 fill-yellow-500 animate-pulse" size={18} />
                  Editing Efficiency & Complexity by Brand
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl leading-relaxed">
                  Different client brands (e.g., Speakx, Seekho, Axis Max) require distinctive edit styles and lengths. Brands with a <strong>lower rate of average units/day</strong> demand more time and detailed editing styles, while brands with <strong>higher rates</strong> are swifter.
                </p>
              </div>
              <div className="text-[10px] font-mono bg-white dark:bg-slate-800 px-3 py-1.5 rounded-lg text-slate-500 dark:text-slate-400 border border-slate-100 dark:border-slate-700/60 shadow-sm flex items-center gap-2">
                <Calendar size={12} />
                Updated in Real-time from Active Schedule
              </div>
            </div>

            {brandEfficiencyData.length === 0 ? (
              <div className="text-center py-24 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <BarChart3 className="mx-auto mb-4 text-slate-300 dark:text-slate-705" size={64} />
                <h2 className="text-xl font-bold text-slate-500 dark:text-slate-400">No Brand Allocations Detected</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-2 max-w-md mx-auto">
                  To view and track real-time efficiency across Seekho, Speakx, Axis Max, Moneyview, and Oolka, please go to the <strong>Daily Update</strong> tab and assign rows pointing to these batches/brands!
                </p>
              </div>
            ) : (
              <>
                {/* Search and Toggle Toolbar */}
                <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 shadow-sm">
                  <div className="relative w-full sm:w-80">
                    <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search brand (e.g. Seekho, Speakx)..."
                      value={brandSearchQuery}
                      onChange={(e) => setBrandSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 text-xs md:text-sm font-medium text-slate-700 dark:text-slate-200 placeholder-slate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-2 focus:ring-[#F26C21] focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto justify-end">
                    <button
                      onClick={() => {
                        const anyExpanded = brandEfficiencyData.some(b => expandedBrands[b.brandName]);
                        const newState: Record<string, boolean> = {};
                        brandEfficiencyData.forEach(b => {
                          newState[b.brandName] = !anyExpanded;
                        });
                        setExpandedBrands(newState);
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-150 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 hover:text-slate-900 rounded-2xl text-xs font-bold transition-all border border-slate-200/55 dark:border-slate-700/55 shadow-xs"
                    >
                      {brandEfficiencyData.some(b => expandedBrands[b.brandName]) ? (
                        <>Hide All Details</>
                      ) : (
                        <>Expand All Details</>
                      )}
                    </button>
                  </div>
                </div>

                {brandEfficiencyData.filter(d => d.brandName.toLowerCase().includes(brandSearchQuery.toLowerCase())).length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                    <Search className="mx-auto mb-3 text-slate-300 dark:text-slate-700/50" size={48} />
                    <h3 className="text-lg font-bold text-slate-500 dark:text-slate-400">No matching brands found</h3>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Try searching for a different keyword or check your spelling.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {brandEfficiencyData
                      .filter(d => d.brandName.toLowerCase().includes(brandSearchQuery.toLowerCase()))
                      .map(data => {
                        const isExpanded = !!expandedBrands[data.brandName];
                        return (
                          <div key={data.brandName} className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-100 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between transition-all hover:shadow-md h-fit">
                            
                            {/* Brand Header */}
                            <div className="border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
                              <div className="flex justify-between items-start">
                                <div>
                                  <span className="text-[9px] font-black uppercase tracking-widest text-[#F26C21] bg-orange-50 dark:bg-orange-950/20 px-2 py-0.5 rounded-md">CLIENT BRAND</span>
                                  <h3 className="text-2xl font-black text-slate-800 dark:text-white mt-1">{data.brandName}</h3>
                                </div>
                                <div className="text-right">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 block">Brand Velocity</span>
                                  <span className="text-2xl font-black text-blue-650 dark:text-blue-400">{data.avgEfficiency.toFixed(1)} <span className="text-xs font-bold text-slate-500">units/day</span></span>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 mt-3">
                                <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full ${data.complexityColor}`}>
                                  {data.complexity}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                                  • {data.totalUnits} Units over {data.editorDays} Editor-Days
                                </span>
                              </div>
                            </div>

                            {/* Stats Split Grid */}
                            <div className="grid grid-cols-4 gap-2 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-2xl border border-slate-100/40 dark:border-slate-800/40 mb-4 text-center">
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Generations</span>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{data.totalGenerations}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Normal Edits</span>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{data.totalEdits}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest block font-sans">Editor Days</span>
                                <span className="text-sm font-black text-slate-700 dark:text-slate-200">{data.editorDays}</span>
                              </div>
                              <div>
                                <span className="text-[9px] font-bold text-amber-500 dark:text-amber-450 uppercase tracking-widest block font-sans">Avg Time / Video</span>
                                <span className="text-sm font-black text-amber-600 dark:text-amber-400">
                                  {data.brandAvgHoursPerVideo > 0 
                                    ? (data.brandAvgHoursPerVideo >= 1 
                                        ? `${data.brandAvgHoursPerVideo.toFixed(1)} hrs` 
                                        : `${Math.round(data.brandAvgHoursPerVideo * 60)} mins`)
                                    : 'N/A Logged'}
                                </span>
                              </div>
                            </div>

                            {/* Collapsible details toggle button */}
                            <button
                              onClick={() => setExpandedBrands(prev => ({ ...prev, [data.brandName]: !prev[data.brandName] }))}
                              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 border dark:border-slate-850 cursor-pointer transition-all ${
                                isExpanded
                                  ? 'bg-slate-100 dark:bg-slate-800 text-[#F26C21] hover:bg-slate-150/50 border-slate-200'
                                  : 'bg-orange-50/10 hover:bg-orange-50/30 dark:hover:bg-orange-950/5 text-slate-600 dark:text-slate-400 hover:text-[#F26C21] border-slate-100'
                              }`}
                            >
                              {isExpanded ? (
                                <>
                                  Collapse Details & Predictions
                                  <ChevronUp size={14} />
                                </>
                              ) : (
                                <>
                                  View Predictions & Editor Speeds ({data.predictions?.length || 0} Batches)
                                  <ChevronDown size={14} />
                                </>
                              )}
                            </button>

                            {/* Detailed information rendered only when expanded */}
                            {isExpanded && (
                              <div className="mt-4 pt-4 border-t border-dashed border-slate-200 dark:border-slate-800 space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
                                
                                {/* Language Efficiency Breakdown */}
                                <div>
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-2">
                                    <Globe size={12} className="text-blue-500" />
                                    Language Team Comparison
                                  </h4>
                                  <div className="space-y-1.5">
                                    {data.languages.map(langStat => (
                                      <div key={langStat.language} className="flex items-center justify-between text-xs bg-slate-50/50 dark:bg-slate-800/20 p-2 rounded-xl">
                                        <span className="font-bold text-slate-700 dark:text-slate-250">{langStat.language} Team</span>
                                        <div className="flex items-center gap-3">
                                          <span className="text-slate-400 font-mono text-[10px]">({langStat.editorDays} days)</span>
                                          <span className="font-extrabold text-slate-800 dark:text-white">{langStat.efficiency.toFixed(1)} units/day</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Editors Speed Performance */}
                                <div>
                                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5 mb-2">
                                    <Users size={12} className="text-blue-500" />
                                    Individual Editor Speed
                                  </h4>
                                  <div className="max-h-40 overflow-y-auto custom-scrollbar border border-slate-150/80 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900/50">
                                    {data.editors.map(editor => (
                                      <div key={editor.name} className="flex items-center justify-between p-2.5 text-xs">
                                        <div>
                                          <div className="font-bold text-slate-800 dark:text-slate-200">{editor.name}</div>
                                          <div className="text-[10px] text-slate-400 dark:text-slate-500 flex items-center gap-1.5 flex-wrap">
                                            <span>{editor.language}</span>
                                            <span>•</span>
                                            <span>{editor.totalUnits} units</span>
                                            {editor.totalHours > 0 && (
                                              <>
                                                <span>•</span>
                                                <span className="text-amber-500 dark:text-amber-450 font-bold bg-amber-500/5 px-1 py-0.5 rounded text-[9px]">
                                                  Avg: {editor.avgHoursPerVideo >= 1 ? `${editor.avgHoursPerVideo.toFixed(1)}h` : `${Math.round(editor.avgHoursPerVideo * 60)}m`} / video
                                                </span>
                                              </>
                                            )}
                                          </div>
                                        </div>
                                        <div className="text-right">
                                          <span className="font-extrabold text-blue-650 dark:text-blue-400 font-mono">{editor.efficiency.toFixed(1)}</span>
                                          <span className="text-[9px] text-slate-400 block pb-0.5">units/day</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {/* Predictions Section */}
                                {data.predictions && data.predictions.length > 0 && (
                                  <div className="pt-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-[#F26C21] flex items-center gap-1.5 mb-2">
                                      <Clock size={12} className="text-orange-500 animate-pulse" />
                                      Active Batch Completion Estimations
                                    </h4>
                                    <div className="space-y-2">
                                      {data.predictions.map(pred => {
                                        const hoursRounded = Math.ceil(pred.predictedHoursToWrap);
                                        const daysRounded = Math.ceil(pred.daysToWrap);
                                        return (
                                          <div key={pred.batchId} className="bg-gradient-to-br from-orange-50/40 to-amber-50/20 dark:from-slate-850/50 dark:to-slate-805/10 border border-orange-100/30 dark:border-slate-805/80 p-3 rounded-2xl">
                                            <div className="flex justify-between items-center mb-1.5">
                                              <span className="font-semibold text-xs text-slate-800 dark:text-slate-200">{pred.batchName}</span>
                                              <span className="font-mono text-[9px] bg-white dark:bg-slate-900 border border-orange-100 dark:border-slate-800 px-1.5 py-0.5 rounded text-[#F26C21] font-bold shadow-sm">
                                                {pred.remainingVideos} pending
                                              </span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2 text-center text-xs">
                                              <div className="bg-white/80 dark:bg-slate-900 p-2 rounded-xl border border-slate-100/50 dark:border-slate-850 shadow-xs">
                                                <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">Total Hours</div>
                                                <div className="text-xs font-black text-slate-700 dark:text-slate-100 mt-0.5">
                                                  ~ {hoursRounded} {hoursRounded === 1 ? 'hr' : 'hrs'}
                                                </div>
                                                <div className="text-[8px] font-medium text-slate-450 mt-0.5 leading-none">
                                                  {pred.isUsingFallback ? 'rate: 1.2h' : `${data.brandAvgHoursPerVideo.toFixed(1)}h/video`}
                                                </div>
                                              </div>
                                              
                                              <div className="bg-white/80 dark:bg-slate-900 p-2 rounded-xl border border-slate-100/50 dark:border-slate-850 shadow-xs">
                                                <div className="text-[8px] font-black uppercase tracking-wider text-slate-400">Time to Wrap</div>
                                                <div className="text-xs font-black text-[#F26C21] mt-0.5">
                                                  ~ {daysRounded} {daysRounded === 1 ? 'day' : 'days'}
                                                </div>
                                                <div className="text-[8px] font-medium text-slate-450 mt-0.5 leading-none">
                                                  {data.avgEfficiency.toFixed(1)} videos/day
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                              </div>
                            )}

                          </div>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
