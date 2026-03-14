import React, { useState } from 'react';
import { Worker, Leave } from '../types';
import { Calendar, Plus, X } from 'lucide-react';

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
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage);
  const [viewDate, setViewDate] = useState(new Date());

  const currentMonth = viewDate.getMonth();
  const currentYear = viewDate.getFullYear();

  const filteredWorkers = workers.filter(w => (w.language || 'Telugu') === selectedLanguage);

  const addLeave = (workerId: string, type: 'paid' | 'unpaid') => {
      const dateStr = prompt(`Enter date for ${type} leave (YYYY-MM-DD):`, `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`);
      if (!dateStr) return;

      const newLeave: Leave = {
          id: Math.random().toString(36).substr(2, 9),
          workerId,
          date: dateStr,
          type
      };

      const updatedWorkers = workers.map(w => {
          if (w.id === workerId) {
              return { ...w, leaves: [...(w.leaves || []), newLeave] };
          }
          return w;
      });

      setWorkers(updatedWorkers);
      onUpdate(updatedWorkers);
  };

  const removeLeave = (workerId: string, leaveId: string) => {
      if (!confirm("Are you sure you want to remove this leave?")) return;
      
      const updatedWorkers = workers.map(w => {
          if (w.id === workerId) {
              return { ...w, leaves: (w.leaves || []).filter(l => l.id !== leaveId) };
          }
          return w;
      });

      setWorkers(updatedWorkers);
      onUpdate(updatedWorkers);
  };

  const getLeavesForMonth = (worker: Worker, type: 'paid' | 'unpaid') => {
      return (worker.leaves || []).filter(l => {
          // Parse YYYY-MM-DD manually to avoid timezone issues
          const [y, m, d] = l.date.split('-').map(Number);
          const matchesDate = (m - 1) === currentMonth && y === currentYear;
          
          if (type === 'paid') {
              // Merge 'paid' and 'casual' into paid category
              return matchesDate && (l.type === 'paid' || l.type === 'casual');
          }
          return matchesDate && l.type === type;
      });
  };

  return (
      <div className="p-6 bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-800 h-full flex flex-col">
          {/* Header Controls */}
          <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
              <div className="flex items-center gap-4">
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <Calendar className="text-[#F26C21]" /> Leave Management
                  </h2>
                  
                  <select 
                      value={selectedLanguage} 
                      onChange={(e) => setSelectedLanguage(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-800 font-bold text-slate-700 dark:text-slate-200 py-2 px-4 rounded-xl outline-none focus:ring-2 focus:ring-[#F26C21]"
                  >
                      {languages.map(lang => (
                          <option key={lang} value={lang}>{lang} Team</option>
                      ))}
                  </select>
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
              <table className="w-full text-left border-collapse">
                  <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800">
                          <th className="p-4 font-black text-slate-500 dark:text-slate-400 uppercase text-xs tracking-wider">Editor Name</th>
                          <th className="p-4 font-black text-emerald-600 dark:text-emerald-400 uppercase text-xs tracking-wider">Paid Leaves (2/mo)</th>
                          <th className="p-4 font-black text-red-600 dark:text-red-400 uppercase text-xs tracking-wider">LOP (Unpaid)</th>
                      </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredWorkers.map(worker => {
                          const paidLeaves = getLeavesForMonth(worker, 'paid');
                          const unpaidLeaves = getLeavesForMonth(worker, 'unpaid');

                          return (
                              <tr key={worker.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                  <td className="p-4">
                                      <div className="font-bold text-slate-800 dark:text-slate-200">{worker.name}</div>
                                      <div className="text-xs text-slate-400 font-bold uppercase">{worker.role}</div>
                                  </td>
                                  
                                  {/* Paid Leaves */}
                                  <td className="p-4 align-top">
                                      <div className="flex flex-wrap gap-2 mb-2">
                                          {paidLeaves.map(l => (
                                              <div key={l.id} className="group relative px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={l.date}>
                                                  {new Date(l.date).getDate()}
                                                  <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-emerald-800 dark:text-emerald-200 hover:text-red-500"><X size={10} /></button>
                                              </div>
                                          ))}
                                      </div>
                                      <button 
                                          onClick={() => addLeave(worker.id, 'paid')}
                                          className="text-xs flex items-center gap-1 text-slate-400 hover:text-emerald-600 font-bold transition-colors"
                                      >
                                          <Plus size={12} /> Add Paid
                                      </button>
                                  </td>

                                  {/* LOP */}
                                  <td className="p-4 align-top">
                                      <div className="flex flex-wrap gap-2 mb-2">
                                          {unpaidLeaves.map(l => (
                                              <div key={l.id} className="group relative px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded text-xs font-bold flex items-center gap-1 cursor-help" title={l.date}>
                                                  {new Date(l.date).getDate()}
                                                  <button onClick={() => removeLeave(worker.id, l.id)} className="hidden group-hover:block text-red-800 dark:text-red-200 hover:text-red-500"><X size={10} /></button>
                                              </div>
                                          ))}
                                      </div>
                                      <button 
                                          onClick={() => addLeave(worker.id, 'unpaid')}
                                          className="text-xs flex items-center gap-1 text-slate-400 hover:text-red-600 font-bold transition-colors"
                                      >
                                          <Plus size={12} /> Add LOP
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
