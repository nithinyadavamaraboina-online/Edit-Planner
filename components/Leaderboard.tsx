import React, { useState, useMemo } from 'react';
import { ProductionPlan, Worker, Workload, TaskAssignment } from '../types';
import { Trophy, Medal, Award, Calendar, ChevronDown } from 'lucide-react';

interface LeaderboardProps {
  plan: ProductionPlan;
  workers: Worker[];
  workload: Workload;
  currentLanguage: string;
}

type TimeFrame = 'weekly' | 'monthly' | 'yearly' | 'all-time';

export const Leaderboard: React.FC<LeaderboardProps> = ({ plan, workers, workload, currentLanguage }) => {
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('weekly');
  const [viewMode, setViewMode] = useState<'team' | 'global'>('team');

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

    const workerStats: Record<string, { name: string; role: string; language: string; generations: number; edits: number; points: number }> = {};

    const filteredWorkers = viewMode === 'team' ? workers.filter(w => w.language === currentLanguage) : workers;

    // Initialize stats for all workers in the current language
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
      
      // Leaderboard calculations start from March 14, 2026
      const LEADERBOARD_START_DATE = new Date(Date.UTC(2026, 2, 14)); // Month is 0-indexed (2 = March)
      if (date < LEADERBOARD_START_DATE) {
        return; // Skip days before the start date
      }
      
      let includeDay = false;
      
      switch (timeFrame) {
        case 'weekly':
          includeDay = date >= startOfWeek && date <= endOfWeek;
          break;
        case 'monthly':
          includeDay = date.getUTCFullYear() === currentYear && date.getUTCMonth() === currentMonth;
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
            const gen = assignment.generations || 0;
            const edit = assignment.edits || 0;
            
            workerStats[assignment.workerId].generations += gen;
            workerStats[assignment.workerId].edits += edit;
            // Scoring: 1 point per generation, 1 point per edit
            workerStats[assignment.workerId].points += gen + edit;
          }
        });
      }
    });

    // Convert to array and sort by points descending
    return Object.values(workerStats)
      .filter(stat => stat.role === 'Editor' || stat.role === 'Intern' || stat.points > 0) // Show all editors and interns, or anyone with points
      .sort((a, b) => b.points - a.points);
  }, [plan, workers, workload.startDate, timeFrame, viewMode, currentLanguage]);

  return (
    <div className="flex flex-col w-full space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/50 rounded-xl flex items-center justify-center">
              <Trophy className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-slate-800 dark:text-white">Team Leaderboard</h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                {viewMode === 'team' ? `${currentLanguage} Team Performance` : 'Global Team Performance'}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 self-start sm:self-auto">
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setViewMode('team')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  viewMode === 'team' 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                {currentLanguage} Team
              </button>
              <button
                onClick={() => setViewMode('global')}
                className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                  viewMode === 'global' 
                    ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
              >
                All Members
              </button>
            </div>

            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              {(['weekly', 'monthly', 'yearly', 'all-time'] as TimeFrame[]).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeFrame(tf)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${
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

        {/* Leaderboard List */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
            <div className="col-span-1 text-center">Rank</div>
            <div className="col-span-5">Member</div>
            <div className="col-span-2 text-center">Generations</div>
            <div className="col-span-2 text-center">Edits</div>
            <div className="col-span-2 text-center">Total Score</div>
          </div>
          
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {stats.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                No data available for this time frame.
              </div>
            ) : (
              stats.map((stat, index) => {
                const isTop3 = index < 3;
                return (
                  <div 
                    key={stat.name} 
                    className={`grid grid-cols-12 gap-4 p-4 items-center transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                      index === 0 ? 'bg-amber-50/30 dark:bg-amber-900/10' : ''
                    }`}
                  >
                    <div className="col-span-1 flex justify-center">
                      {index === 0 ? (
                        <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 rounded-full flex items-center justify-center font-black shadow-sm">1</div>
                      ) : index === 1 ? (
                        <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full flex items-center justify-center font-black shadow-sm">2</div>
                      ) : index === 2 ? (
                        <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center font-black shadow-sm">3</div>
                      ) : (
                        <div className="w-8 h-8 text-slate-400 dark:text-slate-500 flex items-center justify-center font-bold">{index + 1}</div>
                      )}
                    </div>
                    
                    <div className="col-span-5 flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                        stat.role === 'Intern' ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400' :
                        stat.role === 'Assist' ? 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400' :
                        stat.role === 'Manager' ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' :
                        stat.role === 'TL' ? 'bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400' :
                        'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400'
                      }`}>
                        {stat.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                          {stat.name}
                          {viewMode === 'global' && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                              {stat.language}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{stat.role}</div>
                      </div>
                    </div>
                    
                    <div className="col-span-2 flex justify-center">
                      <div className="px-3 py-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg font-mono font-medium text-sm">
                        {stat.generations}
                      </div>
                    </div>
                    
                    <div className="col-span-2 flex justify-center">
                      <div className="px-3 py-1 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-lg font-mono font-medium text-sm">
                        {stat.edits}
                      </div>
                    </div>
                    
                    <div className="col-span-2 flex justify-center">
                      <div className={`px-4 py-1.5 rounded-xl font-black text-sm ${
                        isTop3 
                          ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' 
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                      }`}>
                        {stat.points}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
    </div>
  );
};
