import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MaintenancePanelView } from "./maintenance-panel";
import { normalizeMaintenanceOverview } from "../utils/maintenance";

describe("maintenance operations panel", () => {
  it("renders sanitized usage and ticket state without private identifiers", () => {
    const overview = normalizeMaintenanceOverview({
      usage: {
        totals: {
          sessions: 2,
          messageCount: 12,
          inputTokens: 800,
          outputTokens: 200,
          cacheTokens: 400,
          totalTokens: 1_000,
          usdCost: 0.25,
          outputLimitWarningCount: 1,
        },
        recent: [
          {
            host: "private-workstation",
            sessionKey: "hashed-session-review-key",
            firstSeenAt: "2026-07-14T10:00:00.000Z",
            lastSeenAt: "2026-07-14T10:05:00.000Z",
            provider: "anthropic",
            model: "claude-sonnet",
            messageCount: 7,
            inputTokens: 600,
            outputTokens: 150,
            cacheTokens: 300,
            totalTokens: 750,
            usdCost: 0.2,
            outputLimitWarningCount: 1,
            reviewed: true,
          },
        ],
        byModel: [
          {
            provider: "anthropic",
            model: "claude-sonnet",
            messageCount: 12,
            inputTokens: 800,
            outputTokens: 200,
            cacheTokens: 400,
            totalTokens: 1_000,
            usdCost: 0.25,
            outputLimitWarningCount: 1,
          },
        ],
      },
      tickets: [
        {
          id: "private-ticket-id",
          status: "pending_approval",
          task: "Repair generalized output handoff behavior",
          project: "private-project-name",
          createdAt: "2026-07-14T09:00:00.000Z",
          updatedAt: "2026-07-14T09:10:00.000Z",
          result: {
            pullRequest: "https://github.com/anorvis/anorvis/pull/123",
            verification: ["focused command passed", "smoke check passed"],
            answer: "raw maintainer transcript",
          },
        },
      ],
    });

    const html = renderToStaticMarkup(
      createElement(MaintenancePanelView, { overview }),
    );

    expect(html).toContain("total tokens");
    expect(html).toContain("cache usage");
    expect(html).toContain("output limits");
    expect(html).toContain("claude-sonnet");
    expect(html).toContain("reviewed");
    expect(html).toContain("pending approval");
    expect(html).toContain("2 verification checks recorded");
    expect(html).toContain("https://github.com/anorvis/anorvis/pull/123");
    expect(html).not.toContain("hashed-session-review-key");
    expect(html).not.toContain("private-workstation");
    expect(html).not.toContain("private-ticket-id");
    expect(html).not.toContain("private-project-name");
    expect(html).not.toContain("raw maintainer transcript");
  });

  it("normalizes malformed data and gives empty and degraded guidance", () => {
    const overview = normalizeMaintenanceOverview({
      usage: {
        totals: { totalTokens: "not-a-number", usdCost: -1 },
        recent: [null, "invalid"],
        byModel: {},
      },
      tickets: [
        {
          status: "running",
          task: "inspect /Users/alice/private/project",
          pullRequest: "https://example.com/not-a-pr",
        },
      ],
    });
    expect(overview.usage.totals.totalTokens).toBe(0);
    expect(overview.usage.totals.usdCost).toBe(0);
    expect(overview.usage.recent).toEqual([]);
    expect(overview.tickets[0]?.task).toBe(
      "Generalized maintenance request",
    );
    expect(overview.tickets[0]?.pullRequest).toBeNull();

    const emptyHtml = renderToStaticMarkup(
      createElement(MaintenancePanelView, {
        overview: { ...overview, tickets: [] },
      }),
    );
    expect(emptyHtml).toContain("Session usage will appear");
    expect(emptyHtml).toContain("Monitor findings that need review");

    const errorHtml = renderToStaticMarkup(
      createElement(MaintenancePanelView, {
        overview: null,
        error: "failed at /Users/alice/private/project",
      }),
    );
    expect(errorHtml).toContain("Maintenance data unavailable");
    expect(errorHtml).not.toContain("/Users/alice/private/project");
  });
});
