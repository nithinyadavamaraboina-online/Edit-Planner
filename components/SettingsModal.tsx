
import React, { useState, useEffect, useRef } from 'react';
import { Worker } from '../types';
import { X, Users, Globe, Plus, Trash2, Settings, UserPlus, Download, Upload, HardDrive, RefreshCw, Check, Bell, Loader2 } from 'lucide-react';
import { getAccessToken, signInWithGoogle } from '../services/firestoreService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  workers: Worker[];
  onUpdateWorkers: (workers: Worker[]) => void;
  languages: string[];
  onUpdateLanguages: (languages: string[]) => void;
  currentLanguage: string;
  onExportData?: () => void;
  onImportData?: (data: any) => void;
  onError?: (msg: string) => void;
  projectMeta?: any;
  onUpdateProjectField?: (fields: any) => Promise<void>;
}

const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  workers,
  onUpdateWorkers,
  languages,
  onUpdateLanguages,
  currentLanguage,
  onExportData,
  onImportData,
  onError,
  projectMeta,
  onUpdateProjectField
}) => {
  const [activeTab, setActiveTab] = useState<'team' | 'languages' | 'data'>('team');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Worker State
  const [newWorkerName, setNewWorkerName] = useState('');
  const [newWorkerEmail, setNewWorkerEmail] = useState('');
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
        email: newWorkerEmail.trim() || undefined,
        role: newWorkerRole,
        genCapacity: newWorkerRole === 'Intern' ? 6 : 0,
        editCapacity: newWorkerRole === 'Editor' ? 9 : 0,
        language: newWorkerLang,
        limitations: '',
        joiningDate: newWorkerJoiningDate || '2026-02-01'
    };

    onUpdateWorkers([...workers, newWorker]);
    setNewWorkerName('');
    setNewWorkerEmail('');
    setNewWorkerJoiningDate('');
  };

  const deleteWorker = (workerId: string) => {
    if (window.confirm("Are you sure you want to remove this team member?")) {
      onUpdateWorkers(workers.filter(w => w.id !== workerId));
    }
  };

  const handleWorkerLanguageChange = (workerId: string, lang: string) => {
    onUpdateWorkers(workers.map(w => w.id === workerId ? { ...w, language: lang } : w));
  };

  const handleWorkerRoleChange = (workerId: string, role: any) => {
    onUpdateWorkers(workers.map(w => w.id === workerId ? { ...w, role } : w));
  };

  // --- LANGUAGE LOGIC ---
  const handleAddLanguage = () => {
    if (newLang && !languages.includes(newLang)) {
      onUpdateLanguages([...languages, newLang]);
      setNewLang('');
    }
  };

  const deleteLanguage = (lang: string) => {
    if (window.confirm(`Delete language "${lang}"?`)) {
      onUpdateLanguages(languages.filter(l => l !== lang));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[85vh] border border-slate-200 dark:border-slate-800 transition-colors">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-slate-200 dark:bg-slate-700 rounded-lg transition-colors">
               <Settings className="text-slate-700 dark:text-slate-300" size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white transition-colors">Configuration</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Manage {currentLanguage} Team & System</p>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 pt-2 bg-white dark:bg-slate-900 transition-colors">
            <button 
                onClick={() => setActiveTab('team')}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'team' ? 'border-[#F26C21] text-[#F26C21]' : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
            >
                Team Members
            </button>
            <button 
                onClick={() => setActiveTab('languages')}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'languages' ? 'border-[#F26C21] text-[#F26C21]' : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
            >
                System Languages
            </button>
            <button 
                onClick={() => setActiveTab('data')}
                className={`pb-3 px-4 text-sm font-bold border-b-2 transition-colors ${activeTab === 'data' ? 'border-[#F26C21] text-[#F26C21]' : 'border-transparent text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}
            >
                Data Backup
            </button>
        </div>
        
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50 dark:bg-slate-950 custom-scrollbar transition-colors">
            
            {/* TAB: TEAM MEMBERS */}
            {activeTab === 'team' && (
                <div className="space-y-6">
                    {/* Add Worker Form */}
                    <div className="flex justify-end mb-2">
                        <select 
                            value={filterLang}
                            onChange={(e) => setFilterLang(e.target.value)}
                            className="text-xs font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <option value="Current">Current Team ({currentLanguage})</option>
                            <option value="All">All Teams</option>
                            {languages.filter(l => l !== currentLanguage).map(l => (
                                <option key={l} value={l}>{l} Team</option>
                            ))}
                        </select>
                    </div>

                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm transition-colors">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-white font-bold text-sm">
                            <UserPlus size={16} className="text-[#F26C21]"/> Add New Member
                        </div>
                        <div className="grid grid-cols-12 gap-3 items-end">
                            <div className="col-span-12 sm:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 ml-1">Name</label>
                                <input 
                                    type="text" 
                                    value={newWorkerName}
                                    onChange={(e) => setNewWorkerName(e.target.value)}
                                    placeholder="Name"
                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors"
                                />
                            </div>
                            <div className="col-span-12 sm:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 ml-1">Email (Google Sign-in)</label>
                                <input 
                                    type="email" 
                                    value={newWorkerEmail}
                                    onChange={(e) => setNewWorkerEmail(e.target.value)}
                                    placeholder="Email"
                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors"
                                />
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 ml-1">Role</label>
                                <select 
                                    value={newWorkerRole}
                                    onChange={(e) => setNewWorkerRole(e.target.value as any)}
                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors"
                                >
                                    <option value="Editor">Editor</option>
                                    <option value="Intern">Intern</option>
                                    <option value="Assist">Assist</option>
                                    <option value="Manager">Manager</option>
                                    <option value="TL">TL</option>
                                </select>
                            </div>
                            <div className="col-span-4 sm:col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 ml-1">Team</label>
                                <select 
                                    value={newWorkerLang}
                                    onChange={(e) => setNewWorkerLang(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors"
                                >
                                    {(Array.from(new Set(languages)) as string[]).map(lang => (
                                        <option key={lang} value={lang}>{lang}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="col-span-4 sm:col-span-3">
                                <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 ml-1">Joining Date</label>
                                <input 
                                    type="date" 
                                    value={newWorkerJoiningDate}
                                    onChange={(e) => setNewWorkerJoiningDate(e.target.value)}
                                    className="w-full p-2.5 border border-slate-300 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-[#F26C21] bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors"
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

                    {/* Team List - Responsive */}
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm transition-colors">
                        {/* Mobile Card View */}
                        <div className="md:hidden divide-y divide-slate-50 dark:divide-slate-800">
                            {displayedWorkers.map(worker => (
                                <div key={worker.id} className="p-4 flex flex-col gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm text-white font-bold shadow-sm flex-shrink-0 ${
                                                worker.role === 'Intern' ? 'bg-purple-400' : 
                                                worker.role === 'Assist' ? 'bg-orange-400' : 
                                                worker.role === 'Manager' ? 'bg-emerald-500' :
                                                worker.role === 'TL' ? 'bg-teal-500' :
                                                'bg-blue-500'
                                            }`}>
                                                {worker.name.charAt(0)}
                                            </div>
                                            <div className="min-w-0">
                                                <input 
                                                    type="text" 
                                                    value={worker.name}
                                                    onChange={(e) => {
                                                        const updatedWorkers = workers.map(w => 
                                                            w.id === worker.id ? { ...w, name: e.target.value } : w
                                                        );
                                                        onUpdateWorkers(updatedWorkers);
                                                    }}
                                                    placeholder="Name"
                                                    className="p-1 border border-slate-200 dark:border-slate-700 focus:border-[#F26C21] rounded text-sm font-bold bg-white dark:bg-slate-800 outline-none text-slate-800 dark:text-slate-200 transition-colors w-full mb-1"
                                                />
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => deleteWorker(worker.id)}
                                            className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 rounded-lg transition-colors"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-2">
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Role</label>
                                            <select 
                                                value={worker.role} 
                                                onChange={(e) => handleWorkerRoleChange(worker.id, e.target.value)}
                                                className="text-xs font-bold px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border-0 outline-none text-slate-700 dark:text-slate-300"
                                            >
                                                <option value="Editor">Editor</option>
                                                <option value="Intern">Intern</option>
                                                <option value="Assist">Assist</option>
                                                <option value="Manager">Manager</option>
                                                <option value="TL">TL</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Team</label>
                                            <select 
                                                value={worker.language || 'Telugu'} 
                                                onChange={(e) => handleWorkerLanguageChange(worker.id, e.target.value)}
                                                className="text-xs font-bold px-2 py-2 rounded-lg bg-slate-100 dark:bg-slate-800 border-0 outline-none text-slate-700 dark:text-slate-300"
                                            >
                                                {(Array.from(new Set(languages)) as string[]).map(lang => (
                                                    <option key={lang} value={lang}>{lang}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="flex flex-col gap-1 col-span-2">
                                            <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Email</label>
                                            <input 
                                                type="email" 
                                                value={worker.email || ''}
                                                onChange={(e) => {
                                                    const updatedWorkers = workers.map(w => 
                                                        w.id === worker.id ? { ...w, email: e.target.value } : w
                                                    );
                                                    onUpdateWorkers(updatedWorkers);
                                                }}
                                                placeholder="Email"
                                                className="p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Desktop Table View */}
                        <div className="hidden md:block overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors">
                                        <th className="p-3 pl-4 w-[25%]">Name</th>
                                        <th className="p-3 w-[25%]">Email</th>
                                        <th className="p-3 w-[15%]">Role</th>
                                        <th className="p-3 w-[15%]">Team</th>
                                        <th className="p-3 w-[15%]">Joining Date</th>
                                        <th className="p-3 text-right w-[5%]">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50 dark:divide-slate-800 transition-colors">
                                    {displayedWorkers.map(worker => (
                                        <tr key={worker.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group">
                                            <td className="p-3 pl-4">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs text-white font-bold shadow-sm flex-shrink-0 ${
                                                        worker.role === 'Intern' ? 'bg-purple-400' : 
                                                        worker.role === 'Assist' ? 'bg-orange-400' : 
                                                        worker.role === 'Manager' ? 'bg-emerald-500' :
                                                        worker.role === 'TL' ? 'bg-teal-500' :
                                                        'bg-blue-500'
                                                    }`}>
                                                        {worker.name.charAt(0)}
                                                    </div>
                                                    <input 
                                                        type="text" 
                                                        value={worker.name}
                                                        onChange={(e) => {
                                                            const updatedWorkers = workers.map(w => 
                                                                w.id === worker.id ? { ...w, name: e.target.value } : w
                                                            );
                                                            onUpdateWorkers(updatedWorkers);
                                                        }}
                                                        placeholder="Name"
                                                        className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none text-slate-700 dark:text-slate-300 w-full transition-colors font-bold"
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-3">
                                                <input 
                                                    type="email" 
                                                    value={worker.email || ''}
                                                    onChange={(e) => {
                                                        const updatedWorkers = workers.map(w => 
                                                            w.id === worker.id ? { ...w, email: e.target.value } : w
                                                        );
                                                        onUpdateWorkers(updatedWorkers);
                                                    }}
                                                    placeholder="Email"
                                                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none text-slate-700 dark:text-slate-300 w-full transition-colors"
                                                />
                                            </td>
                                            <td className="p-3">
                                                <select 
                                                    value={worker.role} 
                                                    onChange={(e) => handleWorkerRoleChange(worker.id, e.target.value)}
                                                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none text-slate-700 dark:text-slate-300 cursor-pointer w-full transition-colors"
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
                                                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none text-slate-700 dark:text-slate-300 cursor-pointer w-full transition-colors"
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
                                                        onUpdateWorkers(updatedWorkers);
                                                    }}
                                                    className="p-1.5 border border-slate-200 dark:border-slate-700 rounded text-xs font-bold bg-white dark:bg-slate-800 focus:ring-1 focus:ring-purple-500 outline-none text-slate-700 dark:text-slate-300 cursor-pointer w-full transition-colors"
                                                />
                                            </td>
                                            <td className="p-3 text-right">
                                                <button 
                                                    onClick={() => deleteWorker(worker.id)}
                                                    className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {displayedWorkers.length === 0 && (
                            <div className="text-center py-8 text-slate-400 dark:text-slate-500 font-medium text-sm transition-colors">No editors found in {currentLanguage} team.</div>
                        )}
                    </div>
                </div>
            )}

            {/* TAB: LANGUAGES */}
            {activeTab === 'languages' && (
                <div className="space-y-6">
                     <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm transition-colors">
                        <div className="flex items-center gap-2 mb-4 text-slate-800 dark:text-white font-bold text-sm transition-colors">
                            <Globe size={16} className="text-purple-600 dark:text-purple-400"/> Add New Language
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={newLang}
                                onChange={(e) => setNewLang(e.target.value)}
                                placeholder="Language Name (Kannada)"
                                className="flex-1 p-2.5 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 bg-slate-50 dark:bg-slate-800 text-sm font-bold text-slate-800 dark:text-slate-100 transition-colors"
                            />
                            <button 
                                onClick={handleAddLanguage}
                                className="bg-purple-600 dark:bg-purple-700 text-white px-4 rounded-xl font-bold hover:bg-purple-700 dark:hover:bg-purple-800 shadow-sm active:scale-95 transition-all flex items-center justify-center min-w-[50px]"
                            >
                                <Plus size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(Array.from(new Set(languages)) as string[]).map(lang => (
                            <div key={lang} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-3 px-4 rounded-xl flex items-center justify-between hover:border-purple-200 dark:hover:border-purple-800 transition-colors group shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-purple-400 dark:bg-purple-500"></div>
                                    <span className="font-bold text-slate-700 dark:text-slate-200 text-sm">{lang}</span>
                                </div>
                                {lang !== 'Telugu' && (
                                     <button 
                                        onClick={() => deleteLanguage(lang)} 
                                        className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-all"
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
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm transition-colors">
                        <div className="flex items-center gap-3 mb-4 text-slate-800 dark:text-white font-bold text-lg transition-colors">
                            <HardDrive size={24} className="text-[#F26C21]"/> Data Management
                        </div>
                        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 transition-colors">
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
                                className="flex-1 flex items-center justify-center gap-2 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-[#F26C21] dark:hover:border-[#F26C21] hover:text-[#F26C21] dark:hover:text-[#F26C21] text-slate-700 dark:text-slate-300 py-3 px-4 rounded-xl font-bold transition-all shadow-sm active:scale-95"
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
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>

  );
};

export default SettingsModal;
