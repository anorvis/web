import { describe, expect, it } from "vitest";
import { normalizeUsageAnalytics } from "./usage";

describe("normalizeUsageAnalytics", () => {
  it("keeps split cache facts and derives throughput from output and generation time", () => {
    const result = normalizeUsageAnalytics({
      totals: {
        sessions: 12,
        inputTokens: 300,
        outputTokens: 200,
        cacheReadTokens: 900,
        cacheWriteTokens: 100,
        totalTokens: 1_500,
        usdCost: 4.25,
      },
      byModel: [
        {
          provider: "anthropic",
          model: "claude",
          sessions: 8,
          totalTokens: 1_200,
          usdCost: 4,
        },
      ],
      performance: {
        totals: {
          samples: 4,
          outputTokens: 200,
          generationMs: 2_000,
          tokensPerSecond: 999,
          timeToFirstTokenMs: 320,
        },
        byModel: [
          {
            modelKey: "anthropic/claude",
            samples: 4,
            outputTokens: 180,
            generationMs: 1_500,
            timeToFirstTokenMs: 300,
            updatedAt: "2026-07-16T10:00:00.000Z",
          },
        ],
      },
    });

    expect(result.totals.cacheTokens).toBe(1_000);
    expect(result.totals.inputTokens).toBe(300);
    expect(result.byModel[0]).toMatchObject({
      provider: "anthropic",
      model: "claude",
      sessions: 8,
    });
    expect(result.performance.totals.tokensPerSecond).toBe(100);
    expect(result.performance.byModel[0]).toMatchObject({
      modelKey: "anthropic/claude",
      tokensPerSecond: 120,
      timeToFirstTokenMs: 300,
    });
  });

  it("fails closed on malformed and negative analytics", () => {
    const result = normalizeUsageAnalytics({
      totals: { sessions: -1, usdCost: "secret" },
      byModel: [null, { model: "", totalTokens: -2 }],
      performance: { totals: { outputTokens: 50, generationMs: 0 } },
    });

    expect(result.totals.sessions).toBe(0);
    expect(result.totals.usdCost).toBe(0);
    expect(result.byModel).toHaveLength(1);
    expect(result.byModel[0]?.model).toBe("unknown");
    expect(result.performance.totals.tokensPerSecond).toBe(0);
  });
});
