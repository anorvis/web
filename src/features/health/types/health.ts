export type WorkoutSummary = {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  durationSeconds: number;
  totalVolumeLbs: number;
  exerciseCount: number;
  topExercises: { title: string; summary: string }[];
};

export type TrainingDay = {
  date: string;
  workouts: { title: string; volumeLbs: number }[];
};

export type ScoreFactor = {
  key: "consistency" | "loadBalance" | "overload" | "recovery";
  label: string;
  score: number | null;
  trend: "up" | "down" | "stable" | null;
  detail: string;
};

export type HealthScore = {
  overall: number | null;
  trainingScore: number | null;
  factors: ScoreFactor[];
  nudge: string;
  confidence: "low" | "medium" | "high";
  workoutCount: number;
};

/** Raw set data used by the scoring algorithm. */
export type ScoringSet = {
  exerciseTitle: string;
  weightKg: number | null;
  reps: number | null;
  setType: string;
};

/** A workout with its raw sets, used by the scoring algorithm. */
export type ScoringWorkout = {
  startTime: string;
  durationSeconds: number;
  sets: ScoringSet[];
};

export type HealthSnapshot = {
  hasHevy: boolean;
  score: HealthScore;
  recentWorkouts: WorkoutSummary[];
  trainingDays: TrainingDay[];
  weekWorkoutCount: number;
  weekTotalVolumeLbs: number;
  lastSyncedAt: string | null;
  firstPageWorkouts: WorkoutSummary[];
  totalWorkouts: number;
  exerciseList: string[];
};

export type E1RMPoint = {
  date: string;
  e1rm: number;
};

export type StrengthTrend =
  | "gaining"
  | "plateau"
  | "declining"
  | "insufficient";

export type ExerciseStats = {
  exercise: string;
  trend: StrengthTrend;
  e1rmSeries: E1RMPoint[];
  volumeSeries: { date: string; volume: number }[];
  latestSets: { summary: string; date: string }[];
};

export type DetailedExercise = {
  title: string;
  sets: { index: number; type: string; weight: string; reps: string }[];
};

export type DetailedWorkoutSummary = WorkoutSummary & {
  exercises: DetailedExercise[];
};
