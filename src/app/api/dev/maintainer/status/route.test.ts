import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gatewayFetchJson = vi.hoisted(() => vi.fn());
const gatewayErrorResponse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
  gatewayErrorResponse,
}));

const originalBindHost = process.env.ANORVIS_WEB_BIND_HOST;

import { GET } from "./route";

describe("GET /api/dev/maintainer/status", () => {
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

  it("returns the sanitized status shape and never anything extra", async () => {
    gatewayFetchJson.mockResolvedValue({
      enabled: true,
      sandboxCommand: { registered: true, path: "/opt/sb", exists: false },
      docker: true,
      sandboxImage: false,
      modelAuth: { vault: true, apiKeys: ["ANTHROPIC_API_KEY"] },
      githubToken: true,
      botBrowserSession: false,
      maintainerModel: "claude-opus",
      vaultSetupCommand: "PI_CODING_AGENT_DIR=/opt/sb/agent omp",
      leakedSecret: "must-not-pass-through",
    });

    const response = await GET(
      new Request("http://127.0.0.1:3000/api/dev/maintainer/status", {
        headers: { host: "127.0.0.1:3000" },
      }),
    );

    expect(gatewayFetchJson).toHaveBeenCalledWith("/v1/maintainer/status");
    expect(response.headers.get("cache-control")).toBe("no-store");
    const payload = await response.json();
    expect(payload).toEqual({
      enabled: true,
      sandboxCommand: { registered: true, path: "/opt/sb", exists: false },
      docker: true,
      sandboxImage: false,
      modelAuth: { vault: true, apiKeys: ["ANTHROPIC_API_KEY"] },
      githubToken: true,
      botBrowserSession: false,
      maintainerModel: "claude-opus",
      vaultSetupCommand: "PI_CODING_AGENT_DIR=/opt/sb/agent omp",
    });
  });

  it("denies non-loopback requests before touching the gateway", async () => {
    const response = await GET(
      new Request("http://192.168.1.20:3000/api/dev/maintainer/status", {
        headers: { host: "192.168.1.20:3000" },
      }),
    );
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("uses the shared gateway error response when the gateway fails", async () => {
    const error = new Error("gateway offline");
    gatewayFetchJson.mockRejectedValue(error);
    await GET(
      new Request("http://127.0.0.1:3000/api/dev/maintainer/status", {
        headers: { host: "127.0.0.1:3000" },
      }),
    );
    expect(gatewayErrorResponse).toHaveBeenCalledWith(error);
  });
});
