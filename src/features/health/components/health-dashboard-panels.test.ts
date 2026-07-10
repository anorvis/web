import { describe, expect, it } from "vitest";
import {
  EXERCISE_HISTORY_PAGE_SIZE,
  exerciseHistoryRows,
} from "@/features/health/lib/exercise-history";
import type {
  Exercise,
  ExerciseSet,
  Workout,
} from "@/lib/life-intelligence/model";

// --- Fixtures ---

function set(overrides: Partial<ExerciseSet> = {}): ExerciseSet {
  return { reps: 10, ...overrides };
}

function exercise(title: string, sets: ExerciseSet[]): Exercise {
  return { title, muscleGroups: [], sets };
}

function workout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "w",
    title: "Workout",
    startAt: "2026-07-01T08:00:00.000Z",
    exercises: [],
    createdAt: "2026-07-01T08:00:00.000Z",
    updatedAt: "2026-07-01T08:00:00.000Z",
    ...overrides,
  };
}

// --- exerciseHistoryRows: flatten matching sets into per-set rows ---

describe("exerciseHistoryRows", () => {
  it("flattens each matching set across workouts into its own ordered row", () => {
    const morningSets = [set({ reps: 10 }), set({ reps: 20 })];
    const eveningSets = [set({ reps: 30 })];
    const morning = workout({
      id: "wa",
      title: "Morning",
      startAt: "2026-07-01T08:00:00.000Z",
      exercises: [exercise("Bench", morningSets)],
    });
    const evening = workout({
      id: "wb",
      title: "Evening",
      startAt: "2026-07-02T18:00:00.000Z",
      exercises: [exercise("Bench", eveningSets)],
    });

    const rows = exerciseHistoryRows([morning, evening], "Bench");

    // One row per set, in workout-then-set order, with 1-based setNumber
    // that resets per exercise and workout metadata carried through.
    expect(rows).toEqual([
      {
        key: "wa-0-0",
        workoutTitle: "Morning",
        startedAt: "2026-07-01T08:00:00.000Z",
        setNumber: 1,
        set: morningSets[0],
      },
      {
        key: "wa-0-1",
        workoutTitle: "Morning",
        startedAt: "2026-07-01T08:00:00.000Z",
        setNumber: 2,
        set: morningSets[1],
      },
      {
        key: "wb-0-0",
        workoutTitle: "Evening",
        startedAt: "2026-07-02T18:00:00.000Z",
        setNumber: 1,
        set: eveningSets[0],
      },
    ]);
    // The carried set is the same reference, not a copy.
    expect(rows[0].set).toBe(morningSets[0]);
  });

  it("excludes exercises whose title does not match and keys by absolute exercise index", () => {
    const squatSets = [set({ reps: 5 }), set({ reps: 6 })];
    const benchSet = set({ reps: 8 });
    const session = workout({
      id: "w",
      exercises: [exercise("Squat", squatSets), exercise("Bench", [benchSet])],
    });

    const rows = exerciseHistoryRows([session], "Bench");

    expect(rows).toHaveLength(1);
    // Bench is the second exercise (index 1); the key must use its absolute
    // position, not its position among matches.
    expect(rows[0].key).toBe("w-1-0");
    expect(rows[0].set).toBe(benchSet);
    // No squat set leaks into the result.
    expect(rows.map((r) => r.set)).not.toContain(squatSets[0]);
    expect(rows.map((r) => r.set)).not.toContain(squatSets[1]);
  });

  it("keeps duplicate matching exercises within one workout as distinct rows", () => {
    const firstBench = set({ reps: 11 });
    const secondBench = set({ reps: 12 });
    const session = workout({
      id: "w",
      exercises: [
        exercise("Bench", [firstBench]),
        exercise("Curl", [set()]),
        exercise("Bench", [secondBench]),
      ],
    });

    const rows = exerciseHistoryRows([session], "Bench");

    expect(rows).toHaveLength(2);
    // Distinct keys via the exercise index disambiguate identical set data.
    expect(rows.map((r) => r.key)).toEqual(["w-0-0", "w-2-0"]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
    // Both are the first set of their own exercise.
    expect(rows.map((r) => r.setNumber)).toEqual([1, 1]);
    expect(rows.map((r) => r.set)).toEqual([firstBench, secondBench]);
  });

  it("returns no rows when nothing matches the requested title", () => {
    const session = workout({ exercises: [exercise("Squat", [set()])] });

    expect(exerciseHistoryRows([session], "Bench")).toEqual([]);
  });
});

// --- EXERCISE_HISTORY_PAGE_SIZE: flattened rows paginate by set, not workout ---

describe("exercise history pagination", () => {
  it("pages flattened set rows by set count, spilling a non-multiple total across full pages plus a partial last page", () => {
    // A deliberate non-multiple of the page size (2 * size + 1) logged across
    // only two workouts. Pagination is over flattened set rows, so two workout
    // appearances still spill into three pages — the exact regression: paging
    // by appearance would yield at most two.
    const firstCount = EXERCISE_HISTORY_PAGE_SIZE;
    const secondCount = EXERCISE_HISTORY_PAGE_SIZE + 1;
    const first = workout({
      id: "wa",
      exercises: [
        exercise(
          "Bench",
          Array.from({ length: firstCount }, (_, i) => set({ reps: i })),
        ),
      ],
    });
    const second = workout({
      id: "wb",
      exercises: [
        exercise(
          "Bench",
          Array.from({ length: secondCount }, (_, i) => set({ reps: 100 + i })),
        ),
      ],
    });

    const rows = exerciseHistoryRows([first, second], "Bench");
    expect(rows).toHaveLength(EXERCISE_HISTORY_PAGE_SIZE * 2 + 1);

    const pages: (typeof rows)[] = [];
    for (
      let start = 0;
      start < rows.length;
      start += EXERCISE_HISTORY_PAGE_SIZE
    ) {
      pages.push(rows.slice(start, start + EXERCISE_HISTORY_PAGE_SIZE));
    }

    // The dashboard's page-count formula over a non-multiple total.
    const pageCount = Math.ceil(rows.length / EXERCISE_HISTORY_PAGE_SIZE);
    expect(pageCount).toBe(3);
    expect(pages).toHaveLength(3);
    // Two full pages then a 1-row remainder, and every row lands on exactly one
    // page in order (no drops, no duplicates).
    expect(pages.map((page) => page.length)).toEqual([
      EXERCISE_HISTORY_PAGE_SIZE,
      EXERCISE_HISTORY_PAGE_SIZE,
      1,
    ]);
    expect(pages.flat()).toEqual(rows);
  });
});
