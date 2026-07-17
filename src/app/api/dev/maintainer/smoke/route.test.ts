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
  return new Request("http://127.0.0.1:3000/api/dev/maintainer/smoke", {
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

describe("POST /api/dev/maintainer/smoke", () => {
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

  it("returns the smoke verdict with output bounded to 2000 chars", async () => {
    gatewayFetchJson.mockResolvedValue({
      ok: true,
      output: "x".repeat(3000),
    });

    const response = await POST(post());
    const [pathname, init] = gatewayFetchJson.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(pathname).toBe("/v1/maintainer/smoke");
    expect(init.method).toBe("POST");
    // The long-running smoke keeps a 240s allowance rather than default fetch behavior.
    expect(init.signal).toBeInstanceOf(AbortSignal);

    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.output).toHaveLength(2000);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects CORS-simple text/plain bodies", async () => {
    const response = await POST(
      post({ "content-type": "text/plain;charset=UTF-8" }),
    );
    expect(response.status).toBe(415);
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
