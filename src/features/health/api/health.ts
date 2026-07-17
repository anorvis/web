import {
  ExerciseBodySchema,
  ExerciseSetBodySchema,
  ExercisesJsonSchema,
} from "@/features/health/api/schemas";
import { bmrMifflinStJeor, tdee } from "@/features/health/lib/health-metrics";
import type {
  NativeHealthDashboard,
  NativeMacroProfile,
  NativeMeal,
  NativeMeasurement,
  NativeWorkout,
} from "@/features/health/types/native-health";
import type {
  ExerciseSearchResult,
  FoodSearchResult,
} from "@/features/health/utils/forms";
import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";
import { decodeUnknownResult } from "@/lib/effect/schema";

type ConvexRecord = Record<string, unknown>;

type HevyActionSettings = HevyConnectionSettings & { connected?: boolean };

function stringId(value: ConvexRecord): string {
  return String(value._id ?? value.id ?? "");
}

function isoFromMillis(value: unknown): string {
  const millis =
    typeof value === "number" && Number.isFinite(value) ? value : Date.now();
  return new Date(millis).toISOString();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function arrayOfRecords(value: unknown): ConvexRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ConvexRecord =>
          typeof item === "object" && item !== null && !Array.isArray(item),
      )
    : [];
}

function mealBodyFromForm(formData: FormData) {
  const body = Object.fromEntries(formData.entries());
  return {
    name: String(body.name || "meal"),
    mealType: String(body.mealType || "meal"),
    loggedAt: Date.parse(String(body.loggedAt || new Date().toISOString())),
    calories: Number(body.calories) || 0,
    proteinGrams: Number(body.proteinGrams) || 0,
    carbsGrams: Number(body.carbsGrams) || 0,
    fatGrams: Number(body.fatGrams) || 0,
    source: "manual" as const,
    notes: body.notes ? String(body.notes) : undefined,
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
  return {
    goal,
    sex,
    age,
    heightCm,
    weightKg,
    bodyFatPercent: body.bodyFatPercent
      ? Number(body.bodyFatPercent)
      : undefined,
    activityLevel: activity,
    birthdate: typeof body.birthdate === "string" ? body.birthdate : undefined,
    trainingDaysPerWeek: Number(body.trainingDaysPerWeek) || 3,
    targetCalories:
      positiveNumber(body.targetCalories) ?? calculatedTargetCalories,
    proteinGrams: positiveNumber(body.proteinGrams) ?? calculatedProteinGrams,
    carbsGrams: positiveNumber(body.carbsGrams) ?? calculatedCarbsGrams,
    fatGrams: positiveNumber(body.fatGrams) ?? calculatedFatGrams,
  };
}

function measurementBodyFromForm(formData: FormData) {
  const body = Object.fromEntries(formData.entries());
  const measurementFields = [
    "weightKg",
    "leanMassKg",
    "bodyFatPercent",
    "heightCm",
    "neckCm",
    "shoulderCm",
    "chestCm",
    "leftBicepCm",
    "rightBicepCm",
    "leftForearmCm",
    "rightForearmCm",
    "abdomenCm",
    "waistCm",
    "hipsCm",
    "leftThighCm",
    "rightThighCm",
    "leftCalfCm",
    "rightCalfCm",
  ] as const;
  return {
    recordedAt: Date.parse(String(body.recordedAt || new Date().toISOString())),
    source: "manual" as const,
    ...Object.fromEntries(
      measurementFields.map((field) => [
        field,
        body[field] === undefined || body[field] === ""
          ? undefined
          : Number(body[field]),
      ]),
    ),
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
            : undefined,
          reps: setRecord.value.reps ? Number(setRecord.value.reps) : undefined,
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
                  : undefined,
                reps: record.value.reps ? Number(record.value.reps) : undefined,
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
    startedAt: Date.parse(String(body.startedAt || new Date().toISOString())),
    durationSeconds: (Number(body.durationMinutes) || 45) * 60,
    notes: body.notes ? String(body.notes) : undefined,
    source: "manual" as const,
    exercises: parseWorkoutExercises(body.exercisesJson),
  };
}

function mapMeal(meal: ConvexRecord): NativeMeal {
  return {
    id: stringId(meal),
    name: String(meal.name ?? "meal"),
    mealType: String(meal.mealType ?? "meal"),
    loggedAt: isoFromMillis(meal.loggedAt),
    calories: optionalNumber(meal.calories) ?? 0,
    proteinGrams: optionalNumber(meal.proteinGrams) ?? 0,
    carbsGrams: optionalNumber(meal.carbsGrams) ?? 0,
    fatGrams: optionalNumber(meal.fatGrams) ?? 0,
    source: String(meal.source ?? "manual"),
    notes: optionalString(meal.notes),
    items: [],
  };
}

function mapMacroProfile(
  profile: ConvexRecord | null | undefined,
): NativeMacroProfile | null {
  if (!profile) return null;
  return {
    id: stringId(profile),
    goal: String(profile.goal ?? "maintain"),
    sex: String(profile.sex ?? "male"),
    age: optionalNumber(profile.age) ?? 30,
    heightCm: optionalNumber(profile.heightCm) ?? 0,
    weightKg: optionalNumber(profile.weightKg) ?? 0,
    bodyFatPercent: optionalNumber(profile.bodyFatPercent),
    activityLevel: String(profile.activityLevel ?? "moderate"),
    birthdate: optionalString(profile.birthdate),
    trainingDaysPerWeek: optionalNumber(profile.trainingDaysPerWeek) ?? 0,
    targetCalories: optionalNumber(profile.targetCalories) ?? 0,
    proteinGrams: optionalNumber(profile.proteinGrams) ?? 0,
    carbsGrams: optionalNumber(profile.carbsGrams) ?? 0,
    fatGrams: optionalNumber(profile.fatGrams) ?? 0,
    createdAt: isoFromMillis(profile.createdAt),
    updatedAt: isoFromMillis(profile.updatedAt),
  };
}

function mapMeasurement(measurement: ConvexRecord): NativeMeasurement {
  return {
    id: stringId(measurement),
    source: String(measurement.source ?? "manual"),
    weightKg: optionalNumber(measurement.weightKg),
    leanMassKg: optionalNumber(measurement.leanMassKg),
    bodyFatPercent: optionalNumber(
      measurement.bodyFatPercent ?? measurement.fatPercent,
    ),
    heightCm: optionalNumber(measurement.heightCm),
    neckCm: optionalNumber(measurement.neckCm),
    shoulderCm: optionalNumber(measurement.shoulderCm),
    chestCm: optionalNumber(measurement.chestCm),
    leftBicepCm: optionalNumber(measurement.leftBicepCm),
    rightBicepCm: optionalNumber(measurement.rightBicepCm),
    leftForearmCm: optionalNumber(measurement.leftForearmCm),
    rightForearmCm: optionalNumber(measurement.rightForearmCm),
    abdomenCm: optionalNumber(measurement.abdomenCm),
    waistCm: optionalNumber(measurement.waistCm),
    hipsCm: optionalNumber(measurement.hipsCm),
    leftThighCm: optionalNumber(measurement.leftThighCm),
    rightThighCm: optionalNumber(measurement.rightThighCm),
    leftCalfCm: optionalNumber(measurement.leftCalfCm),
    rightCalfCm: optionalNumber(measurement.rightCalfCm),
    recordedAt: isoFromMillis(measurement.recordedAt),
  };
}

function mapWorkout(workout: ConvexRecord): NativeWorkout {
  const exercises = arrayOfRecords(workout.exercises);
  return {
    id: stringId(workout),
    title: String(workout.title ?? "workout"),
    startedAt: isoFromMillis(workout.startedAt),
    durationSeconds: optionalNumber(workout.durationSeconds) ?? 0,
    notes: optionalString(workout.notes),
    source: String(workout.source ?? "manual"),
    exercises: exercises.map((exercise) => ({
      id: stringId(exercise),
      title: String(exercise.title ?? "exercise"),
      sets: arrayOfRecords(exercise.sets).map((set) => ({
        id: stringId(set),
        setType: String(set.setType ?? "normal"),
        weightKg: optionalNumber(set.weightKg),
        reps: optionalNumber(set.reps),
        durationSeconds: optionalNumber(set.durationSeconds),
        distanceMeters: optionalNumber(set.distanceMeters),
      })),
    })),
  };
}

function mapDashboard(payload: ConvexRecord): NativeHealthDashboard {
  return {
    macroProfile: mapMacroProfile(
      payload.macroProfile as ConvexRecord | null | undefined,
    ),
    todayMeals: arrayOfRecords(payload.todayMeals).map(mapMeal),
    recentMeals: arrayOfRecords(payload.recentMeals ?? payload.todayMeals).map(
      mapMeal,
    ),
    recentWorkouts: arrayOfRecords(payload.recentWorkouts).map(mapWorkout),
    measurementHistory: arrayOfRecords(
      payload.measurementHistory ?? payload.latestMeasurement,
    ).map(mapMeasurement),
  };
}

function todayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { dayStart: start.getTime(), dayEnd: end.getTime() };
}

export async function fetchHealthDashboard(): Promise<NativeHealthDashboard> {
  const dashboard = (await convexClient.query(
    convexApi.health.dashboard,
    todayBounds(),
  )) as ConvexRecord;
  return mapDashboard(dashboard);
}

export function postHealthForm(path: string, formData: FormData) {
  const body = Object.fromEntries(formData.entries());
  const id =
    typeof body.id === "string" && body.id.trim() ? body.id.trim() : undefined;
  if (path === "/api/health/meals") {
    return convexClient.mutation(convexApi.health.saveMeal, {
      id,
      ...mealBodyFromForm(formData),
    });
  }
  if (path === "/api/health/macro-profile") {
    return convexClient.mutation(
      convexApi.health.saveMacroProfile,
      macroProfileBodyFromForm(formData),
    );
  }
  if (path === "/api/health/measurements") {
    return convexClient.mutation(convexApi.health.saveBodyMeasurement, {
      id,
      ...measurementBodyFromForm(formData),
    });
  }
  if (path === "/api/health/native-workouts") {
    return convexClient.mutation(convexApi.health.saveWorkout, {
      id,
      ...workoutBodyFromForm(formData),
    });
  }
  return Promise.reject(new Error(`Unsupported health form endpoint: ${path}`));
}

export function searchFood(
  query: string,
  provider: string,
): Promise<{ results?: FoodSearchResult[] }> {
  return convexClient.action(convexApi.healthSearch.searchFood, {
    query,
    provider,
  }) as Promise<{ results?: FoodSearchResult[] }>;
}

export async function searchExercise(
  query: string,
): Promise<{ results: ExerciseSearchResult[] }> {
  const payload = await fetchHevyExerciseTemplates();
  const needle = query.trim().toLowerCase();
  return {
    results: payload.exerciseTemplates
      .filter(
        (exercise) => !needle || exercise.title.toLowerCase().includes(needle),
      )
      .map((exercise) => ({
        id: exercise.id,
        name: exercise.title,
        source: "hevy",
      })),
  };
}

export function deleteMealById(id: string) {
  return convexClient.mutation(convexApi.health.removeMeal, { id });
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

export async function fetchHevySettings(): Promise<HevyConnectionSettings> {
  const settings = (await convexClient.action(
    convexApi.hevy.settings,
    {},
  )) as HevyActionSettings;
  return {
    connected: Boolean(settings.connected ?? settings.hasApiKey),
    hasApiKey: Boolean(settings.hasApiKey ?? settings.connected),
    lastCheckedAt: settings.lastCheckedAt ?? null,
    secretProvider: settings.secretProvider ?? null,
  };
}

export function saveHevySettings(apiKey: string) {
  return convexClient.action(convexApi.hevy.saveSettings, { apiKey });
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
  return convexClient.action(
    convexApi.hevy.syncNow,
    {},
  ) as Promise<HevySyncSummary>;
}

export function fetchHevyRoutines(): Promise<{ routines: HevyRoutine[] }> {
  return convexClient.action(convexApi.hevy.listRoutines, {}) as Promise<{
    routines: HevyRoutine[];
  }>;
}

export function saveHevyRoutine(routine: HevyRoutine): Promise<HevyRoutine> {
  return convexClient.action(convexApi.hevy.saveRoutine, {
    routine,
  }) as Promise<HevyRoutine>;
}

export function fetchHevyExerciseTemplates(): Promise<{
  exerciseTemplates: HevyExerciseTemplate[];
}> {
  return convexClient.action(
    convexApi.hevy.listExerciseTemplates,
    {},
  ) as Promise<{
    exerciseTemplates: HevyExerciseTemplate[];
  }>;
}
