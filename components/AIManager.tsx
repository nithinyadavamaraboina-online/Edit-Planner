import React, { useState, useMemo } from 'react';
import { ProductionPlan, Worker, Batch, EditorStats, AIInsightsResponse, Workload } from '../types';
import { generateAIInsights } from '../services/geminiService';
import { Brain, Trophy, AlertTriangle, Zap, Loader2, Star, TrendingUp, Clock } from 'lucide-react';
import { Leaderboard } from './Leaderboard';

interface AIManagerProps {
  plan: ProductionPlan;
  workers: Worker[];
  batches: Batch[];
  workload: Workload;
  currentLanguage: string;
  apiKey: string;
}

const AIManager: React.FC<AIManagerProps> = ({ plan, workers, batches, workload, currentLanguage, apiKey }) => {
  const [insights, setInsights] = useState<AIInsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Part 2: AI Predictions
  const handleGenerateInsights = async () => {
    if (!apiKey) {
      setError("API Key is required to generate AI insights. Please set it in the configuration.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await generateAIInsights(apiKey, plan, workers, batches);
      setInsights(result);
    } catch (err: any) {
      setError(err.message || "Failed to generate insights.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 transition-colors">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Brain className="text-purple-600 dark:text-purple-400" size={28} />
            AI Operations Manager
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Intelligent forecasting and team performance tracking</p>
        </div>
        <button
          onClick={handleGenerateInsights}
          disabled={loading || !apiKey}
          className="flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-md shadow-purple-200 dark:shadow-none transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={20} className="animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Zap size={20} />
              Generate AI Strategy
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-xl flex items-center gap-3 transition-colors">
          <AlertTriangle size={20} className="text-red-500 shrink-0" />
          <p className="font-medium">{error}</p>
        </div>
      )}

      {/* AI Insights Section */}
      <div className="space-y-6">
        {insights ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Batch Predictions */}
            <div className="md:col-span-2 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/30 transition-colors">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg text-blue-600 dark:text-blue-400 transition-colors">
                  <Clock size={20} />
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Batch Forecasts</h2>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {insights.batchPredictions.map((prediction, idx) => (
                  <div key={idx} className="border border-slate-100 dark:border-slate-800 rounded-xl p-4 bg-slate-50/50 dark:bg-slate-950/50 flex flex-col transition-colors">
                    <div className="font-bold text-slate-800 dark:text-slate-200 mb-1 truncate" title={prediction.batchName}>
                      {prediction.batchName}
                    </div>
                    <div className="flex items-end justify-between mt-auto pt-4">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">Remaining</div>
                        <div className="font-black text-2xl text-slate-700 dark:text-slate-300">{prediction.predictedDaysRemaining} <span className="text-sm font-medium text-slate-500 dark:text-slate-500">days</span></div>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        prediction.status === 'On Track' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' :
                        prediction.status === 'Delayed' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                        'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      }`}>
                        {prediction.status}
                      </span>
                    </div>
                  </div>
                ))}
                {insights.batchPredictions.length === 0 && (
                  <div className="col-span-full text-center py-8 text-slate-500 dark:text-slate-500 font-medium">
                    No active batches to forecast.
                  </div>
                )}
              </div>
            </div>

            {/* Recommendations */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/30 transition-colors">
                <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg text-emerald-600 dark:text-emerald-400 transition-colors">
                  <TrendingUp size={20} />
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Strategic Recommendations</h2>
              </div>
              <div className="p-5">
                <ul className="space-y-3">
                  {insights.recommendations.map((rec, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                      <Star size={16} className="text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>{rec}</span>
                    </li>
                  ))}
                  {insights.recommendations.length === 0 && (
                    <li className="text-slate-500 dark:text-slate-500 text-sm italic">No recommendations available.</li>
                  )}
                </ul>
              </div>
            </div>

            {/* Bottlenecks */}
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden transition-colors">
              <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-slate-50/50 dark:bg-slate-800/30 transition-colors">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg text-red-600 dark:text-red-400 transition-colors">
                  <AlertTriangle size={20} />
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-white">Identified Bottlenecks</h2>
              </div>
              <div className="p-5">
                <ul className="space-y-3">
                  {insights.bottlenecks.map((bottleneck, idx) => (
                    <li key={idx} className="flex gap-3 text-sm text-slate-700 dark:text-slate-300 transition-colors">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400 shrink-0 mt-2"></div>
                      <span>{bottleneck}</span>
                    </li>
                  ))}
                  {insights.bottlenecks.length === 0 && (
                    <li className="text-slate-500 dark:text-slate-500 text-sm italic">No bottlenecks identified.</li>
                  )}
                </ul>
              </div>
            </div>

          </div>
        ) : (
          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800 border-dashed flex flex-col items-center justify-center p-8 text-center transition-colors">
            <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center mb-4 text-purple-600 dark:text-purple-400 transition-colors">
              <Brain size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">AI Insights Ready</h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-md">
              Click "Generate AI Strategy" to analyze your current schedule, identify bottlenecks, and get predictions for your active batches.
            </p>
          </div>
        )}
      </div>

      {/* Leaderboard Section */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">

        <Leaderboard 
          plan={plan} 
          workers={workers} 
          workload={workload} 
          currentLanguage={currentLanguage} 
        />
      </div>
      
    </div>
  );
};

export default AIManager;
