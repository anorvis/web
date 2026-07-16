import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { normalizeMaintainerStatus } from "../utils/maintainer";
import { GithubTokenCard, ModelAuthCard } from "./maintainer-actions";
import { MaintainerPanelView } from "./maintainer-panel";
import { SessionsCardView } from "./maintainer-sessions";
import { TicketGroupCardView } from "./maintainer-tickets";

const noop = () => {};

const statusPayload = {
  enabled: true,
  sandboxCommand: { registered: true, path: "/opt/sandbox", exists: true },
  docker: false,
  sandboxImage: false,
  modelAuth: { vault: true, apiKeys: ["ANTHROPIC_API_KEY"] },
  githubToken: true,
  botBrowserSession: true,
  maintainerModel: "claude-opus",
  vaultSetupCommand: "PI_CODING_AGENT_DIR=/opt/sandbox/agent omp",
};

describe("MaintainerPanelView", () => {
  it("renders the checklist with pass/fail badges and remediation hints", () => {
    const html = renderToStaticMarkup(
      createElement(MaintainerPanelView, {
        status: normalizeMaintainerStatus(statusPayload),
      }),
    );

    expect(html).toContain("setup checklist");
    expect(html).toContain("pass");
    expect(html).toContain("fail");
    // Failing docker/image checks surface their remediation hints.
    expect(html).toContain("start Docker");
    expect(html).toContain("anorvis-sandbox image");
    // Passing checks keep their hints hidden.
    expect(html).not.toContain("flip the enable toggle");
    // 5 of 7 checks pass with docker and the image missing.
    expect(html).toContain("5/7");
    expect(html).toContain("claude-opus");
  });

  it("shows the loading and unavailable states", () => {
    const loading = renderToStaticMarkup(
      createElement(MaintainerPanelView, { status: null, loading: true }),
    );
    expect(loading).toContain('aria-busy="true"');

    const failed = renderToStaticMarkup(
      createElement(MaintainerPanelView, {
        status: null,
        error: "gateway offline",
      }),
    );
    expect(failed).toContain("Maintainer status unavailable");
  });
});

describe("ModelAuthCard", () => {
  it("offers the dedicated sandbox sign-in with the copyable fallback command", () => {
    const html = renderToStaticMarkup(
      createElement(ModelAuthCard, {
        status: normalizeMaintainerStatus({
          ...statusPayload,
          modelAuth: { vault: false, apiKeys: ["ANTHROPIC_API_KEY"] },
        }),
        onStatusChanged: noop,
        onVaultLoginStarted: noop,
      }),
    );

    expect(html).toContain("sign in sandbox vault");
    expect(html).toContain("PI_CODING_AGENT_DIR=/opt/sandbox/agent omp");
    expect(html).toContain("copy");
    expect(html).toContain("separate from");
    expect(html).toContain("vault not configured");
    expect(html).toContain("ANTHROPIC_API_KEY configured");
  });

  it("keeps the api key value field write-only", () => {
    const html = renderToStaticMarkup(
      createElement(ModelAuthCard, {
        status: normalizeMaintainerStatus(statusPayload),
        onStatusChanged: noop,
        onVaultLoginStarted: noop,
      }),
    );

    expect(html).toContain('type="password"');
    // Configured keys surface as presence badges only; no value is rendered.
    expect(html).toContain("ANTHROPIC_API_KEY configured");
    expect(html).toMatch(/type="password"[^>]*value=""/);
  });
});

describe("GithubTokenCard", () => {
  it("shows presence badges and an empty password field", () => {
    const html = renderToStaticMarkup(
      createElement(GithubTokenCard, {
        status: normalizeMaintainerStatus(statusPayload),
        onStatusChanged: noop,
      }),
    );

    expect(html).toContain("token configured");
    expect(html).toContain("browser session configured");
    expect(html).toContain('type="password"');
    expect(html).toMatch(/type="password"[^>]*value=""/);
  });
});

describe("TicketGroupCardView", () => {
  const ticket = {
    id: "t1",
    status: "running",
    task: "Fix the flaky monitor plan",
    project: "abc123",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
    pullRequest: "https://github.com/anorvis/os/pull/12",
  };

  it("renders tickets with status badges, PR links, and pagination", () => {
    const html = renderToStaticMarkup(
      createElement(TicketGroupCardView, {
        label: "running",
        tickets: [ticket],
        total: 45,
        page: 0,
        loading: false,
        error: null,
        onPage: noop,
      }),
    );

    expect(html).toContain("45 tickets");
    expect(html).toContain("Fix the flaky monitor plan");
    expect(html).toContain("https://github.com/anorvis/os/pull/12");
    expect(html).toContain("pull request");
    expect(html).toContain("45 total");
    expect(html).toContain("prev");
    expect(html).toContain("next");
    expect(html).toContain("1/3");
  });

  it("guides the operator when a group is empty", () => {
    const html = renderToStaticMarkup(
      createElement(TicketGroupCardView, {
        label: "pending approval",
        tickets: [],
        total: 0,
        page: 0,
        loading: false,
        error: null,
        onPage: noop,
      }),
    );
    expect(html).toContain("No pending approval tickets.");
  });
});

describe("SessionsCardView", () => {
  const session = {
    sessionKey: "s1",
    host: "omp",
    provider: "anthropic",
    model: "claude-opus",
    messageCount: 12,
    totalTokens: 4200,
    usdCost: 1.25,
    lastSeenAt: "2026-07-15T10:00:00.000Z",
    reviewed: false,
  };

  it("renders session usage rows with server-driven pagination", () => {
    const html = renderToStaticMarkup(
      createElement(SessionsCardView, {
        sessions: [session],
        total: 57,
        page: 1,
        loading: false,
        error: null,
        onPage: noop,
      }),
    );

    expect(html).toContain("57 sessions");
    expect(html).toContain("claude-opus");
    expect(html).toContain("$1.25");
    expect(html).toContain("unreviewed");
    expect(html).toContain("57 total");
    expect(html).toContain("2/3");
    expect(html).toContain("prev");
    expect(html).toContain("next");
  });

  it("guides the operator when no sessions exist yet", () => {
    const html = renderToStaticMarkup(
      createElement(SessionsCardView, {
        sessions: [],
        total: 0,
        page: 0,
        loading: false,
        error: null,
        onPage: noop,
      }),
    );
    expect(html).toContain("Maintainer sessions will appear here");
  });
});
