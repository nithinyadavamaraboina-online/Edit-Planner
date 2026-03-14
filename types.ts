
export interface Leave {
  id: string;
  workerId: string;
  date: string; // ISO Date String (YYYY-MM-DD)
  type: 'paid' | 'casual' | 'unpaid';
  reason?: string;
  approvedBy?: string;
}

export interface Worker {
  id: string;
  name: string;
  role: 'Editor' | 'Intern' | 'Assist';
  genCapacity: number;
  editCapacity: number;
  limitations?: string;
  language?: string; // New: Team Language (e.g., 'Telugu', 'Hindi')
  leaves?: Leave[]; // New: Track leaves for this worker
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
  startDate?: string;
  endDate?: string;
  status: 'active' | 'completed' | 'archived';
  createdAt: string;
  language?: string; // New: Associated Language
  dummyRows?: string; // New: Rows to ignore (e.g. "5 10 25")
  normalRows?: string; // New: Rows that are normal videos (e.g. "1 2 3")
  // Computed/Progress properties (optional as they are calculated at runtime)
  completedGen?: number;
  completedEdit?: number;
  progress?: number;
  totalGen?: number;
  totalEdit?: number;
}

export interface User {
  role: 'admin' | 'lead';
  language: string; // The language they are currently managing
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
  batchId?: string; // Link work to a specific batch
  assignedRows?: string; // Deprecated: Space separated numbers
  assignedGenRows?: string; // New: Specific rows for generation
  assignedEditRows?: string; // New: Specific rows for editing
  plannedGenRows?: string; // New: Planned rows for generation
  plannedEditRows?: string; // New: Planned rows for editing
  plannedGenerations?: number; // New: Planned count for generation
  plannedEdits?: number; // New: Planned count for editing
  taskLanguage?: string; // New: Language context for this specific task (e.g. 'Hindi' if assigned from Hindi view)
}

export interface DayPlan {
  day: number;
  assignments: TaskAssignment[];
  dailyTotalGen: number;
  dailyTotalEdit: number;
  locked?: boolean; // Legacy: Tracks if the day is completed/actualized globally
  lockedTeams?: string[]; // New: List of languages that have locked this day
}

export interface ProductionPlan {
  summary: PlanSummary;
  bottlenecks: Bottlenecks;
  schedule: DayPlan[];
  constraints: string[];
  risks: string[];
}
