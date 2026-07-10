import { describe, expect, it } from "vitest";
import type {
  HevyExerciseTemplate,
  HevyRoutine,
  HevyRoutineSet,
} from "@/features/health/api/health";
import type { UnitSystem } from "@/features/health/stores/health-store";
import type {
  Exercise,
  ExerciseSet,
  Workout,
} from "@/lib/life-intelligence/model";
import {
  durationSecondsLabel,
  emptyHevyRoutineSet,
  hevyRoutineSetLine,
  hevyRoutineSummaries,
  routineExerciseFromTemplate,
  routineSummaries,
  setLine,
} from "./summaries";

// --- Fixtures ---

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

function workoutExercise(title: string): Exercise {
  return { title, muscleGroups: [], sets: [] };
}

function hevyRoutine(overrides: Partial<HevyRoutine> = {}): HevyRoutine {
  return {
    id: "r",
    title: "Routine",
    updatedAt: "2026-07-01T08:00:00.000Z",
    exercises: [],
    ...overrides,
  };
}

function hevyExercise(
  title: string,
  setCount: number,
): HevyRoutine["exercises"][number] {
  return {
    title,
    exerciseTemplateId: null,
    restSeconds: null,
    notes: null,
    supersetId: null,
    sets: Array.from({ length: setCount }, () => ({
      type: "normal",
      reps: null,
      weightKg: null,
      durationSeconds: null,
      distanceMeters: null,
      customMetric: null,
      repRange: null,
    })),
  };
}

function hevyRoutineSet(
  overrides: Partial<HevyRoutineSet> = {},
): HevyRoutineSet {
  return {
    type: "normal",
    reps: null,
    weightKg: null,
    durationSeconds: null,
    distanceMeters: null,
    customMetric: null,
    repRange: null,
    ...overrides,
  };
}

// --- setLine: a set line must surface reps, weight, and duration ---

describe("setLine", () => {
  const cases: Array<{ name: string; set: ExerciseSet; expected: string }> = [
    {
      name: "renders reps, weight, and duration together in a fixed order",
      set: { reps: 8, weightKg: 60, durationSeconds: 45 },
      expected: "8 reps · 60 kg · 45s",
    },
    {
      name: "keeps zero reps and zero weight (guarded on undefined, not falsy)",
      set: { reps: 0, weightKg: 0 },
      expected: "0 reps · 0 kg",
    },
    {
      name: "rounds weight to one decimal place",
      set: { weightKg: 20.25 },
      expected: "20.3 kg",
    },
    {
      name: "renders a cardio set as duration plus rounded distance",
      set: { durationSeconds: 1800, distanceMeters: 1000.25 },
      expected: "30m · 1000.3 m",
    },
    {
      name: "falls back to 'logged set' when nothing is recorded",
      set: {},
      expected: "logged set",
    },
  ];

  for (const { name, set, expected } of cases) {
    it(name, () => {
      expect(setLine(set)).toBe(expected);
    });
  }
});

// --- durationSecondsLabel: human duration with correct unit boundaries ---

describe("durationSecondsLabel", () => {
  const cases: Array<{ name: string; seconds: number; expected: string }> = [
    {
      name: "keeps sub-minute durations in seconds",
      seconds: 45,
      expected: "45s",
    },
    { name: "rounds to whole minutes", seconds: 90, expected: "2m" },
    {
      name: "labels a round hour without a minute remainder",
      seconds: 3600,
      expected: "1h",
    },
    {
      name: "labels hours with a minute remainder",
      seconds: 5400,
      expected: "1h 30m",
    },
    {
      name: "rolls 59.98 minutes up to a whole hour (not '60m')",
      seconds: 3599,
      expected: "1h",
    },
  ];

  for (const { name, seconds, expected } of cases) {
    it(name, () => {
      expect(durationSecondsLabel(seconds)).toBe(expected);
    });
  }
});

// --- hevyRoutineSummaries: real Hevy routine exercise/set counts ---

describe("hevyRoutineSummaries", () => {
  it("labels each exercise with its real set count, bare title when it has none", () => {
    const [summary] = hevyRoutineSummaries([
      hevyRoutine({
        title: "Upper",
        exercises: [hevyExercise("Bench Press", 3), hevyExercise("Plank", 0)],
      }),
    ]);

    expect(summary.exercises).toEqual(["Bench Press · 3 sets", "Plank"]);
  });

  it("tags summaries as hevy-sourced and carries updatedAt as latestAt", () => {
    const [summary] = hevyRoutineSummaries([
      hevyRoutine({ updatedAt: "2026-07-04T00:00:00.000Z" }),
    ]);

    expect(summary.source).toBe("hevy");
    expect(summary.latestAt).toBe("2026-07-04T00:00:00.000Z");
  });

  it("uses an empty latestAt when the routine has never been updated", () => {
    const [summary] = hevyRoutineSummaries([hevyRoutine({ updatedAt: null })]);

    expect(summary.latestAt).toBe("");
  });

  it("sorts routines alphabetically by title", () => {
    const result = hevyRoutineSummaries([
      hevyRoutine({ id: "z", title: "Zercher Day" }),
      hevyRoutine({ id: "a", title: "Arm Day" }),
    ]);

    expect(result.map((r) => r.title)).toEqual(["Arm Day", "Zercher Day"]);
  });

  it("returns nothing for no routines", () => {
    expect(hevyRoutineSummaries([])).toEqual([]);
  });
});

// --- routineSummaries: the inferred, workout-history fallback ---

describe("routineSummaries", () => {
  it("groups workouts by title, counts sessions, and dedupes inferred exercise titles without set counts", () => {
    const result = routineSummaries([
      workout({
        id: "1",
        title: "Push Day",
        exercises: [
          workoutExercise("Bench Press"),
          workoutExercise("Overhead Press"),
        ],
      }),
      workout({
        id: "2",
        title: "push day ",
        exercises: [workoutExercise("Bench Press"), workoutExercise("Dips")],
      }),
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "history:Push Day",
      title: "Push Day",
      count: 2,
      source: "history",
    });
    // Inferred from workout titles: deduped, first-seen order, no "· N sets".
    expect(result[0].exercises).toEqual([
      "Bench Press",
      "Overhead Press",
      "Dips",
    ]);
  });

  it("caps inferred exercises at 12", () => {
    const exercises = Array.from({ length: 15 }, (_, i) =>
      workoutExercise(`Ex${i}`),
    );
    const [summary] = routineSummaries([workout({ title: "Big", exercises })]);

    expect(summary.exercises).toHaveLength(12);
    expect(summary.exercises.at(0)).toBe("Ex0");
    expect(summary.exercises.at(-1)).toBe("Ex11");
  });

  it("sorts by session count then recency and reports the latest session time", () => {
    const result = routineSummaries([
      workout({ id: "a", title: "A", startAt: "2026-07-02T00:00:00.000Z" }),
      workout({ id: "b1", title: "B", startAt: "2026-07-01T00:00:00.000Z" }),
      workout({ id: "b2", title: "B", startAt: "2026-07-03T00:00:00.000Z" }),
      workout({ id: "c", title: "C", startAt: "2026-07-05T00:00:00.000Z" }),
    ]);

    expect(result.map((r) => r.title)).toEqual(["B", "C", "A"]);
    expect(result[0].latestAt).toBe("2026-07-03T00:00:00.000Z");
  });
});

// --- hevyRoutineSetLine: reps/range resolution, type label, and metric order ---

describe("hevyRoutineSetLine", () => {
  const cases: Array<{
    name: string;
    set: HevyRoutineSet;
    unitSystem?: UnitSystem;
    expected: string;
  }> = [
    {
      name: "renders an exact rep count",
      set: hevyRoutineSet({ reps: 12 }),
      expected: "12 reps",
    },
    {
      name: "renders a bounded rep range with an en dash",
      set: hevyRoutineSet({ repRange: { start: 8, end: 12 } }),
      expected: "8–12 reps",
    },
    {
      name: "renders a start-only range as an open-ended minimum",
      set: hevyRoutineSet({ repRange: { start: 5, end: null } }),
      expected: "5+ reps",
    },
    {
      name: "renders an end-only range as an upper bound",
      set: hevyRoutineSet({ repRange: { start: null, end: 15 } }),
      expected: "up to 15 reps",
    },
    {
      name: "prefers an exact rep count over a configured rep range",
      set: hevyRoutineSet({ reps: 10, repRange: { start: 8, end: 12 } }),
      expected: "10 reps",
    },
    {
      name: "labels a non-normal type and orders type, reps, weight, duration, distance, custom",
      set: hevyRoutineSet({
        type: "warmup",
        reps: 6,
        weightKg: 42.5,
        durationSeconds: 45,
        distanceMeters: 100,
        customMetric: 12.34,
      }),
      expected: "warmup · 6 reps · 42.5 kg · 45s · 100 m · 12.3 custom",
    },
    {
      name: "keeps zero metrics because fields guard on null, not falsiness",
      set: hevyRoutineSet({
        reps: 0,
        weightKg: 0,
        durationSeconds: 0,
        distanceMeters: 0,
        customMetric: 0,
      }),
      expected: "0 reps · 0 kg · 0s · 0 m · 0 custom",
    },
    {
      name: "falls back to 'unconfigured set' for a fresh empty set",
      set: emptyHevyRoutineSet(),
      expected: "unconfigured set",
    },
    {
      name: "renders metric weight as pounds under the imperial unit system",
      set: hevyRoutineSet({ weightKg: 42.5 }),
      unitSystem: "imperial",
      expected: "93.7 lb",
    },
    {
      name: "renders metric distance as feet under the imperial unit system",
      set: hevyRoutineSet({ distanceMeters: 100 }),
      unitSystem: "imperial",
      expected: "328.1 ft",
    },
    {
      name: "converts only weight and distance under imperial, leaving reps, duration, and custom untouched",
      set: hevyRoutineSet({
        type: "warmup",
        reps: 6,
        weightKg: 42.5,
        durationSeconds: 45,
        distanceMeters: 100,
        customMetric: 12.34,
      }),
      unitSystem: "imperial",
      expected: "warmup · 6 reps · 93.7 lb · 45s · 328.1 ft · 12.3 custom",
    },
  ];

  for (const { name, set, unitSystem, expected } of cases) {
    it(name, () => {
      expect(hevyRoutineSetLine(set, unitSystem)).toBe(expected);
    });
  }
});

// --- emptyHevyRoutineSet: each call yields an independent, mutation-safe set ---

describe("emptyHevyRoutineSet", () => {
  it("returns a distinct object per call so editing one set never leaks into another", () => {
    const first = emptyHevyRoutineSet();
    const second = emptyHevyRoutineSet();

    expect(first).not.toBe(second);

    first.reps = 5;
    first.repRange = { start: 3, end: 8 };

    expect(second.reps).toBeNull();
    expect(second.repRange).toBeNull();
  });
});

// --- routineExerciseFromTemplate: template-preserving routine exercise shape ---

describe("routineExerciseFromTemplate", () => {
  it("builds a full routine-exercise from a template with one empty normal set", () => {
    const template: HevyExerciseTemplate = {
      id: "tmpl-1",
      title: "Back Squat",
    };

    expect(routineExerciseFromTemplate(template)).toEqual({
      title: "Back Squat",
      exerciseTemplateId: "tmpl-1",
      restSeconds: null,
      notes: null,
      supersetId: null,
      sets: [
        {
          type: "normal",
          reps: null,
          weightKg: null,
          durationSeconds: null,
          distanceMeters: null,
          customMetric: null,
          repRange: null,
        },
      ],
    });
  });

  it("gives each generated exercise its own default set so edits never bleed across builds", () => {
    const template: HevyExerciseTemplate = {
      id: "tmpl-1",
      title: "Back Squat",
    };

    const first = routineExerciseFromTemplate(template);
    first.sets[0].reps = 8;

    const second = routineExerciseFromTemplate(template);

    expect(second.sets).not.toBe(first.sets);
    expect(second.sets[0]).not.toBe(first.sets[0]);
    expect(second.sets[0].reps).toBeNull();
  });
});
