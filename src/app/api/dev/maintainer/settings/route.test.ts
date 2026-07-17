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

function post(body: unknown, headers: Record<string, string>) {
  return new Request("http://127.0.0.1:3000/api/dev/maintainer/settings", {
    method: "POST",
    headers: { host: "127.0.0.1:3000", ...headers },
    body: JSON.stringify(body),
  });
}

const sameOrigin = {
  origin: "http://127.0.0.1:3000",
  "content-type": "application/json",
};

describe("POST /api/dev/maintainer/settings", () => {
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

  it("forwards a legitimate same-origin JSON toggle", async () => {
    gatewayFetchJson.mockResolvedValue({ ok: true });
    const response = await POST(post({ enabled: false }, sameOrigin));

    expect(gatewayFetchJson).toHaveBeenCalledWith("/v1/maintainer/settings", {
      method: "POST",
      body: JSON.stringify({ enabled: false }),
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects a foreign Origin without touching the gateway", async () => {
    const response = await POST(
      post(
        { enabled: false },
        { ...sameOrigin, origin: "https://evil.example" },
      ),
    );
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects a missing Origin", async () => {
    const response = await POST(
      post({ enabled: false }, { "content-type": "application/json" }),
    );
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects CORS-simple text/plain bodies", async () => {
    const response = await POST(
      post(
        { enabled: false },
        { ...sameOrigin, "content-type": "text/plain;charset=UTF-8" },
      ),
    );
    expect(response.status).toBe(415);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean enabled flag", async () => {
    const response = await POST(post({ enabled: "yes" }, sameOrigin));
    expect(response.status).toBe(400);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects non-owner sessions before touching the gateway", async () => {
    rejectNonOwnerSession.mockResolvedValue(
      Response.json({ error: "owner session required" }, { status: 403 }),
    );
    const response = await POST(post({ enabled: false }, sameOrigin));
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });
});
