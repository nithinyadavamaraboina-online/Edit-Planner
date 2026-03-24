
import React, { useState, useEffect, useRef } from 'react';
import { Worker } from '../types';
import { X, Users, Globe, Plus, Trash2, Settings, UserPlus, Download, Upload, HardDrive, RefreshCw } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
  languages: string[];
  setLanguages: React.Dispatch<React.SetStateAction<string[]>>;
  currentLanguage: string;
  onExportData?: () => void;
  onImportData?: (data: any) => void;
  onRestoreLocalBackup?: () => void;
  onError?: (msg: string) => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  workers,
  setWorkers,
  languages,
  setLanguages,
  currentLanguage,
  onExportData,
  onImportData,
  onRestoreLocalBackup,
  onError
}) => {
  const [activeTab, setActiveTab] = useState<'team' | 'languages' | 'data'>('team');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Worker State
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerRole, setNewWorkerRole] = useState<'Editor' | 'Intern' | 'Assist'>('Editor');
  const [newWorkerLang, setNewWorkerLang] = useState(currentLanguage);
  const [newWorkerJoiningDate, setNewWorkerJoiningDate] = useState('');

  // Language State
  const [newLang, setNewLang] = useState('');

  // --- WORKER LOGIC ---
  const [filterLang, setFilterLang] = useState<string>('Current');

  // Sync internal state when prop changes
  useEffect(() => {
    if (isOpen) {
        setNewWorkerLang(currentLanguage);
    }
  }, [isOpen, currentLanguage]);

  if (!isOpen) return null;

  const displayedWorkers = workers.filter(w => {
      if (filterLang === 'All') return true;
      if (filterLang === 'Current') return (w.language || 'Telugu') === currentLanguage;
      return w.language === filterLang;
  });

  const handleAddWorker = () => {
    if (!newWorkerName.trim()) return;
    
    const newWorker: Worker = {
        id: Math.random().toString(36).substr(2, 9),
        name: newWorkerName,
        role: newWorkerRole,
        genCapacity: newWorkerRole === 'Intern' ? 6 : 0,
        editCapacity: newWorkerRole === 'Editor' ? 9 : 0,
        language: newWorkerLang,
        limitations: '',
        joiningDate: newWorkerJoiningDate || '2026-02-01'
    };

    setWorkers(prev => [...prev, newWorker]);
    setNewWorkerName('');
    setNewWorkerJoiningDate('');
  };

  const deleteWorker = (workerId: string) => {
    if (window.confirm("Are you sure you want to remove this team member?")) {
      setWorkers(prev => prev.filter(w => w.id !== workerId));
    }
  };

  const handleWorkerLanguageChange = (workerId: string, lang: string) => {
    setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, language: lang } : w));
  };

  const handleWorkerRoleChange = (workerId: string, role: any) => {
    setWorkers(prev => prev.map(w => w.id === workerId ? { ...w, role } : w));
  };

  // --- LANGUAGE LOGIC ---
  const handleAddLanguage = () => {
    if (newLang && !languages.includes(newLang)) {
      setLanguages(prev => [...prev, newLang]);
      setNewLang('');
    }
  };

  const deleteLanguage = (lang: string) => {
    if (window.confirm(`Delete language "${lang}"?`)) {
      setLanguages(prev => prev.filter(l => l !== lang));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-200 rounded-lg">
               <Settings className="text-slate-700" size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800">Configuration</h2>
                <p className="text-xs text-slate-500 font-medium">Manage {currentLanguage} Team & System</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 px-5 pt-2">
            <button 
                onClick={() => setActiveTab('team')}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'team' ? 'border-[#F26C21] text-[#F26C21]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Team Members
            </button>
            <button 
                onClick={() => setActiveTab('languages')}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'languages' ? 'border-[#F26C21] text-[#F26C21]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                System Languages
            </button>
            <button 
                onClick={() => setActiveTab('data')}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'data' ? 'border-[#F26C21] text-[#F26C21]' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
            >
                Data Backup
            </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 custom-scrollbar">
            
            {/* TAB: TEAM MEMBERS */}
            {activeTab === 'team' && (
                <div className="space-y-6">
                    {/* Add Worker Form */}
                    <div className="flex justify-end mb-2">
                        <select 
                            value={filterLang}
                            onChange={(e) => setFilterLang(e.target.value)}
                            className="text-xs font-bold text-slate-500 bg-slate-100 border-none rounded-lg p-2 outline-none cursor-pointer hover:bg-slate-200 transition-colors"
                        >
                            <option value="Current">Current Team ({currentLanguage})</option>
                            <option value="All">All Teams</option>
                            {languages.filter(l => l !== currentLanguage).map(l => (
                                <option key={l} value={l}>{l} Team</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold text-sm">
                            <UserPlus size={16} className="text-[#F26C21]"/> Add New Member
                        </div>
                        <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-12 sm:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Name</label>
                                <input 
                                    type="text" 
                                    value={newWorkerName}
                                    onChange={(e) => setNewWorkerName(e.target.value)}
                                    placeholder="Name"
                                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 text-sm font-bold text-slate-800"
                                />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Role</label>
                                <select 
                                    value={newWorkerRole}
                                    onChange={(e) => setNewWorkerRole(e.target.value as any)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 text-sm font-bold text-slate-800"
                                >
                                    <option value="Editor">Editor</option>
                                    <option value="Intern">Intern</option>
                                    <option value="Assist">Assist</option>
                                    <option value="Manager">Manager</option>
                                    <option value="TL">TL</option>
                                </select>
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Team</label>
                                <select 
                                    value={newWorkerLang}
                                    onChange={(e) => setNewWorkerLang(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 text-sm font-bold text-slate-800"
                                >
                                    {(Array.from(new Set(languages)) as string[]).map(lang => (
                                        <option key={lang} value={lang}>{lang}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-4 sm:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 ml-1">Joining Date</label>
                                <input 
                                    type="date" 
                                    value={newWorkerJoiningDate}
                                    onChange={(e) => setNewWorkerJoiningDate(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 text-sm font-bold text-slate-800"
                                />
                            </div>
                            <div className="col-span-12 sm:col-span-2">
                                <button 
                                    onClick={handleAddWorker}
                                    type="button"
                                    className="w-full bg-[#F26C21] text-white font-bold rounded-lg hover:bg-[#d95a10] transition-all shadow-sm active:scale-95 py-2.5 flex items-center justify-center gap-2"
                                >
                                    <Plus size={18} /> <span className="sm:hidden">Add</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Team List */}
                    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-[10px] font-black text-slate-400 uppercase bg-slate-50/50 border-b border-slate-100">
                                    <th className="p-3 pl-4">Name</th>
                                    <th className="p-3">Role</th>
                                    <th className="p-3">Team</th>
                                    <th className="p-3">Joining Date</th>
                                    <th className="p-3 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {displayedWorkers.map(worker => (
                                    <tr key={worker.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-3 pl-4">
                                            <div className="flex items-center gap-3">
                                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-sm ${
                                                    worker.role === 'Intern' ? 'bg-purple-400' : 
                                                    worker.role === 'Assist' ? 'bg-orange-400' : 
                                                    worker.role === 'Manager' ? 'bg-emerald-500' :
                                                    worker.role === 'TL' ? 'bg-teal-500' :
                                                    'bg-blue-500'
                                                }`}>
                                                    {worker.name.charAt(0)}
                                                </div>
                                                <span className="font-bold text-slate-700 text-sm">{worker.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <select 
                                                value={worker.role} 
                                                onChange={(e) => handleWorkerRoleChange(worker.id, e.target.value)}
                                                className={`text-xs font-bold px-2 py-1 rounded-md border-0 outline-none cursor-pointer ${
                                                    worker.role === 'Intern' ? 'bg-purple-50 text-purple-700' : 
                                                    worker.role === 'Assist' ? 'bg-orange-50 text-orange-700' : 
                                                    worker.role === 'Manager' ? 'bg-emerald-50 text-emerald-700' :
                                                    worker.role === 'TL' ? 'bg-teal-50 text-teal-700' :
                                                    'bg-blue-50 text-blue-700'
                                                }`}
                                            >
                                                <option value="Editor">Editor</option>
                                                <option value="Intern">Intern</option>
                                                <option value="Assist">Assist</option>
                                                <option value="Manager">Manager</option>
                                                <option value="TL">TL</option>
                                            </select>
                                        </td>
                                        <td className="p-3">
                                            <select 
                                                value={worker.language || 'Telugu'} 
                                                onChange={(e) => handleWorkerLanguageChange(worker.id, e.target.value)}
                                                className="p-1 border border-slate-200 rounded text-xs font-bold bg-white focus:ring-1 focus:ring-purple-500 outline-none text-slate-700 cursor-pointer w-full max-w-[100px]"
                                            >
                                                {(Array.from(new Set(languages)) as string[]).map(lang => (
                                                    <option key={lang} value={lang}>{lang}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="p-3">
                                            <input 
                                                type="date" 
                                                value={worker.joiningDate || '2026-02-01'}
                                                onChange={(e) => {
                                                    const updatedWorkers = workers.map(w => 
                                                        w.id === worker.id ? { ...w, joiningDate: e.target.value } : w
                                                    );
                                                    setWorkers(updatedWorkers);
                                                }}
                                                className="p-1 border border-slate-200 rounded text-xs font-bold bg-white focus:ring-1 focus:ring-purple-500 outline-none text-slate-700 cursor-pointer w-full max-w-[120px]"
                                            />
                                        </td>
                                        <td className="p-3 text-right">
                                            <button 
                                                onClick={() => deleteWorker(worker.id)}
                                                className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {displayedWorkers.length === 0 && (
                            <div className="text-center py-8 text-slate-400 font-medium text-sm">No editors found in {currentLanguage} team.</div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: LANGUAGES */}
            {activeTab === 'languages' && (
                <div className="space-y-6">
                     <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold text-sm">
                            <Globe size={16} className="text-purple-600"/> Add New Language
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newLang}
                                onChange={(e) => setNewLang(e.target.value)}
                                placeholder="Language Name (Kannada)"
                                className="flex-1 p-2.5 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 text-sm font-bold text-slate-800"
                            />
                            <button 
                                onClick={handleAddLanguage}
                                className="bg-purple-600 text-white px-4 rounded-xl font-bold hover:bg-purple-700 shadow-sm active:scale-95"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(Array.from(new Set(languages)) as string[]).map(lang => (
                            <div key={lang} className="bg-white border border-slate-200 p-3 px-4 rounded-xl flex items-center justify-between hover:border-purple-200 transition-colors group shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-purple-400"></div>
                                    <span className="font-bold text-slate-700 text-sm">{lang}</span>
                                </div>
                                {lang !== 'Telugu' && (
                                     <button 
                                        onClick={() => deleteLanguage(lang)} 
                                        className="text-slate-300 hover:text-red-500 p-1 hover:bg-red-50 rounded-md transition-all"
                                     >
                                        <Trash2 size={14} />
                                     </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* TAB: DATA BACKUP */}
            {activeTab === 'data' && (
                <div className="space-y-6">
                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center gap-3 mb-4 text-slate-800 font-bold text-lg">
                            <HardDrive size={24} className="text-[#F26C21]"/> Data Management
                        </div>
                        <p className="text-sm text-slate-500 mb-6">
                            Export your entire project data (workers, batches, schedule, etc.) to a file, or import a previously saved backup. This is useful for keeping local backups of your work.
                        </p>

                        <div className="flex flex-col sm:flex-row gap-4">
                            <button 
                                onClick={onExportData}
                                className="flex-1 flex items-center justify-center gap-2 bg-[#F26C21] hover:bg-[#d95a10] text-white py-3 px-4 rounded-xl font-bold transition-all shadow-sm active:scale-95"
                            >
                                <Download size={18} />
                                Export Backup
                            </button>

                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex items-center justify-center gap-2 bg-white border-2 border-slate-200 hover:border-[#F26C21] hover:text-[#F26C21] text-slate-700 py-3 px-4 rounded-xl font-bold transition-all shadow-sm active:scale-95"
                            >
                                <Upload size={18} />
                                Import Backup
                            </button>
                            <input 
                                type="file" 
                                accept=".json"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (!file) return;
                                    const reader = new FileReader();
                                    reader.onload = (event) => {
                                        try {
                                            const data = JSON.parse(event.target?.result as string);
                                            if (onImportData) {
                                                onImportData(data);
                                                onClose();
                                            }
                                        } catch (err) {
                                            if (onError) {
                                                onError("Failed to parse backup file. Please ensure it is a valid JSON file exported from this app.");
                                            }
                                        }
                                    };
                                    reader.readAsText(file);
                                    // Reset input
                                    if (fileInputRef.current) fileInputRef.current.value = '';
                                }}
                            />
                        </div>
                        
                        <div className="mt-6 pt-6 border-t border-slate-100">
                            <h4 className="text-sm font-bold text-slate-800 mb-2">Emergency Recovery</h4>
                            <p className="text-xs text-slate-500 mb-4">
                                The app automatically saves a rolling backup of your last active plan to your browser's local storage. Use this if your cloud sync fails or data is accidentally overwritten.
                            </p>
                            <button 
                                onClick={() => {
                                    if (onRestoreLocalBackup) {
                                        onRestoreLocalBackup();
                                        onClose();
                                    }
                                }}
                                className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 px-4 rounded-xl font-bold transition-all shadow-sm active:scale-95"
                            >
                                <RefreshCw size={18} />
                                Restore Local Auto-Backup
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
