import { isRecord } from "@/lib/guards";

export type UsageScope = "foreground" | "maintainer";

export type UsageTotals = {
  sessions: number;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  cacheTokens: number;
  totalTokens: number;
  usdCost: number;
  outputLimitWarningCount: number;
};

export type ModelUsage = UsageTotals & {
  provider: string;
  model: string;
};

export type PerformanceTotals = {
  samples: number;
  outputTokens: number;
  generationMs: number;
  tokensPerSecond: number;
  timeToFirstTokenMs: number;
};

export type ModelPerformance = PerformanceTotals & {
  modelKey: string;
  updatedAt: string | null;
};

export type UsageAnalytics = {
  totals: UsageTotals;
  byModel: ModelUsage[];
  performance: {
    totals: PerformanceTotals;
    byModel: ModelPerformance[];
  };
};

function amount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function usageTotals(value: unknown): UsageTotals {
  const row = isRecord(value) ? value : {};
  const cacheReadTokens = amount(row.cacheReadTokens);
  const cacheWriteTokens = amount(row.cacheWriteTokens);
  return {
    sessions: amount(row.sessions),
    messageCount: amount(row.messageCount),
    inputTokens: amount(row.inputTokens),
    outputTokens: amount(row.outputTokens),
    cacheReadTokens,
    cacheWriteTokens,
    cacheTokens: amount(row.cacheTokens) || cacheReadTokens + cacheWriteTokens,
    totalTokens: amount(row.totalTokens),
    usdCost: amount(row.usdCost),
    outputLimitWarningCount: amount(row.outputLimitWarningCount),
  };
}

function performanceTotals(value: unknown): PerformanceTotals {
  const row = isRecord(value) ? value : {};
  const outputTokens = amount(row.outputTokens);
  const generationMs = amount(row.generationMs);
  return {
    samples: amount(row.samples),
    outputTokens,
    generationMs,
    tokensPerSecond:
      generationMs > 0 ? (outputTokens * 1_000) / generationMs : 0,
    timeToFirstTokenMs: amount(row.timeToFirstTokenMs),
  };
}

export function normalizeUsageAnalytics(value: unknown): UsageAnalytics {
  const root = isRecord(value) ? value : {};
  const totals = usageTotals(root.totals);
  const byModel = (Array.isArray(root.byModel) ? root.byModel : [])
    .filter(isRecord)
    .map((row) => ({
      ...usageTotals(row),
      provider: text(row.provider, "unknown"),
      model: text(row.model, "unknown"),
    }));
  const performance = isRecord(root.performance) ? root.performance : {};
  return {
    totals,
    byModel,
    performance: {
      totals: performanceTotals(performance.totals),
      byModel: (Array.isArray(performance.byModel) ? performance.byModel : [])
        .filter(isRecord)
        .map((row) => ({
          ...performanceTotals(row),
          modelKey: text(row.modelKey, "unknown"),
          updatedAt:
            typeof row.updatedAt === "string" && row.updatedAt.trim()
              ? row.updatedAt
              : null,
        })),
    },
  };
}
