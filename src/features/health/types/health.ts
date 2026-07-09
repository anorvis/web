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
