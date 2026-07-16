import { describe, expect, it, vi } from "vitest";
import {
  buildCredentialsPayload,
  emptyCredentialsInput,
  type MaintainerStatus,
  maintainerChecks,
  normalizeMaintainerStatus,
  normalizePreflight,
  normalizeSessionPage,
  normalizeTicketPage,
  submitCredentials,
} from "./maintainer";

const fullStatusPayload = {
  enabled: true,
  sandboxCommand: {
    registered: true,
    path: "/Users/op/.anorvis/bin/sandbox",
    exists: true,
  },
  docker: true,
  sandboxImage: true,
  modelAuth: { vault: false, apiKeys: ["ANTHROPIC_API_KEY", 7] },
  githubToken: true,
  botBrowserSession: true,
  maintainerModel: "claude-opus",
  vaultSetupCommand: "PI_CODING_AGENT_DIR=/tmp/agent omp",
};

describe("normalizeMaintainerStatus", () => {
  it("maps the documented status shape and drops junk entries", () => {
    const status = normalizeMaintainerStatus(fullStatusPayload);
    expect(status.enabled).toBe(true);
    expect(status.sandboxCommand.path).toBe("/Users/op/.anorvis/bin/sandbox");
    expect(status.modelAuth.apiKeys).toEqual(["ANTHROPIC_API_KEY"]);
    expect(status.maintainerModel).toBe("claude-opus");
    expect(status.vaultSetupCommand).toBe("PI_CODING_AGENT_DIR=/tmp/agent omp");
  });

  it("defaults everything to unconfigured on garbage input", () => {
    const status = normalizeMaintainerStatus("not an object");
    expect(status.enabled).toBe(false);
    expect(status.sandboxCommand).toEqual({
      registered: false,
      path: null,
      exists: false,
    });
    expect(status.modelAuth).toEqual({ vault: false, apiKeys: [] });
    expect(status.maintainerModel).toBeNull();
    expect(status.vaultSetupCommand).toBeNull();
  });
});

describe("maintainerChecks", () => {
  it("passes model auth with either vault or an api key", () => {
    const withVault = normalizeMaintainerStatus({
      ...fullStatusPayload,
      modelAuth: { vault: true, apiKeys: [] },
    });
    const withKey = normalizeMaintainerStatus({
      ...fullStatusPayload,
      modelAuth: { vault: false, apiKeys: ["ANTHROPIC_API_KEY"] },
    });
    const withNeither = normalizeMaintainerStatus({
      ...fullStatusPayload,
      modelAuth: { vault: false, apiKeys: [] },
    });

    const okFor = (status: MaintainerStatus) =>
      maintainerChecks(status).find((check) => check.key === "model-auth")?.ok;
    expect(okFor(withVault)).toBe(true);
    expect(okFor(withKey)).toBe(true);
    expect(okFor(withNeither)).toBe(false);
  });

  it("fails the sandbox command check with a path-specific hint when the path is missing", () => {
    const status = normalizeMaintainerStatus({
      ...fullStatusPayload,
      sandboxCommand: { registered: true, path: "/gone", exists: false },
    });
    const check = maintainerChecks(status).find(
      (entry) => entry.key === "sandbox-command",
    );
    expect(check?.ok).toBe(false);
    expect(check?.detail).toBe("/gone");
    expect(check?.hint).toContain("does not exist");

    const unregistered = normalizeMaintainerStatus({
      ...fullStatusPayload,
      sandboxCommand: { registered: false, path: null, exists: false },
    });
    const unregisteredCheck = maintainerChecks(unregistered).find(
      (entry) => entry.key === "sandbox-command",
    );
    expect(unregisteredCheck?.hint).toContain("agents.json");
  });
});

describe("buildCredentialsPayload", () => {
  it("rejects an empty form", () => {
    const result = buildCredentialsPayload(emptyCredentialsInput());
    expect(result.payload).toBeNull();
    expect(result.error).toContain("enter a credential");
  });

  it("builds a token-only payload without an apiKeys field", () => {
    const result = buildCredentialsPayload({
      githubToken: " ghp_abc123 ",
      apiKeyName: "",
      apiKeyValue: "",
    });
    expect(result.error).toBeNull();
    expect(result.payload).toEqual({ githubToken: "ghp_abc123" });
  });

  it("requires both api key name and value together", () => {
    const nameOnly = buildCredentialsPayload({
      githubToken: "",
      apiKeyName: "ANTHROPIC_API_KEY",
      apiKeyValue: "",
    });
    expect(nameOnly.payload).toBeNull();
    expect(nameOnly.error).toContain("both");
  });

  it("enforces the PROVIDER_API_KEY naming pattern", () => {
    const result = buildCredentialsPayload({
      githubToken: "",
      apiKeyName: "anthropic_key",
      apiKeyValue: "sk-123",
    });
    expect(result.payload).toBeNull();
    expect(result.error).toContain("PROVIDER_API_KEY");
  });

  it("rejects multi-line and oversized secrets", () => {
    const multiline = buildCredentialsPayload({
      githubToken: "line1\nline2",
      apiKeyName: "",
      apiKeyValue: "",
    });
    expect(multiline.payload).toBeNull();

    const oversized = buildCredentialsPayload({
      githubToken: "",
      apiKeyName: "ANTHROPIC_API_KEY",
      apiKeyValue: "x".repeat(513),
    });
    expect(oversized.payload).toBeNull();
  });
});

describe("submitCredentials (write-only contract)", () => {
  it("clears the form only after the gateway accepts the payload", async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const result = await submitCredentials(
      {
        githubToken: "ghp_secret",
        apiKeyName: "ANTHROPIC_API_KEY",
        apiKeyValue: "sk-secret",
      },
      save,
    );
    expect(save).toHaveBeenCalledWith({
      githubToken: "ghp_secret",
      apiKeys: { ANTHROPIC_API_KEY: "sk-secret" },
    });
    expect(result.saved).toBe(true);
    expect(result.input).toEqual(emptyCredentialsInput());
  });

  it("keeps typed values when the save fails so the operator can retry", async () => {
    const save = vi.fn().mockRejectedValue(new Error("gateway offline"));
    const input = {
      githubToken: "ghp_secret",
      apiKeyName: "",
      apiKeyValue: "",
    };
    const result = await submitCredentials(input, save);
    expect(result.saved).toBe(false);
    expect(result.input).toEqual(input);
    expect(result.error).toContain("gateway offline");
  });

  it("never calls the gateway with an invalid form", async () => {
    const save = vi.fn();
    const result = await submitCredentials(emptyCredentialsInput(), save);
    expect(save).not.toHaveBeenCalled();
    expect(result.saved).toBe(false);
  });
});

describe("normalizeTicketPage", () => {
  it("uses the server total and drops malformed tickets", () => {
    const page = normalizeTicketPage({
      tickets: [
        {
          id: "t1",
          status: "running",
          task: "fix crash",
          project: "abc",
          pullRequest: "https://github.com/anorvis/os/pull/9",
        },
        { status: "missing id" },
        "junk",
      ],
      total: 41,
    });
    expect(page.total).toBe(41);
    expect(page.tickets).toHaveLength(1);
    expect(page.tickets[0]?.pullRequest).toBe(
      "https://github.com/anorvis/os/pull/9",
    );
  });

  it("falls back to the page length when no total is provided", () => {
    const page = normalizeTicketPage({
      tickets: [{ id: "t1", status: "fixed" }],
    });
    expect(page.total).toBe(1);
  });
});

describe("normalizePreflight", () => {
  it("keeps repo verdict pairs and the overall flag", () => {
    const result = normalizePreflight({
      ok: false,
      repos: [
        { repo: "anorvis/os", verdict: "push access" },
        { repo: "anorvis/web", verdict: "HTTP 404" },
        { broken: true },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.repos).toEqual([
      { repo: "anorvis/os", verdict: "push access" },
      { repo: "anorvis/web", verdict: "HTTP 404" },
    ]);
  });
});

describe("normalizeSessionPage", () => {
  it("keeps usage facts, defaults junk numbers, and uses the server total", () => {
    const page = normalizeSessionPage({
      sessions: [
        {
          sessionKey: "s1",
          host: "omp",
          provider: "anthropic",
          model: "claude-opus",
          messageCount: 3,
          totalTokens: -5,
          usdCost: "free",
          lastSeenAt: "2026-07-15T10:00:00.000Z",
          reviewed: true,
        },
        { host: "missing session key" },
      ],
      total: 57,
    });
    expect(page.total).toBe(57);
    expect(page.sessions).toHaveLength(1);
    expect(page.sessions[0]).toEqual({
      sessionKey: "s1",
      host: "omp",
      provider: "anthropic",
      model: "claude-opus",
      messageCount: 3,
      totalTokens: 0,
      usdCost: 0,
      lastSeenAt: "2026-07-15T10:00:00.000Z",
      reviewed: true,
    });
  });

  it("falls back to the page length when no total is provided", () => {
    const page = normalizeSessionPage({
      sessions: [{ sessionKey: "s1" }],
    });
    expect(page.total).toBe(1);
  });
});
