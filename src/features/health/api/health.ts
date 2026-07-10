import {
  ExerciseBodySchema,
  ExerciseSetBodySchema,
  ExercisesJsonSchema,
} from "@/features/health/api/schemas";
import { bmrMifflinStJeor, tdee } from "@/features/health/lib/health-metrics";
import type {
  DetailedWorkoutSummary,
  ExerciseStats,
  WorkoutSummary,
} from "@/features/health/types/health";
import type { NativeHealthDashboard } from "@/features/health/types/native-health";
import type { FoodSearchResult } from "@/features/health/utils/forms";
import { deleteJson, postJson, requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";
import { decodeUnknownResult } from "@/lib/effect/schema";
import {
  requestBrowserLocalJson,
  shouldUseBrowserLocalBackend,
} from "@/lib/local-backend-client";

function mealBodyFromForm(formData: FormData) {
  const body = Object.fromEntries(formData.entries());
  return {
    name: String(body.name || "meal"),
    mealType: String(body.mealType || "meal"),
    loggedAt: String(body.loggedAt || new Date().toISOString()),
    calories: Number(body.calories) || 0,
    proteinGrams: Number(body.proteinGrams) || 0,
    carbsGrams: Number(body.carbsGrams) || 0,
    fatGrams: Number(body.fatGrams) || 0,
    source: "manual",
    notes: body.notes ? String(body.notes) : null,
  };
}

function ageFromBirthdate(value: unknown): number {
  if (typeof value !== "string") return 30;
  const birthdate = new Date(value);
  if (Number.isNaN(birthdate.getTime())) return 30;
  const now = new Date();
  let age = now.getFullYear() - birthdate.getFullYear();
  const hadBirthday =
    now.getMonth() > birthdate.getMonth() ||
    (now.getMonth() === birthdate.getMonth() &&
      now.getDate() >= birthdate.getDate());
  if (!hadBirthday) age -= 1;
  return age > 0 ? age : 30;
}

function positiveNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

function macroProfileBodyFromForm(formData: FormData) {
  const body = Object.fromEntries(formData.entries());
  const weightKg = Number(body.weightKg) || 80;
  const heightCm = Number(body.heightCm) || 178;
  const age = ageFromBirthdate(body.birthdate);
  const sex = String(body.sex || "male");
  const activity = String(body.activityLevel || "moderate");
  const goal = String(body.goal || "maintain");
  const bmr = bmrMifflinStJeor({ weightKg, heightCm, age, sex });
  const calculatedTargetCalories = Math.round(
    tdee(bmr, activity) + (goal === "gain" ? 250 : goal === "lose" ? -350 : 0),
  );
  const calculatedProteinGrams = Math.round(
    weightKg * (goal === "gain" ? 2 : 1.8),
  );
  const calculatedFatGrams = Math.round(
    Math.max(weightKg * 0.6, (calculatedTargetCalories * 0.22) / 9),
  );
  const calculatedCarbsGrams = Math.max(
    0,
    Math.round(
      (calculatedTargetCalories -
        calculatedProteinGrams * 4 -
        calculatedFatGrams * 9) /
        4,
    ),
  );
  const targetCalories =
    positiveNumber(body.targetCalories) ?? calculatedTargetCalories;
  const proteinGrams =
    positiveNumber(body.proteinGrams) ?? calculatedProteinGrams;
  const fatGrams = positiveNumber(body.fatGrams) ?? calculatedFatGrams;
  const carbsGrams = positiveNumber(body.carbsGrams) ?? calculatedCarbsGrams;
  return {
    goal,
    sex,
    age,
    heightCm,
    weightKg,
    bodyFatPercent: body.bodyFatPercent ? Number(body.bodyFatPercent) : null,
    activityLevel: activity,
    birthdate: typeof body.birthdate === "string" ? body.birthdate : null,
    trainingDaysPerWeek: Number(body.trainingDaysPerWeek) || 3,
    targetCalories,
    proteinGrams,
    carbsGrams,
    fatGrams,
  };
}

function parseWorkoutExercises(value: unknown) {
  if (typeof value !== "string") return [];
  const decoded = decodeUnknownResult(ExercisesJsonSchema, value);
  if (!decoded.ok) return [];
  return decoded.value.flatMap((item) => {
    const record = decodeUnknownResult(ExerciseBodySchema, item);
    if (!record.ok) return [];
    const title = String(record.value.title || "").trim();
    if (!title) return [];
    const parsedSets = Array.isArray(record.value.sets)
      ? record.value.sets
      : [];
    const sets = parsedSets.flatMap((set) => {
      const setRecord = decodeUnknownResult(ExerciseSetBodySchema, set);
      if (!setRecord.ok) return [];
      return [
        {
          setType: "normal",
          weightKg: setRecord.value.weightKg
            ? Number(setRecord.value.weightKg)
            : null,
          reps: setRecord.value.reps ? Number(setRecord.value.reps) : null,
        },
      ];
    });
    return [
      {
        title,
        sets: sets.length
          ? sets
          : [
              {
                setType: "normal",
                weightKg: record.value.weightKg
                  ? Number(record.value.weightKg)
                  : null,
                reps: record.value.reps ? Number(record.value.reps) : null,
              },
            ],
      },
    ];
  });
}

function workoutBodyFromForm(formData: FormData) {
  const body = Object.fromEntries(formData.entries());
  return {
    title: String(body.title || "workout"),
    startedAt: String(body.startedAt || new Date().toISOString()),
    durationSeconds: (Number(body.durationMinutes) || 45) * 60,
    notes: body.notes ? String(body.notes) : null,
    source: "manual",
    exercises: parseWorkoutExercises(body.exercisesJson),
  };
}

export function fetchHealthDashboard(): Promise<NativeHealthDashboard> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<NativeHealthDashboard>(
      "/v1/health/dashboard",
    );
  }

  return runEffect(requestJson<NativeHealthDashboard>("/api/health/dashboard"));
}

export function postHealthForm(path: string, formData: FormData) {
  if (shouldUseBrowserLocalBackend()) {
    if (path === "/api/health/meals") {
      const body = Object.fromEntries(formData.entries());
      const id = typeof body.id === "string" ? body.id.trim() : "";
      return requestBrowserLocalJson<unknown>(
        id ? `/v1/health/meals/${encodeURIComponent(id)}` : "/v1/health/meals",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(mealBodyFromForm(formData)),
        },
      );
    }
    if (path === "/api/health/macro-profile") {
      return requestBrowserLocalJson<unknown>("/v1/health/macro-profile", {
        method: "POST",
        body: JSON.stringify(macroProfileBodyFromForm(formData)),
      });
    }
    if (path === "/api/health/native-workouts") {
      const body = Object.fromEntries(formData.entries());
      const id = typeof body.id === "string" ? body.id.trim() : "";
      return requestBrowserLocalJson<unknown>(
        id
          ? `/v1/health/workouts/${encodeURIComponent(id)}`
          : "/v1/health/workouts",
        {
          method: id ? "PUT" : "POST",
          body: JSON.stringify(workoutBodyFromForm(formData)),
        },
      );
    }
  }

  return runEffect(
    postJson<unknown>(path, Object.fromEntries(formData.entries())),
  );
}

export function searchFood(
  query: string,
  provider: string,
): Promise<{ results?: FoodSearchResult[] }> {
  const params = new URLSearchParams({ q: query, provider });
  const request = shouldUseBrowserLocalBackend()
    ? requestBrowserLocalJson<{ results?: FoodSearchResult[] }>(
        `/v1/integrations/food/search?${params.toString()}`,
      )
    : runEffect(
        requestJson<{ results?: FoodSearchResult[] }>(
          `/api/health/food-search?${params.toString()}`,
        ),
      );
  return request.catch(() => ({ results: [] }));
}

export function searchExercise(query: string) {
  return runEffect(
    requestJson<{ results?: unknown[] }>(
      `/api/health/exercise-search?q=${encodeURIComponent(query)}`,
    ),
  ).catch(() => ({ results: [] }));
}

export function deleteMealById(id: string) {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<unknown>(
      `/v1/health/meals/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  }

  return runEffect(deleteJson<unknown>("/api/health/meals", { id }));
}

export type HevyConnectionSettings = {
  connected: boolean;
  hasApiKey: boolean;
  lastCheckedAt: string | null;
  secretProvider: string | null;
};

export type HevyRoutineSet = {
  type: string;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  customMetric: number | null;
  repRange: { start: number | null; end: number | null } | null;
};

export type HevyRoutine = {
  id: string;
  title: string;
  updatedAt: string | null;
  exercises: Array<{
    title: string;
    exerciseTemplateId: string | null;
    restSeconds: number | null;
    notes: string | null;
    supersetId: number | null;
    sets: HevyRoutineSet[];
  }>;
};

export type HevyExerciseTemplate = {
  id: string;
  title: string;
};

export function fetchHevySettings(): Promise<HevyConnectionSettings> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<HevyConnectionSettings>(
      "/v1/integrations/hevy/settings",
    );
  }

  return runEffect(
    requestJson<HevyConnectionSettings>("/api/integrations/hevy/settings"),
  );
}

export function saveHevySettings(apiKey: string) {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<unknown>("/v1/integrations/hevy/settings", {
      method: "POST",
      body: JSON.stringify({ apiKey }),
    });
  }

  return runEffect(
    postJson<unknown>("/api/integrations/hevy/settings", { apiKey }),
  );
}

export type HevySyncSummary = {
  fetched: number;
  created: number;
  updated: number;
  measurementsFetched?: number;
  measurementsCreated?: number;
  measurementsUpdated?: number;
};

export function syncHevy(): Promise<HevySyncSummary> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<HevySyncSummary>(
      "/v1/integrations/hevy/sync",
      {
        method: "POST",
      },
    );
  }

  return runEffect(
    postJson<HevySyncSummary>("/api/integrations/hevy/sync", {}),
  );
}

export function fetchHevyRoutines(): Promise<{ routines: HevyRoutine[] }> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<{ routines: HevyRoutine[] }>(
      "/v1/integrations/hevy/routines",
    );
  }

  return runEffect(
    requestJson<{ routines: HevyRoutine[] }>("/api/integrations/hevy/routines"),
  );
}

export function saveHevyRoutine(routine: HevyRoutine): Promise<HevyRoutine> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<HevyRoutine>(
      `/v1/integrations/hevy/routines/${encodeURIComponent(routine.id)}`,
      {
        method: "PUT",
        body: JSON.stringify(routine),
      },
    );
  }

  return runEffect(
    requestJson<HevyRoutine>(
      `/api/integrations/hevy/routines?routineId=${encodeURIComponent(routine.id)}`,
      { method: "PUT", body: JSON.stringify(routine) },
    ),
  );
}

export function fetchHevyExerciseTemplates(): Promise<{
  exerciseTemplates: HevyExerciseTemplate[];
}> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<{
      exerciseTemplates: HevyExerciseTemplate[];
    }>("/v1/integrations/hevy/exercise-templates");
  }

  return runEffect(
    requestJson<{ exerciseTemplates: HevyExerciseTemplate[] }>(
      "/api/integrations/hevy/exercise-templates",
    ),
  );
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
