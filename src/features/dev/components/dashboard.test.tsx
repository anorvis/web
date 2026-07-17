import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { normalizeUsageAnalytics, type UsageScope } from "@/features/dev/usage";
import type { AgentUsagePage } from "@/features/dev/utils/maintainer";
import { queryKeys } from "@/lib/query/keys";
import { AgentUsagePanel } from "./agent-usage";
import { DevPlatformDashboard } from "./dashboard";

const state = vi.hoisted(() => ({ activeTab: "operations" }));

const sessionsPage: AgentUsagePage = {
  sessions: [
    {
      sessionKey: "s1",
      scope: "foreground",
      host: "omp",
      provider: "anthropic",
      model: "claude-opus",
      messageCount: 12,
      totalTokens: 4200,
      usdCost: 1.25,
      lastSeenAt: "2026-07-15T10:00:00.000Z",
      reviewed: false,
      stage: null,
      outcome: null,
    },
  ],
  scope: "foreground",
  usagePeriod: "all" as const,
  usageSince: null,
  total: 10,
  analytics: {
    totals: {
      sessions: 10,
      messageCount: 84,
      inputTokens: 600_000,
      outputTokens: 300_000,
      cacheReadTokens: 400_000,
      cacheWriteTokens: 100_000,
      cacheTokens: 500_000,
      totalTokens: 2_000_000,
      usdCost: 12.5,
      outputLimitWarningCount: 3,
    },
    byModel: [
      {
        provider: "anthropic",
        model: "claude-opus",
        sessions: 10,
        messageCount: 84,
        inputTokens: 600_000,
        outputTokens: 300_000,
        cacheReadTokens: 400_000,
        cacheWriteTokens: 100_000,
        cacheTokens: 500_000,
        totalTokens: 2_000_000,
        usdCost: 12.5,
        outputLimitWarningCount: 3,
      },
    ],
    performance: {
      totals: {
        samples: 8,
        outputTokens: 280_000,
        generationMs: 6_588_235,
        tokensPerSecond: 42.5,
        timeToFirstTokenMs: 725,
      },
      byModel: [
        {
          modelKey: "anthropic/claude-opus",
          samples: 8,
          outputTokens: 280_000,
          generationMs: 6_588_235,
          tokensPerSecond: 42.5,
          timeToFirstTokenMs: 725,
          updatedAt: "2026-07-15T10:00:00.000Z",
        },
      ],
    },
  },
};

const maintainerPage: AgentUsagePage = {
  ...sessionsPage,
  scope: "maintainer" as const,
  usagePeriod: "current_month" as const,
  usageSince: "2026-07-01T00:00:00.000Z",
  sessions: [
    {
      ...sessionsPage.sessions[0],
      sessionKey: "ticket-17/worker",
      scope: "maintainer" as const,
      host: "background",
      reviewed: false,
      stage: "worker" as const,
      outcome: "fixed",
    },
  ],
};

// Static SSR renders read the store's initial state, so drive the tab
// through a mock instead of setState.
vi.mock("@/features/dev/stores/dev-store", () => ({
  useDevStore: () => ({
    activeTab: state.activeTab,
    setActiveTab: () => {},
  }),
}));

function renderDashboard(withUsage = false) {
  const client = new QueryClient();
  if (withUsage) {
    client.setQueryData(
      queryKeys.dev.agentUsage("foreground", 0),
      sessionsPage,
    );
  }
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(DevPlatformDashboard),
    ),
  );
}

function renderUsagePanel(scope: UsageScope, pageData: AgentUsagePage) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.dev.agentUsage(scope, 0), pageData);
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(AgentUsagePanel, { initialScope: scope }),
    ),
  );
}

describe("DevPlatformDashboard", () => {
  it("renders four analytics detail triggers and the sessions table from one operations view", () => {
    state.activeTab = "operations";
    const html = renderDashboard(true);

    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(4);
    expect(html).toContain("open spend and volume detail");
    expect(html).toContain("open token and cache efficiency detail");
    expect(html).toContain("open model mix detail");
    expect(html).toContain("open model performance detail");
    expect(html).toContain("// model performance · rolling");
    expect(html).toContain("Scope-isolated rolling throughput and latency.");
    expect(html).toContain('aria-label="interactive agent sessions"');
    expect(html).toContain("claude-opus");
    expect(html.indexOf("interactive agent usage analytics")).toBeLessThan(
      html.indexOf("// interactive sessions"),
    );
    expect(html).toContain("usage scope selector");
    expect(html).toMatch(/aria-pressed="true"[^>]*>interactive</);
    expect(html).toMatch(/aria-pressed="false"[^>]*>maintainer</);
    expect(html).not.toContain("maintainer usage · current month");
  });

  it("renders the maintainer query seed with run-specific columns and labels", () => {
    state.activeTab = "operations";
    const html = renderUsagePanel("maintainer", maintainerPage);

    expect(html).toContain("maintainer usage · current month");
    expect(html).toContain(
      "Background maintainer workers and private generalizers only",
    );
    expect(html).toContain("// model performance · rolling");
    expect(html).toContain('aria-label="background maintainer runs"');
    expect(html).toContain(">stage</th>");
    expect(html).toContain(">outcome</th>");
    expect(html).toContain("worker");
    expect(html).toContain("fixed");
    expect(html).not.toContain(">host</th>");
    expect(html).not.toContain(">review</th>");
    expect(html).not.toContain("interactive agent usage");
    expect(html).toMatch(/aria-pressed="false"[^>]*>interactive</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>maintainer</);
  });

  it("explains an empty background maintainer scope without foreground copy", () => {
    const html = renderUsagePanel("maintainer", {
      ...maintainerPage,
      sessions: [],
      total: 0,
      analytics: normalizeUsageAnalytics({
        performance: maintainerPage.analytics.performance,
      }),
    });

    expect(html).toContain("No maintainer runs recorded this month.");
    expect(html).toContain("Approved ticket runs will appear here.");
    expect(html).toContain("// model performance · rolling");
    expect(html).toContain("42.5 tok/s");
    expect(html).not.toContain("Interactive agent sessions will appear here");
  });

  it("shows the core OMP aggregate labels without the context-first panel", () => {
    state.activeTab = "operations";
    const html = renderDashboard(true);
    for (const label of [
      "total cost",
      "total tokens",
      "output tok/s",
      "cache hit rate",
      "sessions",
      "cost / session",
      "cost / M-token",
      "uncached input",
      "cache read",
      "cache write",
      "output tokens",
      "avg TTFT",
      "samples",
      "warnings",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("40.0%");
    expect(html).toContain("42.5 tok/s");
    expect(html).not.toContain("sanitized context");
  });

  it("keeps the maintainer tab to tickets first, then setup — no sessions", () => {
    state.activeTab = "maintainer";
    const html = renderDashboard();
    expect(html).not.toContain("// foreground sessions");

    const tickets = html.indexOf("maintenance tickets and pull requests");
    const setup = html.indexOf("Loading maintainer status");
    expect(tickets).toBeGreaterThanOrEqual(0);
    expect(setup).toBeGreaterThan(tickets);
  });
});
