export const LOCAL_FOCUS_SESSION_ID_PREFIX = "local-session-";

export type Domain = "life" | "health" | "finance";

export type Evidence = {
  id: string;
  domain: Domain;
  recordType: string;
  recordId: string;
  label: string;
};

export type Tag = {
  id: string;
  name: string;
  color?: string;
  system?: boolean;
};

export type TimeBlock = {
  id: string;
  type: "event" | "todo" | "session";
  title: string;
  notes?: string;
  tagIds: string[];
  startAt?: string;
  endAt?: string;
  dueAt?: string;
  allDay?: boolean;
  timezone?: string;
  createdAt: string;
  updatedAt: string;
};

export type Event = TimeBlock & {
  type: "event";
  location?: string;
  recurrence?: string;
};

export type Todo = TimeBlock & {
  type: "todo";
  priority?: "low" | "medium" | "high";
  completedAt?: string;
};

export type Session = TimeBlock & {
  type: "session";
  todoIds: string[];
  mode: "focus" | "break";
};

export type LifeData = {
  tags: Tag[];
  timeBlocks: Array<Event | Todo | Session>;
  activeSession?: Session;
};

export type ExerciseSet = {
  reps?: number;
  weightKg?: number;
  durationSeconds?: number;
  distanceMeters?: number;
};

export type Exercise = {
  title: string;
  muscleGroups: string[];
  sets: ExerciseSet[];
};

export type Workout = {
  id: string;
  title: string;
  startAt: string;
  endAt?: string;
  exercises: Exercise[];
  createdAt: string;
  updatedAt: string;
};

export type Macro = {
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
};

export type Meal = {
  id: string;
  title: string;
  time: string;
  photoId?: string;
  notes?: string;
  macro?: Macro;
  createdAt: string;
  updatedAt: string;
};

export type DailySentiment = {
  id: string;
  date: string;
  moodScore?: number;
  stressScore?: number;
  energyScore?: number;
  confidenceScore?: number;
  topics: string[];
  summary: string;
  evidenceSessionIds: string[];
  createdAt: string;
};

export type HealthData = {
  workouts: Workout[];
  meals: Meal[];
  dailySentiment?: DailySentiment;
};

export type Account = {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment" | "crypto" | "loan";
  currency: string;
  balance?: number;
  source?: string;
  status?: string;
  institution?: string;
  mask?: string;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  group: "income" | "spending" | "transfers" | "debt" | "investing" | "other";
  excludeFromSpending?: boolean;
  color?: string;
};

export type Transaction = {
  id: string;
  importFingerprint?: string;
  title: string;
  amount: number;
  currency: string;
  time: string;
  accountId?: string;
  categoryId?: string;
  status?: "pending" | "posted";
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type Position = {
  id: string;
  accountId: string;
  symbol: string;
  name?: string;
  quantity: number;
  marketValue?: number;
  averageCost?: number;
  currency: string;
  updatedAt: string;
};

export type FinanceData = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  positions: Position[];
};

export type Insight = {
  id: string;
  title: string;
  summary: string;
  domains: Domain[];
  claim: string;
  evidence: Evidence[];
  confidence: "low" | "medium" | "high";
  impact: "low" | "medium" | "high";
  recommendedAction?: string;
  createdAt: string;
  updatedAt: string;
};

export type Recommendation = {
  id: string;
  insightId: string;
  title: string;
  reason: string;
  suggestedAction: string;
  status: "needs_review" | "accepted" | "dismissed";
  evidence: Evidence[];
  createdAt: string;
  updatedAt: string;
};

export type ProposedDiff = {
  id: string;
  domain: Domain;
  operation: "create" | "update" | "delete";
  recordType: string;
  title: string;
  summary: string;
  status: "needs_review" | "approved" | "rejected";
  evidence: Evidence[];
  createdAt: string;
};

export type LifeIntelligenceData = {
  life: LifeData;
  health: HealthData;
  finance: FinanceData;
  insights: Insight[];
  recommendations: Recommendation[];
  proposedDiffs: ProposedDiff[];
  insightRun: {
    id: string;
    status: "idle" | "running" | "complete" | "failed";
    startedAt: string;
    completedAt?: string;
    queriedEvidence: Evidence[];
  };
};
