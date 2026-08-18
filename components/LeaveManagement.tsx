import React, { useState } from 'react';
import { Worker, Leave } from '../types';
import { Calendar, Plus, X, AlertTriangle, Download, RefreshCw, Upload, History } from 'lucide-react';
import * as XLSX from 'xlsx';

interface LeaveManagementProps {
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  languages: string[];
  currentLanguage: string;
  onUpdate: (updatedWorkers: Worker[]) => void;
  readOnly?: boolean;
}

const INITIAL_LEAVE_BALANCES: Record<string, number> = {
  'nithin': 25,
  'bhavana': 6,
  'yaswanth': 0,
  'kishan': 9.5,
  'om': 4,
  'monisha': 0,
  'saiga': 7,
  'anandhu': 6,
  'akhil': 2,
  'aswathi': 0,
  'bala': 19,
  'gokulavani': 6,
  'ganga': 0.5
};

const getInitialTillJuneBalance = (nameStr: string): number => {
  const norm = nameStr.toLowerCase();
  for (const [key, val] of Object.entries(INITIAL_LEAVE_BALANCES)) {
      if (norm.includes(key)) {
          return val;
      }
  }
  return 0;
};

const getInitialSplit = (name: string, joiningDateStr: string) => {
  if (name.toLowerCase().includes('gokulavani')) {
      return { CL: 1, PL: 5, isAfterJune: false };
  }

  const initBalance = getInitialTillJuneBalance(name);
  const joiningDate = new Date(joiningDateStr);
  const joiningYear = joiningDate.getFullYear();
  const joiningMonth = joiningDate.getMonth();
  const joiningDay = joiningDate.getDate();

  // If they joined after June 2026, they start with 0 CL, 0 PL
  if (joiningYear > 2026 || (joiningYear === 2026 && joiningMonth > 5)) {
      return { CL: 0, PL: 0, isAfterJune: true };
  }

  // Calculate earned CL and PL from joining date up to June 2026
  let earnedCL = 0;
  let earnedPL = 0;
  let y = joiningYear;
  let m = joiningMonth;

  while (y < 2026 || (y === 2026 && m <= 5)) {
      if (y === joiningYear && m === joiningMonth) {
          if (joiningDay <= 7) {
              earnedCL += 1;
              earnedPL += 1;
          } else if (joiningDay <= 20) {
              earnedPL += 1;
          }
      } else {
          earnedCL += 1;
          earnedPL += 1;
      }
      m++;
      if (m > 11) {
          m = 0;
          y++;
      }
  }

  const totalEarned = earnedCL + earnedPL;
  if (totalEarned <= 0) {
      const cl = Math.floor(initBalance / 2);
      return { CL: cl, PL: initBalance - cl, isAfterJune: false };
  }

  const usedLeaves = totalEarned - initBalance;
  
  let initialCL = earnedCL;
  let initialPL = earnedPL;

  if (usedLeaves > 0) {
      if (usedLeaves <= initialCL) {
          initialCL -= usedLeaves;
      } else {
          initialPL -= (usedLeaves - initialCL);
          initialCL = 0;
      }
  } else if (usedLeaves < 0) {
      initialPL += Math.abs(usedLeaves);
  }

  return { CL: initialCL, PL: initialPL, isAfterJune: false };
};

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
      const joiningYear = joiningDate.getFullYear();
      const joiningMonth = joiningDate.getMonth(); // 0-indexed
      const joiningDay = joiningDate.getDate();

      // Sort leaves chronologically
      const allLeaves = (worker.leaves || []).slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Determine starting date for step-by-step calculations
      const { CL, PL, isAfterJune } = getInitialSplit(worker.name, joiningDateStr);

      let currentCL = CL;
      let currentPL = PL;

      let startYear = 2026;
      let startMonth = 6; // July (0-indexed 6)

      if (isAfterJune) {
          startYear = joiningYear;
          startMonth = joiningMonth;
      }

      let endYear = viewYear;
      let endMonth = viewMonth;

      const realNow = new Date();
      if (realNow.getFullYear() > endYear || (realNow.getFullYear() === endYear && realNow.getMonth() > endMonth)) {
          endYear = realNow.getFullYear();
          endMonth = realNow.getMonth();
      }

      if (allLeaves.length > 0) {
          const lastLeaveDate = new Date(allLeaves[allLeaves.length - 1].date);
          if (lastLeaveDate.getFullYear() > endYear || (lastLeaveDate.getFullYear() === endYear && lastLeaveDate.getMonth() > endMonth)) {
              endYear = lastLeaveDate.getFullYear();
              endMonth = lastLeaveDate.getMonth();
          }
      }

      const recalibratedLeaves: Leave[] = [];
      let balanceAtViewDate = { CL: 0, PL: 0 };

      let y = startYear;
      let m = startMonth;

      while (y < endYear || (y === endYear && m <= endMonth)) {
          // 1. Earn leaves for this month
          if (y === joiningYear && m === joiningMonth && isAfterJune) {
              if (joiningDay <= 7) {
                  currentCL += 1;
                  currentPL += 1;
              } else if (joiningDay <= 20) {
                  currentPL += 1;
              }
          } else {
              currentCL += 1;
              currentPL += 1;
          }

          // 2. Process and deplete leaves in this month
          const thresholdDateStr = isAfterJune ? joiningDateStr : "2026-07-01";
          const monthLeaves = allLeaves.filter(l => {
              const [ly, lm] = l.date.split('-').map(Number);
              return ly === y && (lm - 1) === m && l.date >= thresholdDateStr;
          });

          for (const leave of monthLeaves) {
              let duration = leave.duration || 1;
              let finalType: 'casual' | 'paid' | 'unpaid' = 'unpaid';

              // Deplete casual first, then paid
              if (currentCL >= duration) {
                  currentCL -= duration;
                  finalType = 'casual';
              } else if (currentPL >= duration) {
                  currentPL -= duration;
                  finalType = 'paid';
              } else {
                  if (currentCL > 0) {
                      duration -= currentCL;
                      currentCL = 0;
                  }
                  if (currentPL >= duration) {
                      currentPL -= duration;
                      finalType = 'paid';
                  } else {
                      if (currentPL > 0) {
                          duration -= currentPL;
                          currentPL = 0;
                      }
                      finalType = 'unpaid';
                  }
              }

              recalibratedLeaves.push({
                  ...leave,
                  type: finalType
              });
          }

          if (y === viewYear && m === viewMonth) {
              balanceAtViewDate = { CL: currentCL, PL: currentPL };
          }

          m++;
          if (m > 11) {
              m = 0;
              y++;
          }
      }

      if (viewYear < startYear || (viewYear === startYear && viewMonth < startMonth)) {
          balanceAtViewDate = { CL: CL, PL: PL };
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

  const [isCheckpointsOpen, setIsCheckpointsOpen] = useState(false);
  const [importedStatus, setImportedStatus] = useState<string | null>(null);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (evt) => {
          try {
              const fileData = evt.target?.result;
              const workbook = XLSX.read(fileData, { type: 'binary' });

              // Let's gather all leaves from all sheets (sheets correspond to teams/languages)
              let totalLeavesCount = 0;
              let workersMatchedCount = 0;

              const updatedWorkers = workers.map(worker => {
                  return { ...worker, leaves: [...(worker.leaves || [])] };
              });

              workbook.SheetNames.forEach(sheetName => {
                  const sheet = workbook.Sheets[sheetName];
                  const rows = XLSX.utils.sheet_to_json<any>(sheet);

                  rows.forEach(row => {
                      const name = row['Name'] || row['name'];
                      if (!name) return;

                      const lowerName = name.toLowerCase().trim();
                      const targetWorkerIndex = updatedWorkers.findIndex(w => w.name.toLowerCase().trim() === lowerName || w.name.toLowerCase().includes(lowerName) || lowerName.includes(w.name.toLowerCase()));
                      
                      if (targetWorkerIndex !== -1) {
                          workersMatchedCount++;
                          const w = updatedWorkers[targetWorkerIndex];
                          const workerLeaves: Leave[] = [];
                          
                          const parseLeavesString = (str: string, type: 'casual' | 'paid' | 'unpaid') => {
                              if (!str) return;
                              // Split by comma
                              const dates = str.split(',').map(d => d.trim()).filter(Boolean);
                              dates.forEach(dateStr => {
                                  // Validate ISO or try to parse
                                  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
                                      workerLeaves.push({
                                          id: `${w.id}_${dateStr}_${type}`,
                                          workerId: w.id,
                                          date: dateStr,
                                          type: type,
                                          duration: 1
                                      });
                                      totalLeavesCount++;
                                  } else {
                                      try {
                                          const d = new Date(dateStr);
                                          if (!isNaN(d.getTime())) {
                                              const iso = d.toISOString().split('T')[0];
                                              workerLeaves.push({
                                                  id: `${w.id}_${iso}_${type}`,
                                                  workerId: w.id,
                                                  date: iso,
                                                  type: type,
                                                  duration: 1
                                              });
                                              totalLeavesCount++;
                                          }
                                      } catch (err) {}
                                  }
                              });
                          };

                          parseLeavesString(row['Casual Leaves Taken'] || row['casualLeavesTaken'] || '', 'casual');
                          parseLeavesString(row['Paid Leaves Taken'] || row['paidLeavesTaken'] || '', 'paid');
                          parseLeavesString(row['Unpaid Leaves Taken'] || row['unpaidLeavesTaken'] || '', 'unpaid');

                          if (workerLeaves.length > 0) {
                              // Track existing dates to prevent duplicate entries
                              const mergedLeaves = [...(w.leaves || [])];
                              workerLeaves.forEach(newL => {
                                  if (!mergedLeaves.some(l => l.date === newL.date)) {
                                      mergedLeaves.push(newL);
                                  }
                              });
                              w.leaves = mergedLeaves;
                          }
                      }
                  });
              });

              if (totalLeavesCount > 0) {
                  setWorkers(updatedWorkers);
                  onUpdate(updatedWorkers);
                  setImportedStatus(`Successfully imported ${totalLeavesCount} leaves across ${workersMatchedCount} matching editors!`);
                  setTimeout(() => setImportedStatus(null), 8000);
              } else {
                  setImportedStatus("No leave records could be matched with existing editors. Please confirm your columns have the headers 'Name', 'Casual Leaves Taken', and 'Paid Leaves Taken' and contain valid values.");
                  setTimeout(() => setImportedStatus(null), 8000);
              }

          } catch (err) {
              console.error("Excel import failed:", err);
              setImportedStatus("Failed to parse the uploaded Excel file. Please ensure it is a valid leave export template.");
              setTimeout(() => setImportedStatus(null), 5000);
          }
      };
      reader.readAsBinaryString(file);
  };

  const getCheckpointList = () => {
      try {
          const checkpointStr = localStorage.getItem('wedo_workers_checkpoints');
          return checkpointStr ? JSON.parse(checkpointStr) : [];
      } catch (e) {
          return [];
      }
  };

  const createManualCheckpoint = () => {
      try {
          const cpStr = localStorage.getItem('wedo_workers_checkpoints');
          const checkpoints = cpStr ? JSON.parse(cpStr) : [];
          const leavesCount = workers.reduce((sum, w) => sum + (w.leaves?.length || 0), 0);
          
          checkpoints.push({
              id: Date.now().toString(),
              timestamp: new Date().toISOString(),
              label: `Manual Save (${new Date().toLocaleTimeString()}) - ${leavesCount} Leaves`,
              workers: workers
          });
          
          if (checkpoints.length > 30) checkpoints.shift();
          localStorage.setItem('wedo_workers_checkpoints', JSON.stringify(checkpoints));
          alert("Backup checkpoint created successfully!");
      } catch (e) {
          alert("Failed to save backup snapshot.");
      }
  };

  const handleRestoreCheckpoint = (cpWorkers: Worker[]) => {
      if (readOnly) return;
      setConfirmAction({
          message: "Are you sure you want to restore this checkpoint? This will replace your active editors and all leave data with this historical backup state.",
          onConfirm: () => {
              setWorkers(cpWorkers);
              onUpdate(cpWorkers);
              setConfirmAction(null);
              setIsCheckpointsOpen(false);
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

          {isCheckpointsOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                  <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-2xl max-w-2xl w-full border border-slate-100 dark:border-slate-800 flex flex-col max-h-[85vh]">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800">
                          <div className="flex items-center gap-2 text-blue-600">
                              <History size={24} />
                              <h3 className="font-black text-xl">Leaves Checkpoints & History</h3>
                          </div>
                          <button 
                              onClick={() => setIsCheckpointsOpen(false)}
                              className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                          >
                              <X size={18} />
                          </button>
                      </div>
                      
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-4 bg-blue-50 dark:bg-blue-950/40 p-3 rounded-xl border border-blue-100/40">
                          To protect against accidental data loss or deletions, the system automatically creates a timestamped checkpoint of your team editors list, leaves, and configurations whenever updates are made. You can roll back or restore to any backup point at any time!
                      </div>

                      <div className="overflow-y-auto flex-1 space-y-3 pr-1">
                          {getCheckpointList().length === 0 ? (
                              <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
                                  No checkpoints recorded yet. Checkpoints are automatically generated locally in your browser cache as edits are made.
                              </div>
                          ) : (
                              getCheckpointList().slice().reverse().map((checkpoint: any) => {
                                  const leavesCount = checkpoint.workers.reduce((sum: number, w: any) => sum + (w.leaves?.length || 0), 0);
                                  return (
                                      <div key={checkpoint.id} className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/50 dark:hover:bg-slate-800/80 rounded-2xl border border-slate-100 dark:border-slate-800 transition-colors">
                                          <div>
                                              <div className="font-bold text-slate-800 dark:text-slate-200 text-sm">
                                                  {checkpoint.label}
                                              </div>
                                              <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                                  {new Date(checkpoint.timestamp).toLocaleString()} • {checkpoint.workers.length} Members • {leavesCount} Leaves
                                              </div>
                                          </div>
                                          <button 
                                              onClick={() => handleRestoreCheckpoint(checkpoint.workers)}
                                              className="px-3.5 py-1.5 text-xs bg-blue-650 hover:bg-blue-700 text-white font-bold rounded-lg transition-colors shadow-sm"
                                          >
                                              Restore State
                                          </button>
                                      </div>
                                  );
                              })
                          )}
                      </div>
                      
                      <div className="flex justify-end pt-4 mt-2 border-t border-slate-100 dark:border-slate-800 gap-3">
                          <button 
                              onClick={createManualCheckpoint}
                              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-sm transition-colors"
                          >
                              Create Save Point
                          </button>
                          <button 
                              onClick={() => setIsCheckpointsOpen(false)} 
                              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition-colors"
                          >
                              Close
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {importedStatus && (
              <div className="mb-6 p-4 bg-[#F26C21]/10 text-slate-800 dark:text-slate-200 text-sm font-bold rounded-2xl border border-[#F26C21]/20 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <Upload size={18} className="text-[#F26C21]" />
                      <span>{importedStatus}</span>
                  </div>
                  <button onClick={() => setImportedStatus(null)} className="text-slate-400 hover:text-slate-700">
                      <X size={16} />
                  </button>
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
                                                  {parseInt(l.date.split('-')[2], 10)}{l.duration === 0.5 ? ' (H)' : ''}
                                                  {!readOnly && <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-teal-800 dark:text-teal-200 hover:text-red-500"><X size={10} /></button>}
                                              </div>
                                          ))}
                                          {paidLeaves.map(l => (
                                              <div key={l.id} className="group relative px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={`Paid Leave: ${l.date} ${l.duration === 0.5 ? '(Half Day)' : ''}`}>
                                                  {parseInt(l.date.split('-')[2], 10)}{l.duration === 0.5 ? ' (H)' : ''}
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
                                                  {parseInt(l.date.split('-')[2], 10)}{l.duration === 0.5 ? ' (H)' : ''}
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
