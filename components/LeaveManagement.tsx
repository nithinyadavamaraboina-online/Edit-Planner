import React, { useState } from 'react';
import { Worker, Leave } from '../types';
import { Calendar, Plus, X, AlertTriangle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface LeaveManagementProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  languages: string[];
  currentLanguage: string;
  onUpdate: (updatedWorkers: Worker[]) => void;
  readOnly?: boolean;
}

const LeaveManagement: React.FC<LeaveManagementProps> = ({ 
    workers, 
    setWorkers, 
    languages, 
    currentLanguage,
    onUpdate,
    readOnly = false
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
                  const duration = leave.duration || 1;
                  const leaveDate = new Date(leave.date);
                  if (leaveDate.getFullYear() === y && leaveDate.getMonth() === m) {
                      let newType: 'casual' | 'paid' | 'unpaid' = 'unpaid';
                      if (currentCL >= duration) {
                          newType = 'casual';
                          currentCL -= duration;
                      } else if (currentPL >= duration) {
                          newType = 'paid';
                          currentPL -= duration;
                      } else if (currentCL > 0) {
                          // Partial CL then partial unpaid or something complex
                          // For simplicity, if they have some CL but not enough, we just use what's there?
                          // The requirement says deduclt 0.5. 
                          // Let's just do strict: if enough CL, use CL. Else if enough PL, use PL. Else unpaid.
                          newType = 'unpaid';
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
      if (readOnly) return;
      const worker = workers.find(w => w.id === workerId);
      if (!worker) return;

      const dateStr = prompt(`Enter date for leave (YYYY-MM-DD):`, `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);
      if (!dateStr) return;

      const fullOrHalf = confirm(`Is this a Full Day leave? (OK for Full Day, Cancel for Half Day)`) ? 1 : 0.5;

      const newLeave: Leave = {
          id: Math.random().toString(36).substr(2, 9),
          workerId,
          date: dateStr,
          duration: fullOrHalf,
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
      if (readOnly) return;
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

    const [downloadLinkData, setDownloadLinkData] = useState<{url: string, filename: string} | null>(null);

    const downloadLeaveData = () => {
        const teams = Array.from(new Set(workers.map(w => w.language || 'Telugu'))) as string[];
        const wb = XLSX.utils.book_new();

        teams.forEach(team => {
            const teamWorkers = workers.filter(w => (w.language || 'Telugu') === team);
            
            const data = teamWorkers.map(worker => {
                const { recalibratedLeaves, availableCL, availablePL } = recalibrateLeaves(worker, currentYear, currentMonth);
                
                const casualLeaves = getLeavesForMonth(recalibratedLeaves, 'casual');
                const paidLeaves = getLeavesForMonth(recalibratedLeaves, 'paid');
                const unpaidLeaves = getLeavesForMonth(recalibratedLeaves, 'unpaid');

                return {
                    'Name': worker.name,
                    'Role': worker.role,
                    'Total Leaves Available': availableCL + availablePL,
                    'CL Available': availableCL,
                    'PL Available': availablePL,
                    'Casual Leaves Taken': casualLeaves.map(l => l.date).join(', '),
                    'Paid Leaves Taken': paidLeaves.map(l => l.date).join(', '),
                    'Unpaid Leaves Taken': unpaidLeaves.map(l => l.date).join(', '),
                    'Total Leaves Taken This Month': casualLeaves.length + paidLeaves.length + unpaidLeaves.length
                };
            });

            const ws = XLSX.utils.json_to_sheet(data);
            
            // Auto-size columns
            const colWidths = [
                { wch: 20 }, // Name
                { wch: 15 }, // Role
                { wch: 20 }, // Total Leaves Available
                { wch: 15 }, // CL Available
                { wch: 15 }, // PL Available
                { wch: 30 }, // Casual Leaves Taken
                { wch: 30 }, // Paid Leaves Taken
                { wch: 30 }, // Unpaid Leaves Taken
                { wch: 25 }  // Total Leaves Taken This Month
            ];
            ws['!cols'] = colWidths;

            XLSX.utils.book_append_sheet(wb, ws, team);
        });

        const monthName = new Date(0, currentMonth).toLocaleString('default', { month: 'long' });
        const fileName = `Leave_Data_${monthName}_${currentYear}.xlsx`;
        
        try {
            // Generate Excel file as a binary string
            const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            
            // Create a Blob from the buffer
            const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            // Create a download link and trigger it
            const url = window.URL.createObjectURL(data);
            
            setDownloadLinkData({ url, filename: fileName });
            
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', fileName);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
        } catch (e) {
            console.error("Download failed", e);
        }
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
              </div>
              
              {downloadLinkData && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-xl max-w-sm w-full">
                          <div className="flex items-center gap-3 mb-4 text-emerald-600">
                              <Download size={24} />
                              <h3 className="font-bold text-lg">Ready to Download</h3>
                          </div>
                          <p className="text-slate-600 dark:text-slate-300 mb-6 text-sm">
                              If the download didn't start automatically, please click the button below. If that still doesn't work, right-click the button and select "Save Link As...".
                          </p>
                          <div className="flex flex-col gap-3">
                              <a 
                                  href={downloadLinkData.url}
                                  download={downloadLinkData.filename}
                                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 text-center"
                              >
                                  Download Excel File
                              </a>
                              <button 
                                  onClick={() => setDownloadLinkData(null)} 
                                  className="px-4 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-sm"
                              >
                                  Close
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              <div className="flex items-center gap-4">
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
                      onClick={downloadLeaveData}
                      className="flex items-center gap-1.5 text-xs bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-3 py-1.5 rounded-lg font-bold transition-colors"
                  >
                      <Download size={14} />
                      Download Excel
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
                                              <div key={l.id} className="group relative px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={`Casual Leave: ${l.date} ${l.duration === 0.5 ? '(Half Day)' : ''}`}>
                                                  {new Date(l.date).getDate()}{l.duration === 0.5 ? ' (H)' : ''}
                                                  {!readOnly && <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-teal-800 dark:text-teal-200 hover:text-red-500"><X size={10} /></button>}
                                              </div>
                                          ))}
                                          {paidLeaves.map(l => (
                                              <div key={l.id} className="group relative px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={`Paid Leave: ${l.date} ${l.duration === 0.5 ? '(Half Day)' : ''}`}>
                                                  {new Date(l.date).getDate()}{l.duration === 0.5 ? ' (H)' : ''}
                                                  {!readOnly && <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-emerald-800 dark:text-emerald-200 hover:text-red-500"><X size={10} /></button>}
                                              </div>
                                          ))}
                                      </div>
                                  </td>

                                  {/* LOP */}
                                  <td className="p-4 align-top">
                                      <div className="flex flex-wrap gap-2">
                                          {unpaidLeaves.map(l => (
                                              <div key={l.id} className="group relative px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={`LOP: ${l.date} ${l.duration === 0.5 ? '(Half Day)' : ''}`}>
                                                  {new Date(l.date).getDate()}{l.duration === 0.5 ? ' (H)' : ''}
                                                  {!readOnly && <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-red-800 dark:text-red-200 hover:text-red-500"><X size={10} /></button>}
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
