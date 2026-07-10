import type { Workout } from "@/lib/life-intelligence/model";

export const EXERCISE_HISTORY_PAGE_SIZE = 12;

export type ExerciseHistoryRow = {
  key: string;
  workoutTitle: string;
  startedAt: string;
  setNumber: number;
  set: Workout["exercises"][number]["sets"][number];
};

export function exerciseHistoryRows(
  workouts: Workout[],
  title: string,
): ExerciseHistoryRow[] {
  return workouts.flatMap((workout) =>
    workout.exercises.flatMap((exercise, exerciseIndex) =>
      exercise.title === title
        ? exercise.sets.map((set, setIndex) => ({
            key: `${workout.id}-${exerciseIndex}-${setIndex}`,
            workoutTitle: workout.title,
            startedAt: workout.startAt,
            setNumber: setIndex + 1,
            set,
          }))
        : [],
    ),
  );
}
