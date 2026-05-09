
import React, { useState } from 'react';
import { Save, X } from 'lucide-react';

interface SavePlanModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (name: string, notes: string) => void;
}

const SavePlanModal: React.FC<SavePlanModalProps> = ({ isOpen, onClose, onSave }) => {
  const [projectName, setProjectName] = useState(`Project ${new Date().toLocaleDateString()}`);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg transition-colors">
               <Save className="text-[#F26C21]" size={24} />
             </div>
             <h2 className="text-xl font-bold text-slate-800 dark:text-white transition-colors">Save Plan Details</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4 bg-white dark:bg-slate-900 transition-colors">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none transition-colors"
              placeholder="October Campaign"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 transition-colors">
              Notes / Description (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-slate-200 dark:border-slate-700 rounded-xl font-medium text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none h-24 resize-none placeholder:text-slate-400 dark:placeholder:text-slate-600 transition-colors"
              placeholder="Add details about deadlines, clients, or specific requirements..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/80 transition-colors">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(projectName, notes)}
            disabled={!projectName.trim()}
            className="px-6 py-2 bg-[#F26C21] hover:bg-[#d95a10] text-white font-bold rounded-lg shadow-lg shadow-orange-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePlanModal;
