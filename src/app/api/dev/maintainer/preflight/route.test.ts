import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gatewayFetchJson = vi.hoisted(() => vi.fn());
const gatewayErrorResponse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
  gatewayErrorResponse,
}));

const originalBindHost = process.env.ANORVIS_WEB_BIND_HOST;

import { POST } from "./route";

function post(headers: Record<string, string> = {}) {
  return new Request("http://127.0.0.1:3000/api/dev/maintainer/preflight", {
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

describe("POST /api/dev/maintainer/preflight", () => {
  beforeEach(() => {
    gatewayFetchJson.mockReset();
    gatewayErrorResponse.mockReset();
    process.env.ANORVIS_WEB_BIND_HOST = "127.0.0.1";
  });

  afterEach(() => {
    if (originalBindHost === undefined) {
      delete process.env.ANORVIS_WEB_BIND_HOST;
    } else {
      process.env.ANORVIS_WEB_BIND_HOST = originalBindHost;
    }
  });

  it("returns sanitized per-repo verdicts", async () => {
    gatewayFetchJson.mockResolvedValue({
      ok: false,
      repos: [
        { repo: "anorvis/extension", verdict: "push access" },
        { repo: "anorvis/os", verdict: "HTTP 404" },
        { repo: "anorvis/web", verdict: "unreachable", token: "leak" },
      ],
      internal: "dropped",
    });

    const response = await POST(post());
    const [pathname, init] = gatewayFetchJson.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(pathname).toBe("/v1/maintainer/preflight");
    expect(init.method).toBe("POST");
    expect(init.signal).toBeInstanceOf(AbortSignal);

    expect(await response.json()).toEqual({
      ok: false,
      repos: [
        { repo: "anorvis/extension", verdict: "push access" },
        { repo: "anorvis/os", verdict: "HTTP 404" },
        { repo: "anorvis/web", verdict: "unreachable" },
      ],
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("rejects a foreign Origin", async () => {
    const response = await POST(post({ origin: "https://evil.example" }));
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });
});
