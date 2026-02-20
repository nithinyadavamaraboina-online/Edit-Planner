
import React, { useState } from 'react';
import { Worker } from '../types';
import { Plus, Trash2, User, ChevronDown, ChevronUp } from 'lucide-react';

interface WorkerFormProps {
  workers: Worker[]; // This is the filtered list for display
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>; // This sets global state
  currentLanguage: string;
}

const WorkerForm: React.FC<WorkerFormProps> = ({ workers, setWorkers, currentLanguage }) => {
  const [isOpen, setIsOpen] = useState(false); // Collapsed by default
  const [newWorker, setNewWorker] = useState<Partial<Worker>>({
    name: '',
    role: 'Editor',
    genCapacity: 0,
    editCapacity: 0,
    limitations: ''
  });

  // Default to open if no workers exist
  React.useEffect(() => {
    if (workers.length === 0) setIsOpen(true);
  }, [workers.length]);

  const handleAdd = () => {
    if (newWorker.name && newWorker.role) {
      const worker: Worker = {
        id: Math.random().toString(36).substr(2, 9),
        name: newWorker.name,
        role: newWorker.role as any,
        genCapacity: Number(newWorker.genCapacity) || 0,
        editCapacity: Number(newWorker.editCapacity) || 0,
        limitations: newWorker.limitations,
        language: currentLanguage // Assign to current view language
      };
      
      // We need to add to the global list using the setter
      setWorkers(prev => [...prev, worker]);
      
      setNewWorker({ name: '', role: 'Editor', genCapacity: 0, editCapacity: 0, limitations: '' });
    }
  };

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if(window.confirm("Delete this worker?")) {
        setWorkers(prev => prev.filter(w => w.id !== id));
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-all duration-200">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-50 rounded-lg text-[#F26C21]">
            <User size={20} />
          </div>
          <div>
             <h2 className="text-base font-bold text-slate-800">Team Resources</h2>
             <p className="text-xs text-slate-500 font-medium">
                 {workers.length} {currentLanguage} members
               </p>
          </div>
        </div>
        {isOpen ? <ChevronUp className="text-slate-400" size={20} /> : <ChevronDown className="text-slate-400" size={20} />}
      </div>

      {isOpen && (
        <div className="p-4 pt-0 border-t border-slate-100 animate-fade-in">
          {/* Add Worker Form - Stacked for narrow sidebar */}
          <div className="mb-4 bg-slate-50 rounded-xl border border-slate-100 mt-4 p-3 space-y-3">
            <div>
               <input 
                type="text" 
                placeholder="Name (e.g. John)"
                className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none bg-white text-slate-900 placeholder:text-slate-400"
                value={newWorker.name}
                onChange={e => setNewWorker({...newWorker, name: e.target.value})}
              />
            </div>
            
            <div className="flex gap-2">
                <select 
                    className="flex-1 p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none bg-white text-slate-900"
                    value={newWorker.role}
                    onChange={e => setNewWorker({...newWorker, role: e.target.value as any})}
                >
                    <option value="Editor">Editor</option>
                    <option value="Intern">Intern</option>
                    <option value="Assist">Assist</option>
                </select>
            </div>

            <div className="flex gap-2">
               <div className="flex-1 relative">
                 <label className="absolute -top-1.5 left-2 text-[9px] font-bold bg-white px-1 text-slate-400 uppercase">Gen Cap</label>
                 <input 
                    type="number" 
                    min="0"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none bg-white text-slate-900"
                    value={newWorker.genCapacity}
                    onFocus={(e) => e.target.select()}
                    onChange={e => setNewWorker({...newWorker, genCapacity: parseInt(e.target.value) || 0})}
                 />
               </div>
               <div className="flex-1 relative">
                 <label className="absolute -top-1.5 left-2 text-[9px] font-bold bg-white px-1 text-slate-400 uppercase">Edit Cap</label>
                 <input 
                    type="number" 
                    min="0"
                    className="w-full p-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none bg-white text-slate-900"
                    value={newWorker.editCapacity}
                    onFocus={(e) => e.target.select()}
                    onChange={e => setNewWorker({...newWorker, editCapacity: parseInt(e.target.value) || 0})}
                 />
               </div>
            </div>

            <button 
                onClick={handleAdd}
                className="w-full bg-[#F26C21] hover:bg-[#d95a10] text-white p-2 rounded-lg text-sm font-bold transition-colors flex justify-center items-center gap-1 shadow-sm active:scale-95"
              >
                <Plus size={16} /> Add Member
            </button>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
            {workers.length === 0 && (
              <div className="text-center py-4 text-slate-400 text-sm italic">No editors in {currentLanguage} team.</div>
            )}
            {workers.map(worker => (
              <div key={worker.id} className="flex items-center justify-between p-3 bg-white border border-slate-100 rounded-lg hover:border-orange-200 transition-all group shadow-sm">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className={`w-8 h-8 flex-shrink-0 rounded-full flex items-center justify-center text-xs font-bold
                    ${worker.role === 'Editor' ? 'bg-blue-100 text-blue-600' : 
                      worker.role === 'Intern' ? 'bg-purple-100 text-purple-600' : 
                      'bg-orange-100 text-orange-600'}`}>
                    {worker.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-800 truncate">{worker.name}</p>
                    <p className="text-[10px] text-slate-500 uppercase font-medium">{worker.role}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="flex flex-col items-end gap-0.5">
                    <div className="text-[10px] text-slate-500 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{worker.genCapacity}</span> Gen
                    </div>
                    <div className="text-[10px] text-slate-500 whitespace-nowrap">
                        <span className="font-bold text-slate-800">{worker.editCapacity}</span> Edit
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => handleDelete(e, worker.id)}
                    className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkerForm;
