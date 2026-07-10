import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const gatewayFetchJson = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
  gatewayErrorResponse: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    ),
}));

describe("DELETE /api/finance/imports/:importId", () => {
  beforeEach(() => {
    gatewayFetchJson.mockReset();
  });

  it("proxies an encoded receipt import id to the OS undo endpoint", async () => {
    gatewayFetchJson.mockResolvedValue({
      ok: true,
      importId: "receipt/csv 1",
      deletedTransactions: 3,
    });

    const response = await DELETE(
      new Request("http://localhost/api/finance/imports/receipt%2Fcsv%201", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ importId: "receipt/csv 1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      importId: "receipt/csv 1",
      deletedTransactions: 3,
    });
    expect(gatewayFetchJson).toHaveBeenCalledWith(
      "/v1/finance/imports/receipt%2Fcsv%201",
      { method: "DELETE" },
    );
  });
});
