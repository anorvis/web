import { beforeEach, describe, expect, it, vi } from "vitest";
import { getIntegrationCatalog } from "./integrations";

const convexQuery = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));

vi.mock("@/lib/convex-client", () => ({
  convexClient: { query: convexQuery },
}));

vi.mock("@/lib/convex-functions", () => ({
  convexApi: { integrations: { list: "capability/integration:list" } },
}));

describe("getIntegrationCatalog", () => {
  beforeEach(() => {
    convexQuery.mockReset();
  });

  it("overlays Convex provider connection status on the static catalog", async () => {
    convexQuery.mockResolvedValue([
      { provider: "google", status: "connected" },
      { provider: "hevy", status: "pending" },
    ]);

    const catalog = await getIntegrationCatalog();

    expect(convexQuery).toHaveBeenCalledWith("capability/integration:list", {});
    expect(catalog.map(({ id, status }) => ({ id, status }))).toEqual([
      { id: "hevy", status: "pending" },
      { id: "google", status: "connected" },
      { id: "snaptrade", status: "available" },
    ]);
  });
});
