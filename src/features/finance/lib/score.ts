import type {
  MonthlySummary,
  ScorePillar,
  StabilityScore,
  Transaction,
} from "@/features/finance/types/finance";
import { isDebtPayment } from "./categorize";

// --- Monthly aggregation ---

export function buildMonthlySummaries(
  transactions: Transaction[],
): MonthlySummary[] {
  const months = new Map<string, { income: number; expenses: number }>();

  for (const t of transactions) {
    const month = t.date.slice(0, 7); // YYYY-MM
    const entry = months.get(month) ?? { income: 0, expenses: 0 };
    if (t.amount > 0) {
      entry.income += t.amount;
    } else {
      entry.expenses += Math.abs(t.amount);
    }
    months.set(month, entry);
  }

  return [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { income, expenses }]) => ({
      month,
      income,
      expenses,
      net: income - expenses,
      savingsRate: income > 0 ? (income - expenses) / income : 0,
    }));
}

// --- Pillar scorers ---

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

function scoreCashflow(summaries: MonthlySummary[]): ScorePillar {
  if (summaries.length === 0) {
    return {
      key: "cashflow",
      label: "cashflow",
      score: null,
      weight: 0.25,
      detail: "no data",
      trend: null,
    };
  }

  const totalIncome = summaries.reduce((s, m) => s + m.income, 0);
  const totalExpenses = summaries.reduce((s, m) => s + m.expenses, 0);
  const surplusRatio =
    totalIncome > 0 ? (totalIncome - totalExpenses) / totalIncome : 0;

  // 0% → 0, 10% → 50, 20%+ → 100 (linear interpolation)
  let score: number;
  if (surplusRatio <= 0) score = 0;
  else if (surplusRatio <= 0.1) score = (surplusRatio / 0.1) * 50;
  else if (surplusRatio <= 0.2) score = 50 + ((surplusRatio - 0.1) / 0.1) * 50;
  else score = 100;

  return {
    key: "cashflow",
    label: "cashflow",
    score: Math.round(clamp(score, 0, 100)),
    weight: 0.25,
    detail: `${Math.round(surplusRatio * 100)}% surplus ratio`,
    trend: null,
  };
}

function scoreLiquidity(
  monthlyExpenses: number,
  liquidBalance: number | null,
): ScorePillar {
  if (liquidBalance == null || monthlyExpenses <= 0) {
    return {
      key: "liquidity",
      label: "liquidity",
      score: null,
      weight: 0.25,
      detail: "no balance data",
      trend: null,
    };
  }

  const months = liquidBalance / monthlyExpenses;
  // 0mo → 0, 3mo → 50, 6mo+ → 100
  let score: number;
  if (months <= 0) score = 0;
  else if (months <= 3) score = (months / 3) * 50;
  else if (months <= 6) score = 50 + ((months - 3) / 3) * 50;
  else score = 100;

  return {
    key: "liquidity",
    label: "liquidity",
    score: Math.round(clamp(score, 0, 100)),
    weight: 0.25,
    detail: `${months.toFixed(1)} months runway`,
    trend: null,
  };
}

function scoreDebtLoad(
  transactions: Transaction[],
  summaries: MonthlySummary[],
): ScorePillar {
  const debtPayments = transactions.filter(
    (t) => t.amount < 0 && isDebtPayment(t.description),
  );

  if (debtPayments.length === 0) {
    return {
      key: "debtLoad",
      label: "debt load",
      score: null,
      weight: 0.2,
      detail: "no debt detected",
      trend: null,
    };
  }

  const monthCount = Math.max(summaries.length, 1);
  const monthlyDebt =
    debtPayments.reduce((s, t) => s + Math.abs(t.amount), 0) / monthCount;
  const monthlyIncome =
    summaries.reduce((s, m) => s + m.income, 0) / monthCount;
  const dti = monthlyIncome > 0 ? monthlyDebt / monthlyIncome : 1;

  // >50% → 0, 36% → 50, <10% → 100
  let score: number;
  if (dti >= 0.5) score = 0;
  else if (dti >= 0.36) score = ((0.5 - dti) / 0.14) * 50;
  else if (dti >= 0.1) score = 50 + ((0.36 - dti) / 0.26) * 50;
  else score = 100;

  return {
    key: "debtLoad",
    label: "debt load",
    score: Math.round(clamp(score, 0, 100)),
    weight: 0.2,
    detail: `${Math.round(dti * 100)}% dti`,
    trend: null,
  };
}

function scoreSavingsMomentum(summaries: MonthlySummary[]): ScorePillar {
  if (summaries.length < 2) {
    return {
      key: "savingsMomentum",
      label: "savings momentum",
      score: null,
      weight: 0.15,
      detail: "need 2+ months",
      trend: null,
    };
  }

  // EWMA (λ=0.3)
  const lambda = 0.3;
  let ewma = summaries[0].savingsRate;
  const ewmaFirst = ewma;
  for (let i = 1; i < summaries.length; i++) {
    ewma = lambda * summaries[i].savingsRate + (1 - lambda) * ewma;
  }

  // Score = 50 + (EWMA_latest - EWMA_first) × 200, clamped [0, 100]
  const score = clamp(Math.round(50 + (ewma - ewmaFirst) * 200), 0, 100);
  const trend: ScorePillar["trend"] =
    ewma > ewmaFirst + 0.02
      ? "up"
      : ewma < ewmaFirst - 0.02
        ? "down"
        : "stable";

  return {
    key: "savingsMomentum",
    label: "savings momentum",
    score,
    weight: 0.15,
    detail: `ewma ${(ewma * 100).toFixed(1)}%`,
    trend,
  };
}

function scoreIncomeStability(summaries: MonthlySummary[]): ScorePillar {
  if (summaries.length === 0) {
    return {
      key: "stability",
      label: "income stability",
      score: null,
      weight: 0.15,
      detail: "no data",
      trend: null,
    };
  }

  if (summaries.length === 1) {
    return {
      key: "stability",
      label: "income stability",
      score: 75, // neutral — spec: defaults to 75 with 1 month
      weight: 0.15,
      detail: "1 month — defaulting to neutral",
      trend: null,
    };
  }

  const incomes = summaries.map((m) => m.income).filter((i) => i > 0);
  if (incomes.length < 2) {
    return {
      key: "stability",
      label: "income stability",
      score: 75,
      weight: 0.15,
      detail: "insufficient income data",
      trend: null,
    };
  }

  const mean = incomes.reduce((a, b) => a + b, 0) / incomes.length;
  const variance =
    incomes.reduce((sum, v) => sum + (v - mean) ** 2, 0) / incomes.length;
  const cv = Math.sqrt(variance) / mean;

  let score: number;
  if (cv <= 0.05) score = 100;
  else if (cv <= 0.1) score = 90;
  else if (cv <= 0.15) score = 75;
  else if (cv <= 0.25) score = 55;
  else if (cv <= 0.35) score = 35;
  else score = 15;

  return {
    key: "stability",
    label: "income stability",
    score,
    weight: 0.15,
    detail: `cv ${(cv * 100).toFixed(1)}%`,
    trend: null,
  };
}

// --- Nudge generation ---

function generateNudge(pillars: ScorePillar[], overall: number): string {
  const momentum = pillars.find((p) => p.key === "savingsMomentum");
  const debt = pillars.find((p) => p.key === "debtLoad");
  const cashflow = pillars.find((p) => p.key === "cashflow");

  if (momentum?.trend === "up")
    return "savings rate trending up — keep it going";
  if (debt?.score != null && debt.score < 50)
    return "debt-to-income ratio above 36% — consider reducing obligations";
  if (cashflow?.score != null && cashflow.score < 30)
    return "expenses exceeding income — review spending categories";
  if (momentum?.trend === "down")
    return "savings rate declining — watch discretionary spending";
  if (overall >= 80)
    return "strong financial position — consider increasing investments";
  return "solid financial rhythm — keep tracking";
}

// --- Composite ---

export function calculateStabilityScore(
  transactions: Transaction[],
  liquidBalance: number | null,
): StabilityScore {
  const summaries = buildMonthlySummaries(transactions);
  const avgMonthlyExpenses =
    summaries.length > 0
      ? summaries.reduce((s, m) => s + m.expenses, 0) / summaries.length
      : 0;

  const pillars: ScorePillar[] = [
    scoreCashflow(summaries),
    scoreLiquidity(avgMonthlyExpenses, liquidBalance),
    scoreDebtLoad(transactions, summaries),
    scoreSavingsMomentum(summaries),
    scoreIncomeStability(summaries),
  ];

  // Weighted average of available pillars (null pillars excluded, weight redistributed)
  const active = pillars.filter((p) => p.score !== null);
  const totalWeight = active.reduce((s, p) => s + p.weight, 0);
  const weightedSum = active.reduce((s, p) => s + (p.score ?? 0) * p.weight, 0);
  const overall =
    totalWeight > 0 ? Math.round(clamp(weightedSum / totalWeight, 0, 100)) : 0;

  return {
    overall,
    pillars,
    nudge: generateNudge(pillars, overall),
  };
}
