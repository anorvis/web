export type NativeMacroProfile = {
  id: string;
  goal: string;
  sex: string;
  age: number;
  heightCm: number;
  weightKg: number;
  bodyFatPercent: number | null;
  activityLevel: string;
  birthdate: string | null;
  trainingDaysPerWeek: number;
  targetCalories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  createdAt: string;
  updatedAt: string;
};

export type NativeMeal = {
  id: string;
  name: string;
  mealType: string;
  loggedAt: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  source: string;
  notes: string | null;
  items: unknown[];
};

export type NativeWorkout = {
  id: string;
  title: string;
  startedAt: string;
  durationSeconds: number;
  notes: string | null;
  source: string;
  exercises: {
    id: string;
    title: string;
    sets: {
      id: string;
      setType: string;
      weightKg: number | null;
      reps: number | null;
    }[];
  }[];
};

export type NativeHealthDashboard = {
  macroProfile: NativeMacroProfile | null;
  todayMeals: NativeMeal[];
  recentMeals: NativeMeal[];
  recentWorkouts: NativeWorkout[];
  latestCheckin: {
    weightKg: number;
    adherencePercent: number;
    checkedInAt: string;
  } | null;
};
