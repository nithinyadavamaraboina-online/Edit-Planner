
import React, { useState, useEffect } from 'react';
import { Layers, X } from 'lucide-react';
import { Batch } from '../types';

interface NewBatchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (batch: Omit<Batch, 'id' | 'status' | 'createdAt'>) => void;
  currentLanguage: string;
  initialData?: Batch | null;
  batches?: Batch[];
}

const DEFAULT_BRANDS = ['Seekho', 'Speakx', 'Axis Max', 'Moneyview', 'Oolka'];

const NewBatchModal: React.FC<NewBatchModalProps> = ({ isOpen, onClose, onSave, currentLanguage, initialData, batches = [] }) => {
  const [selectedBrand, setSelectedBrand] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [batchName, setBatchName] = useState('');
  const [aiVideos, setAiVideos] = useState(0);
  const [normalVideos, setNormalVideos] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [dummyRows, setDummyRows] = useState('');
  const [normalRows, setNormalRows] = useState('');
  const [startRow, setStartRow] = useState(2);
  const [endRow, setEndRow] = useState(0);
  const [horizontalVersions, setHorizontalVersions] = useState(0);
  const [verticalVersions, setVerticalVersions] = useState(0);
  const [squareVersions, setSquareVersions] = useState(0);

  // Generate list of brands
  const existingBrands = React.useMemo(() => {
    return [...DEFAULT_BRANDS];
  }, []);

  useEffect(() => {
    if (isOpen) {
        if (initialData) {
            const client = initialData.clientName || '';
            const matched = existingBrands.find(b => b.toLowerCase() === client.toLowerCase());
            if (matched) {
                setSelectedBrand(matched);
                setCustomBrand('');
            } else if (client) {
                setSelectedBrand('__NEW_BRAND__');
                setCustomBrand(client);
            } else {
                setSelectedBrand('');
                setCustomBrand('');
            }
            setBatchName(initialData.batchName);
            setAiVideos(initialData.aiVideos);
            setNormalVideos(initialData.normalVideos);
            setStartDate(initialData.startDate || '');
            setEndDate(initialData.endDate || '');
            setDummyRows(initialData.dummyRows || '');
            setNormalRows(initialData.normalRows || '');
            setStartRow(initialData.startRow || 2);
            setEndRow(initialData.endRow || 0);
            setHorizontalVersions(initialData.horizontalVersions || 0);
            setVerticalVersions(initialData.verticalVersions || 0);
            setSquareVersions(initialData.squareVersions || 0);
        } else {
            setSelectedBrand('');
            setCustomBrand('');
            setBatchName('');
            setAiVideos(0);
            setNormalVideos(0);
            setStartDate('');
            setEndDate('');
            setDummyRows('');
            setNormalRows('');
            setStartRow(2);
            setEndRow(0);
            setHorizontalVersions(0);
            setVerticalVersions(0);
            setSquareVersions(0);
        }
    }
  }, [isOpen, initialData, existingBrands]);

  const sanitizeRowInput = (inputStr: string, start: number, end: number) => {
    if (!inputStr) return '';
    const numbers = inputStr
      .split(/[\s,]+/)
      .map(s => parseInt(s.trim(), 10))
      .filter(n => !isNaN(n) && n >= start && n <= end);
    const uniqueNumbers = Array.from(new Set(numbers)).sort((a, b) => a - b);
    return uniqueNumbers.join(' ');
  };

  // Auto-calculate AI and Normal videos when row inputs change
  useEffect(() => {
    if (endRow >= startRow) {
      const totalRows = (endRow - startRow) + 1;
      const normalRowsCount = normalRows.split(/\s+/).filter(r => !isNaN(parseInt(r)) && r.trim() !== '').length;
      const dummyRowsCount = dummyRows.split(/\s+/).filter(r => !isNaN(parseInt(r)) && r.trim() !== '').length;
      
      const calculatedNormal = normalRowsCount;
      const calculatedAi = Math.max(0, totalRows - calculatedNormal - dummyRowsCount);
      
      setNormalVideos(calculatedNormal);
      setAiVideos(calculatedAi);
    }
  }, [startRow, endRow, normalRows, dummyRows]);

  const clientName = selectedBrand === '__NEW_BRAND__' ? customBrand.trim() : selectedBrand.trim();

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (!clientName || !batchName) return;
    
    onSave({
      clientName,
      batchName,
      aiVideos,
      normalVideos,
      horizontalVersions,
      verticalVersions,
      squareVersions,
      startDate,
      endDate,
      dummyRows,
      normalRows,
      startRow,
      endRow,
      language: initialData?.language || currentLanguage // Preserve lang if editing
    });
    
    // Reset handled by useEffect on next open
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] border border-slate-200 dark:border-slate-800 transition-colors">
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 transition-colors">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg transition-colors">
                <Layers className="text-blue-600 dark:text-blue-400" size={20} />
             </div>
             <div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white transition-colors">{initialData ? 'Edit Batch' : `New ${currentLanguage} Batch`}</h2>
             </div>
          </div>
          <button onClick={onClose} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 transition-colors">
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Client Brand</label>
            <select
              value={selectedBrand}
              onChange={(e) => setSelectedBrand(e.target.value)}
              className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
            >
              <option value="">Select current brand...</option>
              {existingBrands.map(brand => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
              <option value="__NEW_BRAND__">+ Add New Brand</option>
            </select>
          </div>

          {selectedBrand === '__NEW_BRAND__' && (
            <div className="animate-in slide-in-from-top-1 duration-200">
              <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Enter New Brand Name</label>
              <input
                type="text"
                value={customBrand}
                onChange={(e) => setCustomBrand(e.target.value)}
                className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                placeholder="E.g. Seekho, Speakx, etc."
                autoFocus
              />
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Batch Name/ID</label>
            <input
              type="text"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
              placeholder="Batch-04-OCT"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Start Row</label>
                <input
                  type="number"
                  min="1"
                  value={startRow}
                  onChange={(e) => setStartRow(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-lg font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">End Row</label>
                <input
                  type="number"
                  min="1"
                  value={endRow}
                  onChange={(e) => setEndRow(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-lg font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">AI Videos</label>
                <input
                  type="number"
                  min="0"
                  value={aiVideos}
                  onChange={(e) => setAiVideos(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-lg font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
             <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Normal Videos</label>
                <input
                  type="number"
                  min="0"
                  value={normalVideos}
                  onChange={(e) => setNormalVideos(parseInt(e.target.value) || 0)}
                  className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-lg font-black text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
             <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Horizontal Ver.</label>
                <input
                  type="number"
                  min="0"
                  value={horizontalVersions}
                  onChange={(e) => setHorizontalVersions(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Vertical Ver.</label>
                <input
                  type="number"
                  min="0"
                  value={verticalVersions}
                  onChange={(e) => setVerticalVersions(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
             <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1">Square Ver.</label>
                <input
                  type="number"
                  min="0"
                  value={squareVersions}
                  onChange={(e) => setSquareVersions(parseInt(e.target.value) || 0)}
                  className="w-full p-2 border border-slate-200 dark:border-slate-700 rounded-lg text-center font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none transition-colors"
                />
             </div>
          </div>
          
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Normal Rows (Optional)</label>
            <input
              type="text"
              value={normalRows}
              onChange={(e) => setNormalRows(e.target.value)}
              onBlur={() => setNormalRows(sanitizeRowInput(normalRows, startRow, endRow))}
              className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
              placeholder="1 2 3 (Normal Videos)"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Specify which rows are normal videos.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">Dummy Rows (Optional)</label>
            <input
              type="text"
              value={dummyRows}
              onChange={(e) => setDummyRows(e.target.value)}
              onBlur={() => setDummyRows(sanitizeRowInput(dummyRows, startRow, endRow))}
              className="w-full p-2.5 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-bold text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-800 focus:ring-2 focus:ring-blue-500 outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600 transition-colors"
              placeholder="5 12 30 (Rows to skip)"
            />
            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">These rows won't count as pending work.</p>
          </div>
        </div>

        <div className="p-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50 dark:bg-slate-800/80 transition-colors">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 dark:text-slate-400 font-bold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!clientName || !batchName}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-lg shadow-lg shadow-blue-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {initialData ? 'Update Batch' : 'Create Batch'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewBatchModal;
