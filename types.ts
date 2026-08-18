
export interface Leave {
  id: string;
  workerId: string;
  date: string; // ISO Date String (YYYY-MM-DD)
  type: 'paid' | 'casual' | 'unpaid';
  duration?: number; // 1 for full day, 0.5 for half day
  reason?: string;
  approvedBy?: string;
}

export interface Worker {
  id: string;
  name: string;
  email?: string;
  role: 'Editor' | 'Intern' | 'Assist' | 'Manager' | 'TL';
  genCapacity: number;
  editCapacity: number;
  limitations?: string;
  language?: string; // New: Team Language (e.g., 'Telugu', 'Hindi')
  leaves?: Leave[]; // New: Track leaves for this worker
  joiningDate?: string; // New: Date of joining (YYYY-MM-DD)
}

export interface Workload {
  totalVideos: number;
  aiVideos: number;
  normalVideos: number;
  deadlineDays: number;
  projectName: string;
  startDate: string;
  endDate: string;
}

export interface Batch {
  id: string;
  clientName: string;
  batchName: string;
  aiVideos: number;
  normalVideos: number;
  horizontalVersions?: number;
  verticalVersions?: number;
  squareVersions?: number;
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  language?: string; // New: Associated Language
  dummyRows?: string; // New: Rows to ignore (e.g. "5 10 25")
  normalRows?: string; // New: Rows that are normal videos (e.g. "1 2 3")
  startRow?: number;
  endRow?: number;
  // Computed/Progress properties (optional as they are calculated at runtime)
  completedGen?: number;
  completedEdit?: number;
  completedNormal?: number;
  completedVersions?: number;
  progress?: number;
  totalGen?: number;
  totalEdit?: number;
  totalNormal?: number;
  totalVersions?: number;
}

export interface User {
  role: 'admin' | 'lead';
  language: string; // The language they are currently managing
}

export interface EditorStats {
  workerId: string;
  name: string;
  team: string;
  totalPoints: number;
  generations: number;
  edits: number;
}

export interface AIInsightsResponse {
  recommendations: string[];
  bottlenecks: string[];
  batchPredictions: {
    batchId: string;
    batchName: string;
    predictedDaysRemaining: number;
    status: 'On Track' | 'Delayed' | 'Critical';
  }[];
}

// AI Response Types
export interface PlanSummary {
  totalGenerations: number;
  totalEdits: number;
  daysAvailable: number;
  feasible: boolean;
  feasibilityReason?: string;
  videosPendingAfterDay4?: number;
}

export interface Bottlenecks {
  generation: boolean;
  editing: boolean;
  limitingRole: string;
}

export interface TaskAssignment {
  id?: string; // Unique ID for specific assignment row (supports multiple per worker)
  workerId: string;
  person: string;
  generations: number;
  edits: number;
  role: string;
  isOnLeave?: boolean;
  isHalfDay?: boolean; // New: Half day leave
  batchId?: string; // Link work to a specific batch
  assignedRows?: string; // Deprecated: Space separated numbers
  assignedGenRows?: string; // New: Specific rows for generation
  assignedEditRows?: string; // New: Specific rows for editing
  plannedGenRows?: string; // New: Planned rows for generation
  plannedEditRows?: string; // New: Planned rows for editing
  plannedGenerations?: number; // New: Planned count for generation
  plannedEdits?: number; // New: Planned count for editing
  taskLanguage?: string; // New: Language context for this specific task (e.g. 'Hindi' if assigned from Hindi view)
  notes?: string; // New: Notes for other work or learning
  status?: 'In Progress' | 'Completed' | 'Rework'; // New: Status tracking
  hoursSpent?: number; // New: Time spent on this batch today (in hours)
}

export interface DayPlan {
  day: number;
  assignments: TaskAssignment[];
  dailyTotalGen: number;
  dailyTotalEdit: number;
  locked?: boolean; // Legacy: Tracks if the day is completed/actualized globally
  lockedTeams?: string[]; // New: List of languages that have locked this day
}

export interface RowAssignment {
  batchId: string;
  rowNumber: number;
  videoType: 'AI' | 'Actor';
  assigneeId?: string;
  stage: 'AI Generation' | 'Ready for Edit' | 'Editing' | 'Done';
  phase: 'Pending' | 'Started' | 'Completed';
}

export interface ProductionPlan {
  summary: PlanSummary;
  bottlenecks: Bottlenecks;
  schedule: DayPlan[];
  constraints: string[];
  risks: string[];
  rowAssignments?: Record<string, RowAssignment>; // Key: `${batchId}_${rowNumber}`
}
