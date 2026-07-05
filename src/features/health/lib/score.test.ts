import { describe, expect, it } from "vitest";

// We can't import server-only modules directly in tests, so we test
// the factor functions from score-factors.ts and test the composite
// logic by reimporting the non-server-only exports.

// For score.ts functions that have "server-only", we'll mock the import.
// But score-factors.ts also has "server-only". Let's use vi.mock to handle it.
import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { ScoringWorkout } from "@/features/health/types/health";
import {
  calculateTrainingScore,
  computeHealthScore,
  computeSessionLoad,
} from "./score";
import {
  scoreConsistency,
  scoreLoadBalance,
  scoreOverload,
  scoreRecovery,
} from "./score-factors";

// --- Est 1RM ---

describe("est1RM (via computeSessionLoad)", () => {
  it("Epley formula: 100kg × 8 reps ≈ 127kg", () => {
    // est1RM = 100 * (1 + 8/30) = 126.67
    // We test indirectly: a set at 100kg×8 should give relativeIntensity ≈ 0.79
    // which maps to RPE 7
    const workout: ScoringWorkout = {
      startTime: "2026-03-15T10:00:00Z",
      durationSeconds: 3600,
      sets: [
        { exerciseTitle: "bench", weightKg: 100, reps: 8, setType: "normal" },
      ],
    };
    const est1RMMap = new Map([["bench", 100 * (1 + 8 / 30)]]);
    const load = computeSessionLoad(workout, est1RMMap);
    // relativeIntensity = 100/126.67 ≈ 0.789 → RPE 6, durationMin = 60
    // load = 6 * 60 = 360
    expect(load).toBeCloseTo(360, -1);
  });
});

// --- Inferred RPE ---

describe("inferred RPE (via computeSessionLoad)", () => {
  it("heavy set: weight = 0.92 * est1RM → RPE 9", () => {
    const workout: ScoringWorkout = {
      startTime: "2026-03-15T10:00:00Z",
      durationSeconds: 600, // 10 min
      sets: [
        { exerciseTitle: "squat", weightKg: 138, reps: 1, setType: "normal" },
      ],
    };
    // est1RM = 150, relativeIntensity = 138/150 = 0.92 → RPE 9
    const est1RMMap = new Map([["squat", 150]]);
    const load = computeSessionLoad(workout, est1RMMap);
    expect(load).toBeCloseTo(9 * (600 / 60), 0); // 9 * 10 = 90
  });

  it("light set: weight = 0.55 * est1RM → RPE 4", () => {
    const workout: ScoringWorkout = {
      startTime: "2026-03-15T10:00:00Z",
      durationSeconds: 600,
      sets: [
        { exerciseTitle: "curl", weightKg: 11, reps: 15, setType: "normal" },
      ],
    };
    const est1RMMap = new Map([["curl", 20]]);
    const load = computeSessionLoad(workout, est1RMMap);
    // relativeIntensity = 11/20 = 0.55 → RPE 4
    expect(load).toBeCloseTo(4 * 10, 0);
  });
});

// --- Consistency ---

describe("scoreConsistency", () => {
  it("perfect adherence: 8 sessions in 14 days", () => {
    const dates = [
      "2026-03-05",
      "2026-03-07",
      "2026-03-09",
      "2026-03-11",
      "2026-03-12",
      "2026-03-14",
      "2026-03-16",
      "2026-03-18",
    ];
    const result = scoreConsistency(dates);
    expect(result.score).toBe(100);
  });

  it("half adherence: 4 sessions in 14 days", () => {
    // 4/8 = 50%, but evenly spaced (variance=0) adds +10 bonus → 60
    const dates = ["2026-03-05", "2026-03-09", "2026-03-13", "2026-03-17"];
    const result = scoreConsistency(dates);
    expect(result.score).toBe(60);
  });

  it("zero sessions", () => {
    const result = scoreConsistency([]);
    expect(result.score).toBe(0);
  });

  it("gap penalty: 6 sessions but one 6-day gap", () => {
    const dates = [
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
      "2026-03-12",
      "2026-03-13",
      "2026-03-14",
    ];
    const result = scoreConsistency(dates);
    expect(result.score).toBeLessThan(75);
  });
});

// --- Load Balance / ACWR ---

describe("scoreLoadBalance", () => {
  it("sweet spot: ACWR ≈ 1.0 → 100", () => {
    // Constant load → ACWR converges to 1.0
    const loads = Array(28).fill(100);
    const result = scoreLoadBalance(loads);
    expect(result.score).toBe(100);
  });

  it("spike: heavy recent load → low score", () => {
    // 21 days of low load, then 7 days of high load
    const loads = [...Array(21).fill(10), ...Array(7).fill(100)];
    const result = scoreLoadBalance(loads);
    expect(result.score).toBeLessThanOrEqual(70);
  });

  it("detraining: low recent, high chronic → low score", () => {
    const loads = [...Array(21).fill(100), ...Array(7).fill(5)];
    const result = scoreLoadBalance(loads);
    expect(result.score).toBeLessThan(100);
  });

  it("insufficient data: < 14 days → null", () => {
    const loads = Array(10).fill(50);
    const result = scoreLoadBalance(loads);
    expect(result.score).toBeNull();
  });
});

// --- Progressive Overload ---

describe("scoreOverload", () => {
  it("progressing +5%: weekly volumes trending up", () => {
    const result = scoreOverload([100, 105, 110, 116]);
    expect(result.score).toBeGreaterThanOrEqual(85);
  });

  it("maintaining: stable volumes", () => {
    const result = scoreOverload([100, 101, 99, 100]);
    expect(result.score).toBe(70);
  });

  it("declining -10%: volumes dropping", () => {
    const result = scoreOverload([100, 95, 88, 80]);
    expect(result.score).toBeLessThanOrEqual(50);
  });

  it("insufficient data: < 2 weeks → null", () => {
    const result = scoreOverload([100]);
    expect(result.score).toBeNull();
  });
});

// --- Recovery ---

describe("scoreRecovery", () => {
  it("good variation: mixed load with rest days", () => {
    const loads = [100, 0, 80, 0, 120, 0, 90];
    const result = scoreRecovery(loads);
    expect(result.score).toBeGreaterThanOrEqual(80);
  });

  it("no rest days: 7 consecutive training days", () => {
    const loads = [100, 100, 100, 100, 100, 100, 100];
    const result = scoreRecovery(loads);
    expect(result.score).toBeLessThanOrEqual(40);
  });

  it("insufficient data: < 7 days → null", () => {
    const loads = [100, 0, 80];
    const result = scoreRecovery(loads);
    expect(result.score).toBeNull();
  });
});

// --- Composite ---

describe("computeHealthScore", () => {
  it("all factors: weighted average", () => {
    const factors = [
      {
        key: "consistency" as const,
        label: "c",
        score: 100,
        trend: "up" as const,
        detail: "",
      },
      {
        key: "loadBalance" as const,
        label: "l",
        score: 80,
        trend: "up" as const,
        detail: "",
      },
      {
        key: "overload" as const,
        label: "o",
        score: 60,
        trend: "stable" as const,
        detail: "",
      },
      {
        key: "recovery" as const,
        label: "r",
        score: 40,
        trend: "down" as const,
        detail: "",
      },
    ];
    const result = computeHealthScore(factors, 20);
    // 100*0.3 + 80*0.25 + 60*0.25 + 40*0.2 = 30 + 20 + 15 + 8 = 73
    expect(result.overall).toBe(73);
  });

  it("partial data: 2 of 4 factors", () => {
    const factors = [
      {
        key: "consistency" as const,
        label: "c",
        score: 80,
        trend: "up" as const,
        detail: "",
      },
      {
        key: "loadBalance" as const,
        label: "l",
        score: null,
        trend: null,
        detail: "",
      },
      {
        key: "overload" as const,
        label: "o",
        score: null,
        trend: null,
        detail: "",
      },
      {
        key: "recovery" as const,
        label: "r",
        score: 60,
        trend: "stable" as const,
        detail: "",
      },
    ];
    const result = computeHealthScore(factors, 5);
    // Only consistency (0.3) and recovery (0.2) active
    // (80*0.3 + 60*0.2) / (0.3+0.2) = (24+12)/0.5 = 72
    expect(result.overall).toBe(72);
    expect(result.confidence).toBe("medium");
  });

  it("no data: overall is null", () => {
    const result = computeHealthScore([], 0);
    expect(result.overall).toBeNull();
    expect(result.confidence).toBe("low");
  });
});

// --- Nudge ---

describe("nudge generation", () => {
  it("consecutive days ≥ 5 → rest day nudge (P1)", () => {
    const factors = [
      {
        key: "consistency" as const,
        label: "",
        score: 80,
        trend: "up" as const,
        detail: "6 of 8 sessions",
      },
      {
        key: "loadBalance" as const,
        label: "",
        score: 100,
        trend: "up" as const,
        detail: "acwr 1.05",
      },
      {
        key: "overload" as const,
        label: "",
        score: 70,
        trend: "stable" as const,
        detail: "+1% this month",
      },
      {
        key: "recovery" as const,
        label: "",
        score: 30,
        trend: "down" as const,
        detail: "5 days straight",
      },
    ];
    const result = computeHealthScore(factors, 10);
    expect(result.nudge).toContain("rest day");
    expect(result.nudge).toContain("5");
  });

  it("all healthy → solid rhythm (P6)", () => {
    const factors = [
      {
        key: "consistency" as const,
        label: "",
        score: 90,
        trend: "up" as const,
        detail: "7 of 8 sessions",
      },
      {
        key: "loadBalance" as const,
        label: "",
        score: 100,
        trend: "up" as const,
        detail: "acwr 1.00",
      },
      {
        key: "overload" as const,
        label: "",
        score: 85,
        trend: "up" as const,
        detail: "+3% this month",
      },
      {
        key: "recovery" as const,
        label: "",
        score: 90,
        trend: "up" as const,
        detail: "3 rest days",
      },
    ];
    const result = computeHealthScore(factors, 20);
    expect(result.nudge).toContain("solid rhythm");
  });
});

// --- E2E: calculateTrainingScore ---

describe("calculateTrainingScore", () => {
  it("empty workouts → null overall", () => {
    const result = calculateTrainingScore([]);
    expect(result.overall).toBeNull();
    expect(result.workoutCount).toBe(0);
  });

  it("deterministic: same input → same output", () => {
    const workouts: ScoringWorkout[] = [
      {
        startTime: new Date(Date.now() - 86400000 * 2).toISOString(),
        durationSeconds: 3600,
        sets: [
          { exerciseTitle: "bench", weightKg: 80, reps: 8, setType: "normal" },
          { exerciseTitle: "bench", weightKg: 80, reps: 8, setType: "normal" },
          { exerciseTitle: "bench", weightKg: 80, reps: 8, setType: "normal" },
        ],
      },
    ];
    const a = calculateTrainingScore(workouts);
    const b = calculateTrainingScore(workouts);
    expect(a.overall).toBe(b.overall);
    expect(a.factors).toEqual(b.factors);
  });
});
