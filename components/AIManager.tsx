import React from 'react';
import { ProductionPlan, Worker, Workload } from '../types';
import { Leaderboard } from './Leaderboard';

interface AIManagerProps {
  plan: ProductionPlan;
  workers: Worker[];
  workload: Workload;
  currentLanguage: string;
  batches?: any;
  apiKey?: string;
}

const AIManager: React.FC<AIManagerProps> = ({ plan, workers, workload, currentLanguage, batches }) => {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      
      {/* Leaderboard Section */}
      <Leaderboard 
        plan={plan} 
        workers={workers} 
        workload={workload} 
        currentLanguage={currentLanguage} 
        batches={batches}
      />
      
    </div>
  );
};

export default AIManager;
