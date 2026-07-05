import type { NativeHealthDashboard } from "@/features/health/types/native-health";
import { getWeekStart, toDateString } from "@/features/life/lib/calendar-utils";

export type FoodSearchResult = {
  id: string;
  name: string;
  calories: number;
  proteinGrams: number;
  carbsGrams: number;
  fatGrams: number;
  provider: string;
};

export type ExerciseSearchResult = {
  id: string;
  name: string;
  source: string;
  muscle?: string;
  equipment?: string;
};

export type WorkoutTemplate = {
  id: string;
  title: string;
  exercises: (typeof initialWorkoutExercise)[];
};

export const recipeStorageKey = "anorvis.health.recipes";
export const workoutTemplateStorageKey = "anorvis.health.workoutTemplates";

export const initialMeal = {
  id: "",
  name: "",
  mealType: "meal",
  calories: "",
  proteinGrams: "",
  carbsGrams: "",
  fatGrams: "",
  notes: "",
  loggedAt: "",
};

export const initialWorkout = {
  id: "",
  title: "",
  durationMinutes: "",
  notes: "",
  startedAt: "",
};

export const initialWorkoutExercise = {
  id: "exercise-0",
  title: "",
  sets: [{ id: "set-0", weightKg: "", reps: "" }],
};

export function createWorkoutExercise() {
  return {
    ...initialWorkoutExercise,
    id: crypto.randomUUID(),
    sets: [createWorkoutSet()],
  };
}

export function createWorkoutSet() {
  return {
    id: crypto.randomUUID(),
    weightKg: "",
    reps: "",
  };
}

export function readSavedRecipes(): FoodSearchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(
      localStorage.getItem(recipeStorageKey) ?? "[]",
    ) as unknown;
    return Array.isArray(value) ? (value as FoodSearchResult[]) : [];
  } catch {
    return [];
  }
}

export function readWorkoutTemplates(): WorkoutTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const value = JSON.parse(
      localStorage.getItem(workoutTemplateStorageKey) ?? "[]",
    ) as unknown;
    return Array.isArray(value) ? (value as WorkoutTemplate[]) : [];
  } catch {
    return [];
  }
}

export function kgToLb(value: number): number {
  return value * 2.20462;
}

export function lbToKg(value: number): number {
  return value / 2.20462;
}

export function cmToIn(value: number): number {
  return value / 2.54;
}

export function inToCm(value: number): number {
  return value * 2.54;
}

export function formatUnitValue(value: number): string {
  return Number.isFinite(value) ? String(Math.round(value * 10) / 10) : "";
}

export function sumMeals(meals: NativeHealthDashboard["todayMeals"]) {
  return meals.reduce(
    (total, meal) => ({
      calories: total.calories + meal.calories,
      protein: total.protein + meal.proteinGrams,
      carbs: total.carbs + meal.carbsGrams,
      fat: total.fat + meal.fatGrams,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function targetLine(dashboard: NativeHealthDashboard): string {
  const profile = dashboard.macroProfile;
  if (!profile) return "set macro goals to unlock next meal targets";
  const totals = sumMeals(dashboard.todayMeals);
  return `next: ~${Math.max(0, profile.proteinGrams - totals.protein)}g protein, ${Math.max(0, profile.carbsGrams - totals.carbs)}g carbs, <${Math.max(0, profile.fatGrams - totals.fat)}g fat`;
}

export function dietProgressLine(dashboard: NativeHealthDashboard): string {
  const profile = dashboard.macroProfile;
  if (!profile) return "configure goals to see today's macro progress";
  const totals = sumMeals(dashboard.todayMeals);
  const missing = [
    ["protein", profile.proteinGrams - totals.protein],
    ["carbs", profile.carbsGrams - totals.carbs],
    ["fat", profile.fatGrams - totals.fat],
  ]
    .filter(([, value]) => Number(value) > 0)
    .map(([label, value]) => `${Number(value)}g ${label}`);
  if (!missing.length) return "macro targets reached for today";
  return `missing ${missing.join(", ")} today`;
}

export function fitnessProgressLine(
  dashboard: NativeHealthDashboard,
  days = weekDays(),
): string {
  const profile = dashboard.macroProfile;
  const weeklyTarget = profile?.trainingDaysPerWeek ?? 0;
  if (!weeklyTarget) return "set a weekly training target to track progress";
  const completed = dashboard.recentWorkouts.filter((workout) => {
    const started = toDateString(new Date(workout.startedAt));
    return days.some((day) => day.key === started);
  }).length;
  const remaining = Math.max(0, weeklyTarget - completed);
  if (!remaining) return `${completed}/${weeklyTarget} workouts done this week`;
  return `${remaining} workout${remaining === 1 ? "" : "s"} left this week`;
}

export function weekDays(weekOffset = 0) {
  const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const sunday = getWeekStart(new Date());
  sunday.setDate(sunday.getDate() + weekOffset * 7);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(sunday);
    date.setDate(sunday.getDate() + index);
    return {
      key: toDateString(date),
      label: `${weekdayLabels[date.getDay()]}, ${date.getMonth() + 1}/${date.getDate()}`,
    };
  });
}

export function sameDay(iso: string, day: string) {
  return toDateString(new Date(iso)) === day;
}
