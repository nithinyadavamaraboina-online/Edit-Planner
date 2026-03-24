import React, { useState } from 'react';
import { Worker, Leave } from '../types';
import { Calendar, Plus, X, AlertTriangle } from 'lucide-react';

interface LeaveManagementProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  languages: string[];
  currentLanguage: string;
  onUpdate: (updatedWorkers: Worker[]) => void;
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ 
    workers, 
    setWorkers, 
    languages, 
    currentLanguage,
    onUpdate 
}) => {
  const [selectedLanguage, setSelectedLanguage] = useState('All Members');
  const [viewDate, setViewDate] = useState(new Date());
  const [confirmAction, setConfirmAction] = useState<{ message: string, onConfirm: () => void } | null>(null);

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const filteredWorkers = selectedLanguage === 'All Members' 
      ? workers 
      : workers.filter(w => (w.language || 'Telugu') === selectedLanguage);

  const recalibrateLeaves = (worker: Worker, viewYear: number, viewMonth: number) => {
      const joiningDateStr = worker.joiningDate || '2026-02-01';
      const joiningDate = new Date(joiningDateStr);
      const realNow = new Date();
      
      // Filter out leaves before joining date and sort chronologically
      const validLeaves = (worker.leaves || [])
          .filter(l => new Date(l.date) >= joiningDate)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      let currentCL = 0;
      let currentPL = 0;
      
      const joiningYear = joiningDate.getFullYear();
      const joiningMonth = joiningDate.getMonth();
      const joiningDay = joiningDate.getDate();
      const daysInJoiningMonth = new Date(joiningYear, joiningMonth + 1, 0).getDate();
      
      let balanceAtViewDate = { CL: 0, PL: 0 };
      
      let endYear = realNow.getFullYear();
      let endMonth = realNow.getMonth();
      
      if (viewYear > endYear || (viewYear === endYear && viewMonth > endMonth)) {
          endYear = viewYear;
          endMonth = viewMonth;
      }
      
      if (validLeaves.length > 0) {
          const lastLeave = new Date(validLeaves[validLeaves.length - 1].date);
          if (lastLeave.getFullYear() > endYear || (lastLeave.getFullYear() === endYear && lastLeave.getMonth() > endMonth)) {
              endYear = lastLeave.getFullYear();
              endMonth = lastLeave.getMonth();
          }
      }

      const recalibratedLeaves: Leave[] = [];
      let leaveIndex = 0;

      for (let y = joiningYear; y <= endYear; y++) {
          const startM = (y === joiningYear) ? joiningMonth : 0;
          const endM = (y === endYear) ? endMonth : 11;
          
          for (let m = startM; m <= endM; m++) {
              const isPastOrCurrentMonth = y < realNow.getFullYear() || (y === realNow.getFullYear() && m <= realNow.getMonth());
              
              if (isPastOrCurrentMonth) {
                  if (y === joiningYear && m === joiningMonth) {
                      if (joiningDay <= 10) currentCL += 1;
                      if (joiningDay <= (daysInJoiningMonth - 7)) currentPL += 1;
                  } else {
                      currentCL += 1;
                      currentPL += 1;
                  }
              }
              
              while (leaveIndex < validLeaves.length) {
                  const leave = validLeaves[leaveIndex];
                  const leaveDate = new Date(leave.date);
                  if (leaveDate.getFullYear() === y && leaveDate.getMonth() === m) {
                      let newType: 'casual' | 'paid' | 'unpaid' = 'unpaid';
                      if (currentCL > 0) {
                          newType = 'casual';
                          currentCL--;
                      } else if (currentPL > 0) {
                          newType = 'paid';
                          currentPL--;
                      }
                      recalibratedLeaves.push({ ...leave, type: newType });
                      leaveIndex++;
                  } else {
                      break; 
                  }
              }
              
              if (y === viewYear && m === viewMonth) {
                  balanceAtViewDate = { CL: currentCL, PL: currentPL };
              }
          }
      }
      
      if (viewYear < joiningYear || (viewYear === joiningYear && viewMonth < joiningMonth)) {
          balanceAtViewDate = { CL: 0, PL: 0 };
      }

      return {
          recalibratedLeaves,
          availableCL: balanceAtViewDate.CL,
          availablePL: balanceAtViewDate.PL
      };
  };

  const addLeave = (workerId: string) => {
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const dateStr = prompt(`Enter date for leave (YYYY-MM-DD):`, `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);
      if (!dateStr) return;

      const newLeave: Leave = {
          id: Math.random().toString(36).substr(2, 9),
          workerId,
          date: dateStr,
          type: 'paid' // Generic type, will be recalibrated
      };

      const tempWorker = { ...worker, leaves: [...(worker.leaves || []), newLeave] };
      const { recalibratedLeaves } = recalibrateLeaves(tempWorker, currentYear, currentMonth);

      const updatedWorkers = workers.map(w => {
          if (w.id === workerId) {
              return { ...w, leaves: recalibratedLeaves };
          }
          return w;
      });

      setWorkers(updatedWorkers);
      onUpdate(updatedWorkers);
  };

  const removeLeave = (workerId: string, leaveId: string) => {
      setConfirmAction({
          message: "Are you sure you want to remove this leave?",
          onConfirm: () => {
              const worker = workers.find(w => w.id === workerId);
              if (!worker) return;

              const tempWorker = { ...worker, leaves: (worker.leaves || []).filter(l => l.id !== leaveId) };
              const { recalibratedLeaves } = recalibrateLeaves(tempWorker, currentYear, currentMonth);

              const updatedWorkers = workers.map(w => {
                  if (w.id === workerId) {
                      return { ...w, leaves: recalibratedLeaves };
                  }
                  return w;
              });

              setWorkers(updatedWorkers);
              onUpdate(updatedWorkers);
              setConfirmAction(null);
          }
      });
  };

  const getLeavesForMonth = (leaves: Leave[], type: 'paid' | 'casual' | 'unpaid') => {
      return leaves.filter(l => {
          // Parse YYYY-MM-DD manually to avoid timezone issues
          const [y, m, d] = l.date.split('-').map(Number);
          const matchesDate = (m - 1) === currentMonth && y === currentYear;
          return matchesDate && l.type === type;
      });
  };

    const applyInitialLeaves = () => {
        setConfirmAction({
            message: "This will replace all 2025/2026 leaves with the initial data. Continue?",
            onConfirm: () => {
                const initialLeavesData = [
                    { name: 'nithin', date: '2025-08-01' },
                    { name: 'nithin', date: '2025-08-29' },
                    { name: 'nithin', date: '2025-09-15' },
                    { name: 'nithin', date: '2025-09-16' },
                    { name: 'nithin', date: '2026-01-27' },
                    { name: 'leena', date: '2026-02-04' },
                    { name: 'leena', date: '2026-02-05' },
                    { name: 'kishan', date: '2026-02-07' },
                    { name: 'intiyaz', date: '2026-02-07' },
                    { name: 'neha', date: '2026-02-11' },
                    { name: 'yashwanth', date: '2026-02-14' },
                    { name: 'intiyaz', date: '2026-02-23' },
                    { name: 'neha', date: '2026-02-26' },
                    { name: 'kishan', date: '2026-02-28' },
                    { name: 'yashwanth', date: '2026-02-28' },
                    { name: 'khadayottan', date: '2026-02-26' },
                    { name: 'khadayottan', date: '2026-02-27' },
                    { name: 'monisha', date: '2026-02-28' },
                    { name: 'aswathi', date: '2026-02-23' },
                    { name: 'aswathi', date: '2026-02-24' },
                    { name: 'monisha', date: '2026-03-05' },
                    { name: 'monisha', date: '2026-03-09' },
                    { name: 'monisha', date: '2026-03-10', type: 'unpaid' },
                    { name: 'leena', date: '2026-03-10' },
                    { name: 'monisha', date: '2026-03-11', type: 'unpaid' },
                    { name: 'monisha', date: '2026-03-12', type: 'unpaid' },
                    { name: 'monisha', date: '2026-03-13', type: 'unpaid' },
                    { name: 'monisha', date: '2026-03-14', type: 'unpaid' },
                    { name: 'kabilan', date: '2026-03-07' },
                    { name: 'kabilan', date: '2026-03-09' },
                    { name: 'kabilan', date: '2026-03-10' },
                    { name: 'bala', date: '2025-10-03' },
                    { name: 'kabilan', date: '2025-12-15' },
                    { name: 'khadayottan', date: '2026-01-12' },
                    { name: 'khadayottan', date: '2026-01-13' },
                    { name: 'khadayottan', date: '2026-01-14' },
                    { name: 'khadayottan', date: '2026-01-15', type: 'unpaid' },
                    { name: 'khadayottan', date: '2026-01-16', type: 'unpaid' },
                    { name: 'khadayottan', date: '2026-01-17', type: 'unpaid' },
                    { name: 'neha', date: '2026-02-11' },
                ];

                const updatedWorkers = workers.map(w => {
                    // Remove all 2025 and 2026 leaves
                    const otherLeaves = (w.leaves || []).filter(l => !l.date.startsWith('2026-') && !l.date.startsWith('2025-'));
                    
                    // Find leaves for this worker
                    const workerInitialLeaves = initialLeavesData
                        .filter(l => l.name.toLowerCase() === w.name.toLowerCase())
                        .map(l => ({
                            id: Math.random().toString(36).substr(2, 9),
                            workerId: w.id,
                            date: l.date,
                            type: (l as any).type || 'paid' as const
                        }));

                    const tempWorker = {
                        ...w,
                        leaves: [...otherLeaves, ...workerInitialLeaves]
                    };
                    
                    // Recalibrate ALL leaves in one go
                    const { recalibratedLeaves } = recalibrateLeaves(tempWorker, currentYear, currentMonth);

                    return {
                        ...tempWorker,
                        leaves: recalibratedLeaves
                    };
                });

                setWorkers(updatedWorkers);
                onUpdate(updatedWorkers);
                setConfirmAction(null);
            }
        });
    };

  return (
      <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 h-full w-full flex flex-col">
          {confirmAction && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl max-w-sm w-full">
                      <div className="flex items-center gap-3 mb-4 text-amber-600">
                          <AlertTriangle size={24} />
                          <h3 className="font-bold text-lg">Confirm Action</h3>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300 mb-6">{confirmAction.message}</p>
                      <div className="flex justify-end gap-3">
                          <button onClick={() => setConfirmAction(null)} className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm">Cancel</button>
                          <button onClick={confirmAction.onConfirm} className="px-4 py-2 rounded-lg bg-red-600 text-white font-bold text-sm hover:bg-red-700">Confirm</button>
                      </div>
                  </div>
              </div>
          )}
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Calendar className="text-[#F26C21]" /> Leave Management
                  </h2>
                  
                  <div className="flex bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
                      <button 
                          onClick={() => setSelectedLanguage('All Members')}
                          className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${selectedLanguage === 'All Members' ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                      >
                          All Members
                      </button>
                      {languages.map(lang => (
                          <button 
                              key={lang}
                              onClick={() => setSelectedLanguage(lang)}
                              className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${selectedLanguage === lang ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}`}
                          >
                              {lang}
                          </button>
                      ))}
                  </div>
                  
                  <button 
                      onClick={applyInitialLeaves}
                      className="text-xs bg-orange-100 text-orange-700 hover:bg-orange-200 px-3 py-1.5 rounded-lg font-bold transition-colors"
                  >
                      Apply Initial 2026 Leaves
                  </button>
                  <button 
                      onClick={() => {
                          const updatedWorkers = workers.map(w => {
                              const { recalibratedLeaves } = recalibrateLeaves(w, currentYear, currentMonth);
                              return { ...w, leaves: recalibratedLeaves };
                          });
                          setWorkers(updatedWorkers);
                          onUpdate(updatedWorkers);
                          alert("All leave data has been recalibrated.");
                      }}
                      className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-200 px-3 py-1.5 rounded-lg font-bold transition-colors"
                  >
                      Recalibrate All Leaves
                  </button>
              </div>

              <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1.5 rounded-xl">
                  <select 
                      value={currentMonth} 
                      onChange={(e) => {
                          const newDate = new Date(viewDate);
                          newDate.setMonth(parseInt(e.target.value));
                          setViewDate(newDate);
                      }}
                      className="bg-transparent font-bold text-slate-700 dark:text-slate-200 py-1 px-2 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21]"
                  >
                      {Array.from({ length: 12 }, (_, i) => (
                          <option key={i} value={i}>{new Date(0, i).toLocaleString('default', { month: 'long' })}</option>
                      ))}
                  </select>
                  
                  <select 
                      value={currentYear} 
                      onChange={(e) => {
                          const newDate = new Date(viewDate);
                          newDate.setFullYear(parseInt(e.target.value));
                          setViewDate(newDate);
                      }}
                      className="bg-transparent font-bold text-slate-700 dark:text-slate-200 py-1 px-2 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21]"
                  >
                      {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map(year => (
                          <option key={year} value={year}>{year}</option>
                      ))}
                  </select>
              </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="w-1/5 p-4 font-black text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Editor Name</th>
                          <th className="w-1/5 p-4 font-black text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Leave Balance</th>
                          <th className="w-1/5 p-4 font-black text-emerald-600 dark:text-emerald-400 uppercase text-xs tracking-wider">Approved Leaves (This Month)</th>
                          <th className="w-1/5 p-4 font-black text-red-600 dark:text-red-400 uppercase text-xs tracking-wider">LOP (Unpaid)</th>
                          <th className="w-1/5 p-4 font-black text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider text-right">Actions</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredWorkers.map(worker => {
                          const { recalibratedLeaves, availableCL, availablePL } = recalibrateLeaves(worker, currentYear, currentMonth);
                          
                          const casualLeaves = getLeavesForMonth(recalibratedLeaves, 'casual');
                          const paidLeaves = getLeavesForMonth(recalibratedLeaves, 'paid');
                          const unpaidLeaves = getLeavesForMonth(recalibratedLeaves, 'unpaid');

                          return (
                              <tr key={worker.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="p-4">
                                      <div className="font-bold text-slate-800 dark:text-slate-200">{worker.name}</div>
                                      <div className="text-xs text-slate-400 font-bold uppercase">{worker.role}</div>
                                  </td>
                                  
                                  {/* Leave Balance */}
                                  <td className="p-4 align-middle">
                                      <div className="flex flex-col gap-1">
                                          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Total: {availableCL + availablePL}</span>
                                          <span className="text-[10px] text-slate-500">CL: {availableCL} | PL: {availablePL}</span>
                                      </div>
                                  </td>

                                  {/* Approved Leaves */}
                                  <td className="p-4 align-top">
                                      <div className="flex flex-wrap gap-2">
                                          {casualLeaves.map(l => (
                                              <div key={l.id} className="group relative px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={`Casual Leave: ${l.date}`}>
                                                  {new Date(l.date).getDate()}
                                                  <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-teal-800 dark:text-teal-200 hover:text-red-500"><X size={10} /></button>
                                              </div>
                                          ))}
                                          {paidLeaves.map(l => (
                                              <div key={l.id} className="group relative px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={`Paid Leave: ${l.date}`}>
                                                  {new Date(l.date).getDate()}
                                                  <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-emerald-800 dark:text-emerald-200 hover:text-red-500"><X size={10} /></button>
                                              </div>
                                          ))}
                                      </div>
                                  </td>

                                  {/* LOP */}
                                  <td className="p-4 align-top">
                                      <div className="flex flex-wrap gap-2">
                                          {unpaidLeaves.map(l => (
                                              <div key={l.id} className="group relative px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={`LOP: ${l.date}`}>
                                                  {new Date(l.date).getDate()}
                                                  <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-red-800 dark:text-red-200 hover:text-red-500"><X size={10} /></button>
                                              </div>
                                          ))}
                                      </div>
                                  </td>
                                  
                                  {/* Actions */}
                                  <td className="p-4 align-middle text-right">
                                      <button 
                                          onClick={() => addLeave(worker.id)}
                                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold transition-colors"
                                      >
                                          <Plus size={14} /> Record Leave
                                      </button>
                                  </td>
                              </tr>
                          );
                      })}
                  </tbody>
              </table>
          </div>
      </div>
  );
};

export default LeaveManagement;
