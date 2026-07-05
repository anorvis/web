import type {
  DetailedWorkoutSummary,
  ExerciseStats,
  WorkoutSummary,
} from "@/features/health/types/health";
import type { NativeHealthDashboard } from "@/features/health/types/native-health";
import { deleteJson, postJson, requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";

export function fetchHealthDashboard(): Promise<NativeHealthDashboard> {
  return runEffect(requestJson<NativeHealthDashboard>("/api/health/dashboard"));
}

export function postHealthForm(path: string, formData: FormData) {
  return runEffect(
    postJson<unknown>(path, Object.fromEntries(formData.entries())),
  );
}

export function searchFood(query: string, provider: string) {
  return runEffect(
    requestJson<{ results?: unknown[] }>(
      `/api/health/food-search?q=${encodeURIComponent(query)}&provider=${encodeURIComponent(provider)}`,
    ),
  ).catch(() => ({ results: [] }));
}

export function searchExercise(query: string) {
  return runEffect(
    requestJson<{ results?: unknown[] }>(
      `/api/health/exercise-search?q=${encodeURIComponent(query)}`,
    ),
  ).catch(() => ({ results: [] }));
}

export function deleteMealById(id: string) {
  return runEffect(deleteJson<unknown>("/api/health/meals", { id }));
}

export function fetchExerciseStats(exercise: string) {
  return runEffect(
    requestJson<ExerciseStats>(
      `/api/health/exercise-stats?exercise=${encodeURIComponent(exercise)}`,
    ),
  );
}

export function fetchWorkouts(input: { limit: number; offset: number }) {
  return runEffect(
    requestJson<{ workouts: WorkoutSummary[] }>(
      `/api/health/workouts?limit=${input.limit}&offset=${input.offset}`,
    ),
  );
}

export function fetchWorkoutDetail(id: string) {
  return runEffect(
    requestJson<DetailedWorkoutSummary>(
      `/api/health/workouts?id=${encodeURIComponent(id)}`,
    ),
  );
}
