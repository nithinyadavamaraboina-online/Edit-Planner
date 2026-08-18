import React, { useState, useMemo } from 'react';
import { ProductionPlan, Worker, Workload, TaskAssignment, Batch } from '../types';
import { Trophy, Medal, Award, Calendar, ChevronDown, Crown, Info, X } from 'lucide-react';
import { Rank1Badge, getCompletedGenVal, getCompletedEditVal, calculateBrandWeights, getBrandWeight } from '../utils/ranking';

interface LeaderboardProps {
  plan: ProductionPlan;
  workers: Worker[];
  workload: Workload;
  currentLanguage: string;
  batches?: Batch[];
}

type TimeFrame = 'weekly' | 'monthly' | 'yearly' | 'all-time';

export const Leaderboard: React.FC<LeaderboardProps> = ({ plan, workers, workload, currentLanguage, batches }) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('monthly');
  const [showInfoModal, setShowInfoModal] = useState(false);
  const viewMode = 'global';

  const brandWeights = useMemo(() => {
    return calculateBrandWeights(plan, workload.startDate, batches);
  }, [plan, workload.startDate, batches]);

  const stats = useMemo(() => {
    const [sy, sm, sd] = workload.startDate.split('-').map(Number);
    const startDate = new Date(Date.UTC(sy, sm - 1, sd));

    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    
    // Calculate current week boundaries (Monday to Sunday)
    const currentDayOfWeek = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
    const startOfWeek = new Date(now);
    startOfWeek.setUTCDate(now.getUTCDate() - currentDayOfWeek + 1);
    startOfWeek.setUTCHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
    endOfWeek.setUTCHours(23, 59, 59, 999);

    // Calculate current month boundaries (1st of month to end of month)
    const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0, 23, 59, 59, 999));

    const workerStats: Record<string, { name: string; role: string; language: string; generations: number; edits: number; points: number }> = {};

    const filteredWorkers = workers;

    // Initialize stats for all workers
    filteredWorkers.forEach(w => {
      workerStats[w.id] = {
        name: w.name,
        role: w.role,
        language: w.language || 'Unknown',
        generations: 0,
        edits: 0,
        points: 0
      };
    });

    (plan.schedule || []).forEach(dayPlan => {
      // Calculate the date for this day
      const date = new Date(startDate);
      date.setUTCDate(date.getUTCDate() + (dayPlan.day - 1));
      
      // Leaderboard calculations start from June 22, 2026
      const LEADERBOARD_START_DATE = new Date(Date.UTC(2026, 5, 22)); // Month is 0-indexed (5 = June)
      if (date < LEADERBOARD_START_DATE) {
        return; // Skip days before the start date
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

      if (includeDay) {
        (dayPlan.assignments || []).forEach((assignment: TaskAssignment) => {
          // Only count if the worker is in our current filtered list
          if (workerStats[assignment.workerId]) {
            const batch = (batches || []).find(b => b.id === assignment.batchId);
            const brand = (batch?.clientName || 'Unassigned').trim();

            const gen = getCompletedGenVal(assignment, batches);
            const edit = getCompletedEditVal(assignment, batches);
            
            const points_ai = gen * getBrandWeight(brand, brandWeights, 'AI');
            const points_normal = edit * getBrandWeight(brand, brandWeights, 'Normal');

            workerStats[assignment.workerId].generations += gen;
            workerStats[assignment.workerId].edits += edit;
            // Accumulate decimal points
            workerStats[assignment.workerId].points += (points_ai + points_normal);
          }
        });
      }
    });

    // Convert to array and sort by points descending
    return Object.values(workerStats)
      .filter(stat => stat.role !== 'Manager' && (stat.role === 'Editor' || stat.role === 'Intern' || stat.role === 'TL' || stat.points > 0)) // Show all editors, interns, and TLs, or anyone with points, excluding managers.
      .sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        return a.name.localeCompare(b.name);
      });
  }, [plan, workers, workload.startDate, timeFrame, batches, brandWeights]);

  // Overall top 3 names to propagate gold, silver, award badges
  const { rank1Name, rank2Name, rank3Name } = useMemo(() => {
    return {
      rank1Name: stats[0]?.name || null,
      rank2Name: stats[1]?.name || null,
      rank3Name: stats[2]?.name || null,
    };
  }, [stats]);

  // Split into left (0-6) and right (7 onwards)
  const leftColumnStats = useMemo(() => {
    return stats.slice(0, 7).map((stat, idx) => ({ ...stat, originalIndex: idx }));
  }, [stats]);

  const rightColumnStats = useMemo(() => {
    return stats.slice(7).map((stat, idx) => ({ ...stat, originalIndex: idx + 7 }));
  }, [stats]);

  const renderTableColumn = (columnStats: typeof leftColumnStats, titleLabel: string) => {
    return (
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-full">
        <div className="bg-slate-50 dark:bg-slate-800/30 px-4 py-2 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black text-slate-500 uppercase tracking-widest">
          {titleLabel}
        </div>
        <div className="grid grid-cols-12 gap-2 p-3 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
          <div className="col-span-1 text-center">Rank</div>
          <div className="col-span-7 sm:col-span-5">Editor</div>
          <div className="hidden sm:block col-span-2 text-center">Language</div>
          <div className="col-span-1 text-center font-semibold">Gens</div>
          <div className="col-span-1 text-center font-semibold text-emerald-600 dark:text-emerald-400">Edits</div>
          <div className="col-span-2 text-center text-indigo-600 dark:text-indigo-400 font-bold">Total</div>
        </div>
        
        <div className="divide-y divide-slate-100 dark:divide-slate-800 flex-1">
          {columnStats.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400 italic">
              No editors in this list.
            </div>
          ) : (
            columnStats.map((stat) => {
              const index = stat.originalIndex;
              const isTop3 = index < 3;
              return (
                <div 
                  key={stat.name} 
                  className={`grid grid-cols-12 gap-2 px-3 py-2.5 items-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    index === 0 ? 'bg-amber-500/[0.04] dark:bg-amber-500/[0.03] border-l-4 border-amber-500 pl-2 shadow-[inset_1px_0_0_0_rgba(245,158,11,0.1)]' :
                    index === 1 ? 'bg-slate-500/[0.04] dark:bg-slate-500/[0.03] border-l-4 border-slate-400 pl-2 shadow-[inset_1px_0_0_0_rgba(148,163,184,0.1)]' :
                    index === 2 ? 'bg-orange-500/[0.04] dark:bg-orange-500/[0.03] border-l-4 border-orange-500 dark:border-orange-600 pl-2 shadow-[inset_1px_0_0_0_rgba(249,115,22,0.1)]' : ''
                  }`}
                >
                  <div className="col-span-1 flex justify-center">
                    {index === 0 ? (
                      <div className="w-5 h-5 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">1</div>
                    ) : index === 1 ? (
                      <div className="w-5 h-5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-350 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">2</div>
                    ) : index === 2 ? (
                      <div className="w-5 h-5 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center text-[10px] font-black shadow-sm">3</div>
                    ) : (
                      <div className="w-5 h-5 text-slate-400 dark:text-slate-500 flex items-center justify-center text-xs font-semibold">{index + 1}</div>
                    )}
                  </div>
                  
                  <div className="col-span-7 sm:col-span-5 flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0 ring-1 ring-slate-100 dark:ring-slate-800 ${
                      stat.role === 'Intern' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400' :
                      stat.role === 'Assist' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' :
                      stat.role === 'Manager' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' :
                      stat.role === 'TL' ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400' :
                      'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                    }`}>
                      {stat.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1 min-w-0">
                        <span className="truncate" title={stat.name}>{stat.name}</span>
                        <Rank1Badge workerName={stat.name} rank1Name={rank1Name} rank2Name={rank2Name} rank3Name={rank3Name} size={9} />
                      </div>
                    </div>
                  </div>

                  <div className="hidden sm:block col-span-2 text-center text-[10px] font-semibold text-slate-500 dark:text-slate-400 truncate uppercase tracking-wider">
                    {stat.language}
                  </div>
                  
                  <div className="col-span-1 flex justify-center">
                    <div className="px-1.5 py-0.2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded text-[10px] font-mono font-bold">
                      {stat.generations}
                    </div>
                  </div>
                  
                  <div className="col-span-1 flex justify-center">
                    <div className="px-1.5 py-0.2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded text-[10px] font-mono font-bold">
                      {stat.edits}
                    </div>
                  </div>
                  
                  <div className="col-span-2 flex justify-center">
                    <div className={`px-2 py-0.5 rounded font-black text-[10px] ${
                      isTop3 
                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {parseFloat(stat.points.toFixed(2))}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  const brandList = useMemo(() => {
    const brands = new Set<string>();
    (batches || []).forEach(b => {
      if (b.clientName) {
        brands.add(b.clientName.trim());
      }
    });
    // Add any brands we saw in weights as well
    Object.keys(brandWeights.weight_ai).forEach(b => brands.add(b));
    Object.keys(brandWeights.weight_normal).forEach(b => brands.add(b));
    return Array.from(brands).filter(b => b && b !== 'Unassigned');
  }, [batches, brandWeights]);

  const activeDateRangeText = useMemo(() => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    
    const formatDate = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

    if (timeFrame === 'weekly') {
      const currentDayOfWeek = now.getUTCDay() === 0 ? 7 : now.getUTCDay();
      const startOfWeek = new Date(now);
      startOfWeek.setUTCDate(now.getUTCDate() - currentDayOfWeek + 1);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setUTCDate(startOfWeek.getUTCDate() + 6);
      return `${formatDate(startOfWeek)} – ${formatDate(endOfWeek)}`;
    }
    
    if (timeFrame === 'monthly') {
      const startOfMonth = new Date(Date.UTC(currentYear, currentMonth, 1));
      const endOfMonth = new Date(Date.UTC(currentYear, currentMonth + 1, 0));
      return `${formatDate(startOfMonth)} – ${formatDate(endOfMonth)}`;
    }

    if (timeFrame === 'yearly') {
      const startOfYear = new Date(Date.UTC(currentYear, 0, 1));
      const endOfYear = new Date(Date.UTC(currentYear, 11, 31));
      return `${formatDate(startOfYear)} – ${formatDate(endOfYear)}`;
    }

    return `From Jun 22, 2026 onwards`;
  }, [timeFrame]);

  return (
    <div className="flex flex-col w-full space-y-4">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center">
              <Trophy className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-slate-800 dark:text-white">Best Editors</h2>
                <button 
                  onClick={() => setShowInfoModal(true)}
                  className="text-slate-450 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800/80 cursor-pointer flex items-center justify-center"
                  title="How points are calculated"
                >
                  <Info className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                <span>Calculation Period: <strong className="text-indigo-600 dark:text-indigo-400 font-bold">{activeDateRangeText}</strong></span>
              </div>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2.5 self-start sm:self-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl overflow-x-auto">
              {(['weekly', 'monthly', 'yearly', 'all-time'] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all whitespace-nowrap ${
                    timeFrame === tf 
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}
                >
                  {tf.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Split Screen Leaderboard List */}
        {stats.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No data available for this time frame.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {renderTableColumn(leftColumnStats, `Top 7 Editors (${leftColumnStats.length})`)}
            {renderTableColumn(rightColumnStats, `Remaining Editors (${rightColumnStats.length})`)}
          </div>
        )}

        {/* Point Weights Guide */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 mt-6">
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-indigo-500" />
            <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
              Brand Average Times & Point Values (8 Hrs = 8 Pts)
            </h3>
          </div>
          <p className="text-[11px] text-slate-500 dark:text-slate-450 mb-4 leading-relaxed">
            Points are calculated dynamically based on actual logged hours spent per video completed for each brand. 
            If an editor works on a brand's videos, their point reward per video is the brand's average completion time across all editors (1 hour of effort = 1 point). 
            If a brand has no logged data yet, it defaults to the global average.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {brandList.map(brand => {
              const aiWeight = getBrandWeight(brand, brandWeights, 'AI');
              const normalWeight = getBrandWeight(brand, brandWeights, 'Normal');
              return (
                <div key={brand} className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-150 dark:border-slate-800/80">
                  <div className="text-xs font-bold text-slate-800 dark:text-white truncate mb-1.5" title={brand}>
                    {brand}
                  </div>
                  <div className="space-y-1 text-[10px]">
                    <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                      <span>AI Video (Gen):</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                        {aiWeight.toFixed(2)} pts
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-slate-500 dark:text-slate-400">
                      <span>Normal Video (Edit):</span>
                      <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                        {normalWeight.toFixed(2)} pts
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30">
              <div className="text-xs font-bold text-indigo-800 dark:text-indigo-350 mb-1.5">
                Global Average (Fallback)
              </div>
              <div className="space-y-1 text-[10px]">
                <div className="flex justify-between items-center text-indigo-700/70 dark:text-indigo-400/70">
                  <span>AI Video (Gen):</span>
                  <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                    {brandWeights.global_avg_ai.toFixed(2)} pts
                  </span>
                </div>
                <div className="flex justify-between items-center text-indigo-700/70 dark:text-indigo-400/70">
                  <span>Normal Video (Edit):</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    {brandWeights.global_avg_normal.toFixed(2)} pts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Info Modal */}
        {showInfoModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/40 backdrop-blur-sm animate-fade-in" onClick={() => setShowInfoModal(false)}>
            <div 
              className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl max-w-lg w-full overflow-hidden animate-scale-up text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <Info className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                    Points Calculation Guide
                  </h3>
                </div>
                <button 
                  onClick={() => setShowInfoModal(false)}
                  className="text-slate-450 hover:text-slate-650 dark:hover:text-slate-300 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    Dynamic Brand Effort Weights
                  </h4>
                  <p>
                    Each brand has distinct average completion times for <span className="font-semibold text-indigo-600 dark:text-indigo-400">AI Videos (Gen)</span> and <span className="font-semibold text-emerald-600 dark:text-emerald-400">Normal Videos (Edit)</span>. 
                    These average times are dynamically calculated based on actual logged hours spent per video completed across all editors.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    8 Hours = 8 Points Baseline
                  </h4>
                  <p>
                    Point weight calculation follows the baseline: <span className="font-semibold">1 hour of average effort = 1 point</span>. 
                    Thus, standard workloads of 8 hours spent are valued at exactly 8 points.
                  </p>
                </div>

                <div className="p-3 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-150 dark:border-slate-800/50">
                  <span className="font-bold text-slate-700 dark:text-slate-200 block mb-1">Example Calculation:</span>
                  If a brand's normal edit video takes an average of <span className="font-semibold">1.5 hours</span>, it is worth <span className="font-semibold text-emerald-600 dark:text-emerald-400">1.5 points</span> per video. 
                  <br />
                  If an editor completes <span className="font-bold">4 videos</span> for that brand, they receive:
                  <div className="font-mono bg-white dark:bg-slate-900 px-2 py-1 rounded border border-slate-100 dark:border-slate-800 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 text-center mt-1">
                    4 videos × 1.5 pts = 6.00 points
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    No Maximum Points Cap
                  </h4>
                  <p>
                    Working extra videos is fully incentivized and recognized! If you exceed standard daily volumes, you continue to accumulate points proportionally with no upper limit. Extra efforts translate directly into higher points and higher positions on the leaderboard.
                  </p>
                </div>

                <div>
                  <h4 className="font-bold text-slate-800 dark:text-white mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>
                    Fallback Defaults
                  </h4>
                  <p>
                    If a brand has no logged hour data yet on or after the starting date of <span className="font-semibold">June 22, 2026</span>, it defaults to the global average of completed AI videos or normal edited videos.
                  </p>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex justify-end">
                <button
                  onClick={() => setShowInfoModal(false)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm hover:shadow"
                >
                  Got it
                </button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

