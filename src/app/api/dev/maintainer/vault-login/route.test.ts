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

function post(headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/api/dev/maintainer/vault-login", {
    method: "POST",
    headers: {
      host: "127.0.0.1:3000",
      origin: "http://127.0.0.1:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: "{}",
  });
}

describe("POST /api/dev/maintainer/vault-login", () => {
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

  it("passes through the sign-in verdict and error only", async () => {
    gatewayFetchJson.mockResolvedValue({
      ok: false,
      error: "no terminal available",
      pid: 4242,
    });

    const response = await POST(post());
    expect(gatewayFetchJson).toHaveBeenCalledWith(
      "/v1/maintainer/vault-login",
      { method: "POST" },
    );
    expect(await response.json()).toEqual({
      ok: false,
      error: "no terminal available",
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a foreign Origin so a hostile page cannot pop the terminal", async () => {
    const response = await POST(post({ origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects non-owner sessions before touching the gateway", async () => {
    rejectNonOwnerSession.mockResolvedValue(
      Response.json({ error: "owner session required" }, { status: 403 }),
    );
    const response = await POST(post());
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });
});
