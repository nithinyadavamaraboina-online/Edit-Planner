
import React, { useState } from 'react';
import { Save, X, AlertCircle } from 'lucide-react';

interface FirebaseConfigModalProps {
  onSave: (config: any) => void;
  onClose: () => void;
}

const FirebaseConfigModal: React.FC<FirebaseConfigModalProps> = ({ onSave, onClose }) => {
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    try {
      // Allow user to paste just the object or the variable declaration
      let cleanJson = jsonInput.trim();
      
      // Remove "const firebaseConfig = " if present
      if (cleanJson.startsWith('const firebaseConfig =')) {
        cleanJson = cleanJson.replace('const firebaseConfig =', '');
      }
      // Remove trailing semicolon
      if (cleanJson.endsWith(';')) {
        cleanJson = cleanJson.slice(0, -1);
      }

      // Try to parse
      // Use Function constructor to parse relaxed JSON (like JS objects with unquoted keys)
      // or strictly try JSON.parse
      let config;
      try {
        config = JSON.parse(cleanJson);
      } catch (e) {
        // Fallback for JS object syntax (e.g. { apiKey: "..." })
        // This is a simple evaluation safe for this context as it's client-side input
        // eslint-disable-next-line no-new-func
        config = new Function(`return ${cleanJson}`)();
      }

      if (!config.apiKey || !config.projectId) {
        throw new Error("Configuration must include at least apiKey and projectId.");
      }

      onSave(config);
    } catch (err) {
      setError("Invalid configuration format. Please paste the raw JSON object or the JS config object from Firebase Console.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-orange-100 rounded-lg">
               <Save className="text-[#F26C21]" size={24} />
             </div>
             <h2 className="text-xl font-bold text-slate-800">Link Firebase</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 flex gap-3">
            <AlertCircle className="text-blue-600 flex-shrink-0" size={20} />
            <div className="text-sm text-blue-800">
              <p className="font-bold mb-1">Configuration Required</p>
              <p>To save plans to the cloud, please provide your Firebase project configuration.</p>
              <p className="mt-2 text-xs opacity-80">
                Go to Firebase Console &gt; Project Settings &gt; General &gt; Your apps &gt; SDK Setup &gt; Config.
              </p>
            </div>
          </div>

          <label className="block text-sm font-bold text-slate-700 mb-2">
            Paste Firebase Config Object
          </label>
          <textarea
            value={jsonInput}
            onChange={(e) => {
              setJsonInput(e.target.value);
              setError(null);
            }}
            placeholder={
`{
  "apiKey": "AIzaSy...",
  "authDomain": "your-project.firebaseapp.com",
  "projectId": "your-project",
  "storageBucket": "your-project.appspot.com",
  "messagingSenderId": "...",
  "appId": "..."
}`}
            className="w-full h-48 p-4 border border-slate-200 rounded-xl font-mono text-xs bg-slate-50 focus:ring-2 focus:ring-[#F26C21] focus:border-[#F26C21] outline-none resize-none"
          />
          
          {error && (
            <div className="mt-3 text-red-600 text-sm font-medium flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 bg-[#F26C21] hover:bg-[#d95a10] text-white font-bold rounded-lg shadow-lg shadow-orange-200 transition-all active:scale-95"
          >
            Connect & Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirebaseConfigModal;
