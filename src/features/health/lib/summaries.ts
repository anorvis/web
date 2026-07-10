import type {
  HevyExerciseTemplate,
  HevyRoutine,
  HevyRoutineSet,
} from "@/features/health/api/health";
import type { UnitSystem } from "@/features/health/stores/health-store";
import { kgToLb, metersToFeet } from "@/features/health/utils/forms";
import type { Exercise, Workout } from "@/lib/life-intelligence/model";

export type RoutineSummary = {
  id: string;
  title: string;
  count: number;
  latestAt: string;
  exercises: string[];
  source: "hevy" | "history";
};

export function hevyRoutineSummaries(
  routines: HevyRoutine[],
): RoutineSummary[] {
  return routines
    .map((routine) => ({
      id: routine.id,
      title: routine.title,
      count: 1,
      latestAt: routine.updatedAt ?? "",
      exercises: routine.exercises.map((exercise) => {
        const setCount = exercise.sets.length;
        return setCount
          ? `${exercise.title} · ${setCount} sets`
          : exercise.title;
      }),
      source: "hevy" as const,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function routineSummaries(workouts: Workout[]): RoutineSummary[] {
  const byTitle = new Map<string, { workouts: Workout[]; title: string }>();
  for (const workout of workouts) {
    const key = workout.title.trim().toLowerCase();
    const entry = byTitle.get(key) ?? { workouts: [], title: workout.title };
    entry.workouts.push(workout);
    byTitle.set(key, entry);
  }
  return Array.from(byTitle.values())
    .map(({ workouts, title }) => ({
      id: `history:${title}`,
      title,
      count: workouts.length,
      latestAt:
        workouts
          .map((workout) => workout.startAt)
          .sort()
          .at(-1) ??
        workouts[0]?.startAt ??
        new Date().toISOString(),
      exercises: Array.from(
        new Set(
          workouts.flatMap((workout) =>
            workout.exercises.map((exercise) => exercise.title),
          ),
        ),
      ).slice(0, 12),
      source: "history" as const,
    }))
    .sort((a, b) => b.count - a.count || b.latestAt.localeCompare(a.latestAt));
}

export function setLine(set: Exercise["sets"][number]) {
  const parts = [
    set.reps === undefined ? null : `${set.reps} reps`,
    set.weightKg === undefined ? null : `${roundOne(set.weightKg)} kg`,
    set.durationSeconds === undefined
      ? null
      : durationSecondsLabel(set.durationSeconds),
    set.distanceMeters === undefined
      ? null
      : `${roundOne(set.distanceMeters)} m`,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : "logged set";
}

export function durationSecondsLabel(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

export function roundOne(value: number) {
  return Math.round(value * 10) / 10;
}

export function emptyHevyRoutineSet(): HevyRoutineSet {
  return {
    type: "normal",
    reps: null,
    weightKg: null,
    durationSeconds: null,
    distanceMeters: null,
    customMetric: null,
    repRange: null,
  };
}

export function hevyRoutineSetLine(
  set: HevyRoutineSet,
  unitSystem: UnitSystem = "metric",
) {
  const repRange = set.repRange;
  const reps =
    set.reps !== null
      ? `${set.reps} reps`
      : repRange?.start !== null && repRange?.start !== undefined
        ? repRange.end !== null
          ? `${repRange.start}–${repRange.end} reps`
          : `${repRange.start}+ reps`
        : repRange?.end !== null && repRange?.end !== undefined
          ? `up to ${repRange.end} reps`
          : null;
  const weight =
    set.weightKg === null
      ? null
      : unitSystem === "imperial"
        ? `${roundOne(kgToLb(set.weightKg))} lb`
        : `${roundOne(set.weightKg)} kg`;
  const distance =
    set.distanceMeters === null
      ? null
      : unitSystem === "imperial"
        ? `${roundOne(metersToFeet(set.distanceMeters))} ft`
        : `${roundOne(set.distanceMeters)} m`;
  const parts = [
    set.type === "normal" ? null : set.type,
    reps,
    weight,
    set.durationSeconds === null
      ? null
      : durationSecondsLabel(set.durationSeconds),
    distance,
    set.customMetric === null ? null : `${roundOne(set.customMetric)} custom`,
  ].filter((part): part is string => Boolean(part));
  return parts.length ? parts.join(" · ") : "unconfigured set";
}

export function routineExerciseFromTemplate(
  template: HevyExerciseTemplate,
): HevyRoutine["exercises"][number] {
  return {
    title: template.title,
    exerciseTemplateId: template.id,
    restSeconds: null,
    notes: null,
    supersetId: null,
    sets: [emptyHevyRoutineSet()],
  };
}
