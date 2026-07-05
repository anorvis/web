import "server-only";

import type {
  HealthScore,
  ScoreFactor,
  ScoringSet,
  ScoringWorkout,
} from "@/features/health/types/health";
import {
  scoreConsistency,
  scoreLoadBalance,
  scoreOverload,
  scoreRecovery,
} from "./score-factors";

// --- Est 1RM & Inferred RPE ---

function est1RM(weightKg: number, reps: number): number {
  if (reps <= 0 || weightKg <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

function isWorkingSet(s: ScoringSet): boolean {
  return s.setType === "normal" || s.setType === "failure";
}

function buildEst1RMMap(workouts: ScoringWorkout[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of workouts) {
    for (const s of w.sets) {
      if (s.weightKg && s.reps && s.reps > 0 && isWorkingSet(s)) {
        const e = est1RM(s.weightKg, s.reps);
        const prev = map.get(s.exerciseTitle) ?? 0;
        if (e > prev) map.set(s.exerciseTitle, e);
      }
    }
  }
  return map;
}

const RPE_TABLE: [number, number][] = [
  [0.95, 10],
  [0.9, 9],
  [0.85, 8],
  [0.8, 7],
  [0.7, 6],
  [0.6, 5],
  [0, 4],
];

function inferRPE(relativeIntensity: number): number {
  for (const [threshold, rpe] of RPE_TABLE) {
    if (relativeIntensity >= threshold) return rpe;
  }
  return 4;
}

// --- Session Load (Foster's session-RPE method) ---

export function computeSessionLoad(
  workout: ScoringWorkout,
  est1RMMap: Map<string, number>,
): number {
  const working = workout.sets.filter(isWorkingSet);
  if (working.length === 0) return 0;

  let totalWeightedRPE = 0;
  let totalWeight = 0;
  let fallbackLoad = 0;
  let hasRPE = false;

  for (const s of working) {
    const max1RM = est1RMMap.get(s.exerciseTitle);
    if (max1RM && s.weightKg && s.weightKg > 0) {
      const ri = s.weightKg / max1RM;
      const rpe = inferRPE(ri);
      const w = (s.reps ?? 1) * s.weightKg;
      totalWeightedRPE += rpe * w;
      totalWeight += w;
      hasRPE = true;
    } else if (s.weightKg && s.reps) {
      fallbackLoad += (s.reps * s.weightKg) / 1000;
    }
  }

  const durationMin = workout.durationSeconds / 60;

  if (hasRPE && totalWeight > 0) {
    const avgRPE = totalWeightedRPE / totalWeight;
    return avgRPE * durationMin;
  }

  return fallbackLoad > 0 ? fallbackLoad * durationMin : durationMin;
}

// --- Composite ---

const FACTOR_WEIGHTS: Record<ScoreFactor["key"], number> = {
  consistency: 0.3,
  loadBalance: 0.25,
  overload: 0.25,
  recovery: 0.2,
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function computeHealthScore(
  factors: ScoreFactor[],
  workoutCount: number,
): HealthScore {
  const active = factors.filter((f) => f.score !== null);
  let overall: number | null = null;

  if (active.length > 0) {
    const totalWeight = active.reduce(
      (sum, f) => sum + FACTOR_WEIGHTS[f.key],
      0,
    );
    const weightedSum = active.reduce(
      (sum, f) => sum + (f.score ?? 0) * FACTOR_WEIGHTS[f.key],
      0,
    );
    overall = clamp(Math.round(weightedSum / totalWeight), 0, 100);
  }

  const confidence: HealthScore["confidence"] =
    workoutCount >= 20 ? "high" : workoutCount >= 5 ? "medium" : "low";

  const nudge = generateNudge(factors);

  return {
    overall,
    trainingScore: overall,
    factors,
    nudge,
    confidence,
    workoutCount,
  };
}

// --- Nudge Generation ---

function generateNudge(factors: ScoreFactor[]): string {
  const recovery = factors.find((f) => f.key === "recovery");
  const loadBalance = factors.find((f) => f.key === "loadBalance");
  const consistency = factors.find((f) => f.key === "consistency");
  const overload = factors.find((f) => f.key === "overload");

  // P1: consecutive training days ≥ 5
  const consecutiveMatch = recovery?.detail.match(/(\d+) days straight/);
  if (consecutiveMatch && Number(consecutiveMatch[1]) >= 5) {
    return `rest day — you've trained ${consecutiveMatch[1]} days straight`;
  }

  // P2: ACWR spike > 1.5
  const acwrMatch = loadBalance?.detail.match(/acwr ([\d.]+)/);
  if (acwrMatch && Number(acwrMatch[1]) > 1.5) {
    return "you've ramped up fast — dial back intensity this week";
  }

  // P3: no training in 4+ days (0 sessions in 14-day window)
  const sessionMatch = consistency?.detail.match(/^(\d+) of/);
  if (sessionMatch && Number(sessionMatch[1]) === 0) {
    return "time to get back in — even a light session helps";
  }

  // P4: ACWR detraining < 0.5
  if (acwrMatch && Number(acwrMatch[1]) < 0.5) {
    return "consistency is key — aim for 4 sessions this week";
  }

  // P5: volume declining
  if (overload?.trend === "down") {
    return "volume is trending down — try adding a set or increasing weight";
  }

  // P6: default
  return "solid rhythm — keep it up";
}

// --- Orchestrator ---

export function calculateTrainingScore(
  workouts: ScoringWorkout[],
): HealthScore {
  if (workouts.length === 0) {
    return computeHealthScore([], 0);
  }

  const est1RMMap = buildEst1RMMap(workouts);

  const now = new Date();
  const dailyLoads: number[] = [];
  const workoutDates14: string[] = [];

  for (let i = 27; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);

    const dayWorkouts = workouts.filter(
      (w) => w.startTime.slice(0, 10) === dateStr,
    );
    const dayLoad = dayWorkouts.reduce(
      (sum, w) => sum + computeSessionLoad(w, est1RMMap),
      0,
    );
    dailyLoads.push(dayLoad);

    if (i < 14 && dayWorkouts.length > 0) {
      workoutDates14.push(dateStr);
    }
  }

  const weeklyVolumes: number[] = [];
  for (let week = 0; week < 4; week++) {
    const start = week * 7;
    const end = start + 7;
    weeklyVolumes.push(dailyLoads.slice(start, end).reduce((a, b) => a + b, 0));
  }

  const factors: ScoreFactor[] = [
    scoreConsistency(workoutDates14),
    scoreLoadBalance(dailyLoads),
    scoreOverload(weeklyVolumes),
    scoreRecovery(dailyLoads.slice(-7)),
  ];

  return computeHealthScore(factors, workouts.length);
}
