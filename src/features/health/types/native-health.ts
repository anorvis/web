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
      durationSeconds?: number | null;
      distanceMeters?: number | null;
    }[];
  }[];
};

export type NativeHealthDashboard = {
  macroProfile: NativeMacroProfile | null;
  todayMeals: NativeMeal[];
  recentMeals: NativeMeal[];
  recentWorkouts: NativeWorkout[];
  measurementHistory: NativeMeasurement[];
};

export type NativeMeasurement = {
  id: string;
  source?: string;
  weightKg: number | null;
  leanMassKg?: number | null;
  bodyFatPercent: number | null;
  heightCm: number | null;
  neckCm?: number | null;
  shoulderCm?: number | null;
  chestCm?: number | null;
  leftBicepCm?: number | null;
  rightBicepCm?: number | null;
  leftForearmCm?: number | null;
  rightForearmCm?: number | null;
  abdomenCm?: number | null;
  waistCm?: number | null;
  hipsCm?: number | null;
  leftThighCm?: number | null;
  rightThighCm?: number | null;
  leftCalfCm?: number | null;
  rightCalfCm?: number | null;
  recordedAt: string;
};

export type NativeRecipeIngredient = {
  id: string;
  name: string;
  quantity: string | null;
};

export type NativeRecipe = {
  id: string;
  title: string;
  source: string;
  sourceId: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  youtubeUrl: string | null;
  category: string | null;
  area: string | null;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  isFavorite: boolean;
  notes: string | null;
  ingredients: NativeRecipeIngredient[];
  instructions: string[];
  createdAt: string;
  updatedAt: string;
};

export type NativeRecipeInput = Omit<
  NativeRecipe,
  "id" | "createdAt" | "updatedAt" | "ingredients"
> & { ingredients: { name: string; quantity: string | null }[] };

export type ExternalRecipeResult = {
  id: string;
  source: "themealdb";
  title: string;
  category: string | null;
  area: string | null;
  imageUrl: string | null;
  sourceUrl: string | null;
  youtubeUrl: string | null;
  ingredients: { name: string; quantity: string | null }[];
  instructions: string[];
};
