
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-orange-100 rounded-lg">
               <Save className="text-[#F26C21]" size={24} />
             </div>
             <h2 className="text-xl font-bold text-slate-800">Save Plan Details</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Project Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl font-medium text-slate-900 bg-white focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none"
              placeholder="e.g. October Campaign"
              autoFocus
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">
              Notes / Description (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border border-slate-200 rounded-xl font-medium text-slate-900 bg-white focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none h-24 resize-none placeholder:text-slate-400"
              placeholder="Add details about deadlines, clients, or specific requirements..."
            />
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={() => onSave(projectName, notes)}
            disabled={!projectName.trim()}
            className="px-6 py-2 bg-[#F26C21] hover:bg-[#d95a10] text-white font-bold rounded-lg shadow-lg shadow-orange-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default SavePlanModal;
