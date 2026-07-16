import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeContextOverview } from "../utils/context";
import { ContextPanelView } from "./context-panel";

describe("context operations panel", () => {
  it("renders sanitized metadata and monitor state without private payloads", () => {
    const overview = normalizeContextOverview({
      os: { ok: true, services: ["llm-wiki", "context", "os"] },
      context: {
        summaries: [
          {
            summary: "Owner planned the week.",
            scopeKind: "owner",
            visibility: "private",
            updatedAt: 1_752_600_000_000,
          },
        ],
        events: [
          {
            id: "evt-1",
            kind: "conversation_turn",
            surface: "pi",
            visibility: "private",
            occurredAt: 1_752_601_000_000,
          },
          {
            id: "evt-2",
            kind: "integration_update",
            surface: "integration",
            visibility: "shared",
            occurredAt: 1_752_602_000_000,
          },
        ],
        wikiPages: [{ path: "life/health.md", title: "Health" }],
      },
    });

    const html = renderToStaticMarkup(
      createElement(ContextPanelView, { overview }),
    );

    expect(html).toContain("os gateway");
    expect(html).toContain("online");
    expect(html).toContain("conversation turn");
    expect(html).toContain("integration update");
    expect(html).toContain("Owner planned the week.");
    expect(html).toContain("context service registered");
    expect(html).toContain("compile pipeline reachable");
    expect(html).toContain("life/health.md");
    expect(html).not.toContain("evt-1");
  });

  it("shows explicit degraded states instead of crashing", () => {
    const unavailable = normalizeContextOverview({
      os: { ok: true, services: ["os"] },
      context: null,
      contextError: "context client is not configured",
    });
    const unavailableHtml = renderToStaticMarkup(
      createElement(ContextPanelView, { overview: unavailable }),
    );
    expect(unavailableHtml).toContain("Shared context is unavailable");
    expect(unavailableHtml).toContain("compile pipeline offline");
    expect(unavailableHtml).toContain("context service missing");
    expect(unavailableHtml).not.toContain("context client is not configured");

    const emptyHtml = renderToStaticMarkup(
      createElement(ContextPanelView, {
        overview: normalizeContextOverview({
          os: { ok: true, services: ["context"] },
          context: { summaries: [], events: [], wikiPages: [] },
        }),
      }),
    );
    expect(emptyHtml).toContain(
      "Context events will appear after a connected surface records",
    );
    expect(emptyHtml).toContain("has not distilled any summaries yet");

    const errorHtml = renderToStaticMarkup(
      createElement(ContextPanelView, {
        overview: null,
        error: "failed at /Users/alice/private/project",
      }),
    );
    expect(errorHtml).toContain("Context data unavailable");
    expect(errorHtml).not.toContain("/Users/alice/private/project");
  });

  it("degrades finite out-of-range epochs to unavailable timestamps", () => {
    const overview = normalizeContextOverview({
      context: {
        summaries: [
          {
            summary: "Boundary summary",
            updatedAt: 8_640_000_000_000_001,
          },
        ],
        events: [
          {
            id: "boundary",
            occurredAt: Number.MAX_VALUE,
          },
        ],
        wikiPages: [],
      },
    });

    expect(overview.context?.summaries[0]?.updatedAt).toBeNull();
    expect(overview.context?.events[0]?.occurredAt).toBeNull();
  });

});
