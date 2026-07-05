import "server-only";

import type { ScoreFactor } from "@/features/health/types/health";

const TARGET_SESSIONS_PER_WEEK = 4;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// --- Factor: Consistency (0-100) ---

export function scoreConsistency(workoutDates: string[]): ScoreFactor {
  const target = TARGET_SESSIONS_PER_WEEK * 2;
  const actual = workoutDates.length;
  const adherence = Math.min(actual / target, 1.0);
  let score = adherence * 100;

  if (workoutDates.length >= 2) {
    const sorted = [...workoutDates].sort();
    const gaps: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const diff =
        (new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()) /
        86400000;
      gaps.push(diff);
    }
    const meanGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const variance =
      gaps.reduce((a, g) => a + (g - meanGap) ** 2, 0) / gaps.length;
    if (variance < 1) score += 10;
    else if (variance < 2) score += 5;

    if (gaps.some((g) => g >= 5)) score -= 15;
  }

  score = clamp(Math.round(score), 0, 100);

  const trend =
    score >= 80
      ? ("up" as const)
      : score >= 50
        ? ("stable" as const)
        : ("down" as const);

  return {
    key: "consistency",
    label: "consistency",
    score,
    trend,
    detail: `${actual} of ${target} sessions`,
  };
}

// --- Factor: ACWR / Load Balance (0-100) ---

export function scoreLoadBalance(dailyLoads: number[]): ScoreFactor {
  if (dailyLoads.length < 14) {
    return {
      key: "loadBalance",
      label: "load balance",
      score: null,
      trend: null,
      detail: `needs ${Math.max(14 - dailyLoads.length, 1)} more days`,
    };
  }

  const lambdaAcute = 2 / (7 + 1);
  const lambdaChronic = 2 / (28 + 1);

  let ewmaAcute = dailyLoads[0];
  let ewmaChronic = dailyLoads[0];

  for (let i = 1; i < dailyLoads.length; i++) {
    ewmaAcute = dailyLoads[i] * lambdaAcute + ewmaAcute * (1 - lambdaAcute);
    ewmaChronic =
      dailyLoads[i] * lambdaChronic + ewmaChronic * (1 - lambdaChronic);
  }

  if (ewmaChronic === 0) {
    return {
      key: "loadBalance",
      label: "load balance",
      score: 20,
      trend: "down",
      detail: "no chronic load",
    };
  }

  const acwr = ewmaAcute / ewmaChronic;

  let acwrScore: number;
  if (acwr >= 0.8 && acwr <= 1.3) acwrScore = 100;
  else if (acwr > 1.3) {
    acwrScore = acwr <= 1.5 ? Math.round(100 - ((acwr - 1.3) / 0.2) * 30) : 30;
  } else {
    acwrScore = acwr >= 0.5 ? Math.round(20 + ((acwr - 0.5) / 0.3) * 40) : 20;
  }

  const trend =
    acwr > 1.3
      ? ("down" as const)
      : acwr < 0.8
        ? ("down" as const)
        : ("up" as const);

  return {
    key: "loadBalance",
    label: "load balance",
    score: acwrScore,
    trend,
    detail: `acwr ${acwr.toFixed(2)}`,
  };
}

// --- Factor: Progressive Overload (0-100) ---

export function scoreOverload(weeklyVolumes: number[]): ScoreFactor {
  if (weeklyVolumes.length < 2) {
    return {
      key: "overload",
      label: "volume trend",
      score: null,
      trend: null,
      detail: `needs ${Math.max(2 - weeklyVolumes.length, 1)} more weeks`,
    };
  }

  const n = weeklyVolumes.length;
  const xMean = (n - 1) / 2;
  const yMean = weeklyVolumes.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (weeklyVolumes[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const pctChange = yMean === 0 ? 0 : slope / yMean;

  let overloadScore: number;
  if (pctChange >= 0.05) overloadScore = 100;
  else if (pctChange >= 0.02)
    overloadScore = Math.round(85 + ((pctChange - 0.02) / 0.03) * 15);
  else if (pctChange >= -0.02) overloadScore = 70;
  else if (pctChange >= -0.05)
    overloadScore = Math.round(50 + ((pctChange + 0.05) / 0.03) * 20);
  else overloadScore = 30;

  const trend =
    pctChange >= 0.02
      ? ("up" as const)
      : pctChange <= -0.02
        ? ("down" as const)
        : ("stable" as const);

  const pctStr =
    pctChange >= 0
      ? `+${(pctChange * 100).toFixed(0)}%`
      : `${(pctChange * 100).toFixed(0)}%`;

  return {
    key: "overload",
    label: "volume trend",
    score: overloadScore,
    trend,
    detail: `${pctStr} this month`,
  };
}

// --- Factor: Recovery (0-100) ---

export function scoreRecovery(dailyLoads7: number[]): ScoreFactor {
  if (dailyLoads7.length < 7) {
    return {
      key: "recovery",
      label: "recovery",
      score: null,
      trend: null,
      detail: `needs ${7 - dailyLoads7.length} more days`,
    };
  }

  const mean = dailyLoads7.reduce((a, b) => a + b, 0) / 7;
  const stddev = Math.sqrt(
    dailyLoads7.reduce((a, v) => a + (v - mean) ** 2, 0) / 7,
  );
  const monotony = stddev === 0 ? (mean === 0 ? 0 : 10) : mean / stddev;

  let score: number;
  if (monotony <= 1.5) score = Math.round(80 + ((1.5 - monotony) / 1.5) * 20);
  else if (monotony <= 2.0)
    score = Math.round(50 + ((2.0 - monotony) / 0.5) * 30);
  else score = Math.round(clamp(50 - ((monotony - 2.0) / 2.0) * 30, 20, 50));

  const restDays = dailyLoads7.filter((d) => d === 0).length;
  if (restDays >= 2) score += 10;
  else if (restDays === 0) score -= 20;

  let maxConsecutive = 0;
  let current = 0;
  for (const d of dailyLoads7) {
    if (d > 0) {
      current++;
      if (current > maxConsecutive) maxConsecutive = current;
    } else {
      current = 0;
    }
  }
  if (maxConsecutive === 4) score -= 5;
  else if (maxConsecutive >= 5) score -= 15;

  score = clamp(Math.round(score), 0, 100);

  const trend =
    score >= 70
      ? ("up" as const)
      : score >= 40
        ? ("stable" as const)
        : ("down" as const);

  const detail =
    restDays === 0
      ? "no rest in 7d"
      : maxConsecutive >= 4
        ? `${maxConsecutive} days straight`
        : `${restDays} rest days`;

  return { key: "recovery", label: "recovery", score, trend, detail };
}
