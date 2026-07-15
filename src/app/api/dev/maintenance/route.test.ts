import { beforeEach, describe, expect, it, vi } from "vitest";

const gatewayFetchJson = vi.hoisted(() => vi.fn());
const gatewayErrorResponse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
  gatewayErrorResponse,
}));

import { GET } from "./route";

describe("GET /api/dev/maintenance", () => {
  beforeEach(() => {
    gatewayFetchJson.mockReset();
    gatewayErrorResponse.mockReset();
  });

  it("proxies the private OS overview without caching it", async () => {
    const overview = {
      usage: { totals: {}, recent: [], byModel: [] },
      tickets: [],
    };
    gatewayFetchJson.mockResolvedValue(overview);

    const response = await GET();

    expect(gatewayFetchJson).toHaveBeenCalledWith(
      "/v1/maintenance/overview",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual(overview);
  });

  it("uses the shared gateway error response", async () => {
    const error = new Error("OS unavailable");
    const degraded = Response.json({ error: "gateway unavailable" }, { status: 503 });
    gatewayFetchJson.mockRejectedValue(error);
    gatewayErrorResponse.mockReturnValue(degraded);

    const response = await GET();

    expect(gatewayErrorResponse).toHaveBeenCalledWith(error);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "gateway unavailable",
    });
  });
});
