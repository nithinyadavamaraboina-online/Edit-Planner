
import React, { useState, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import { Batch } from '../types';

interface NewBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (batch: Omit<Batch, 'id' | 'status' | 'createdAt'>) => void;
  currentLanguage: string;
  initialData?: Batch | null;
}

const NewBatchModal: React.FC<NewBatchModalProps> = ({ isOpen, onClose, onSave, currentLanguage, initialData }) => {
  const [clientName, setClientName] = useState('');
  const [batchName, setBatchName] = useState('');
  const [aiVideos, setAiVideos] = useState(0);
  const [normalVideos, setNormalVideos] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dummyRows, setDummyRows] = useState('');
  const [normalRows, setNormalRows] = useState('');

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            setClientName(initialData.clientName);
            setBatchName(initialData.batchName);
            setAiVideos(initialData.aiVideos);
            setNormalVideos(initialData.normalVideos);
            setStartDate(initialData.startDate || '');
            setEndDate(initialData.endDate || '');
            setDummyRows(initialData.dummyRows || '');
            setNormalRows(initialData.normalRows || '');
        } else {
            setClientName('');
            setBatchName('');
            setAiVideos(0);
            setNormalVideos(0);
            setStartDate('');
            setEndDate('');
            setDummyRows('');
            setNormalRows('');
        }
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!clientName || !batchName) return;
    
    onSave({
      clientName,
      batchName,
      aiVideos,
      normalVideos,
      startDate,
      endDate,
      dummyRows,
      normalRows,
      language: initialData?.language || currentLanguage // Preserve lang if editing
    });
    
    // Reset handled by useEffect on next open
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-100 rounded-lg">
               <Layers className="text-blue-600" size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800">{initialData ? 'Edit Batch' : `New ${currentLanguage} Batch`}</h2>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Client Name</label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Nerchuko"
              autoFocus={!initialData}
            />
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Batch Name/ID</label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Batch-04-OCT"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">AI Videos</label>
                <input
                  type="number"
                  min="0"
                  value={aiVideos}
                  onChange={(e) => setAiVideos(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-lg font-black text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">Normal Videos</label>
                <input
                  type="number"
                  min="0"
                  value={normalVideos}
                  onChange={(e) => setNormalVideos(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg text-lg font-black text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                />
             </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Normal Rows (Optional)</label>
            <input
              type="text"
              value={normalRows}
              onChange={(e) => setNormalRows(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-300"
              placeholder="1 2 3 (Normal Videos)"
            />
            <p className="text-[10px] text-slate-400 mt-1">Specify which rows are normal videos.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">Dummy Rows (Optional)</label>
            <input
              type="text"
              value={dummyRows}
              onChange={(e) => setDummyRows(e.target.value)}
              className="w-full p-2.5 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 bg-white focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-300"
              placeholder="5 12 30 (Rows to skip)"
            />
            <p className="text-[10px] text-slate-400 mt-1">These rows won't count as pending work.</p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-bold text-sm hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!clientName || !batchName}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-lg shadow-blue-200 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialData ? 'Update Batch' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewBatchModal;
