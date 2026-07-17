import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gatewayFetchJson = vi.hoisted(() => vi.fn());
const gatewayErrorResponse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
  gatewayErrorResponse,
}));

const rejectNonOwnerSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/dev-owner-guard", () => ({ rejectNonOwnerSession }));

const originalBindHost = process.env.ANORVIS_WEB_BIND_HOST;

import { POST } from "./route";

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/api/dev/maintainer/credentials", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

describe("POST /api/dev/maintainer/credentials", () => {
  beforeEach(() => {
    gatewayFetchJson.mockReset();
    gatewayErrorResponse.mockReset();
    rejectNonOwnerSession.mockReset();
    rejectNonOwnerSession.mockResolvedValue(null);
    process.env.ANORVIS_WEB_BIND_HOST = "127.0.0.1";
  });

  afterEach(() => {
    if (originalBindHost === undefined) {
      delete process.env.ANORVIS_WEB_BIND_HOST;
    } else {
      process.env.ANORVIS_WEB_BIND_HOST = originalBindHost;
    }
  });

  it("forwards validated credentials and echoes nothing back", async () => {
    gatewayFetchJson.mockResolvedValue({ ok: true });
    const response = await POST(
      post({
        githubToken: "ghp_secret",
        apiKeys: { ANTHROPIC_API_KEY: "sk-secret" },
      }),
    );

    expect(gatewayFetchJson).toHaveBeenCalledWith(
      "/v1/maintainer/credentials",
      {
        method: "POST",
        body: JSON.stringify({
          githubToken: "ghp_secret",
          apiKeys: { ANTHROPIC_API_KEY: "sk-secret" },
        }),
      },
    );
    expect(response.headers.get("cache-control")).toBe("no-store");
    const text = await response.text();
    expect(JSON.parse(text)).toEqual({ ok: true });
    expect(text).not.toContain("ghp_secret");
    expect(text).not.toContain("sk-secret");
  });

  it("rejects invalid API key names before touching the gateway", async () => {
    const response = await POST(post({ apiKeys: { "not-a-key": "value" } }));
    expect(response.status).toBe(400);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects multi-line token values", async () => {
    const response = await POST(post({ githubToken: "a\nb" }));
    expect(response.status).toBe(400);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects an empty credential payload", async () => {
    const response = await POST(post({}));
    expect(response.status).toBe(400);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects a foreign Origin", async () => {
    const response = await POST(
      post({ githubToken: "ghp_secret" }, { origin: "https://evil.example" }),
    );
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects non-owner sessions before touching the gateway", async () => {
    rejectNonOwnerSession.mockResolvedValue(
      Response.json({ error: "owner session required" }, { status: 403 }),
    );
    const response = await POST(post({ githubToken: "ghp_secret" }));
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });
});
