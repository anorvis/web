import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const gatewayFetchJson = vi.hoisted(() => vi.fn());
const writeWorkspaceDocument = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
  gatewayErrorResponse: (error: unknown) =>
    Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 502 },
    ),
}));

vi.mock("@/lib/os-workspace-data", () => ({
  writeWorkspaceDocument,
}));

describe("POST /api/integrations/save-token", () => {
  beforeEach(() => {
    gatewayFetchJson.mockReset();
    writeWorkspaceDocument.mockClear();
  });

  it("stores the token through anorvis-os provider secrets", async () => {
    const token = "super-secret-token";
    gatewayFetchJson.mockResolvedValue({ ok: true });
    const request = new Request(
      "http://localhost/api/integrations/save-token",
      {
        method: "POST",
        body: JSON.stringify({ provider: "hevy", token }),
      },
    );

    const response = await POST(request);
    const responseText = await response.clone().text();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      note: "Stored token through anorvis-os provider secrets.",
    });
    expect(gatewayFetchJson).toHaveBeenCalledWith(
      "/v1/providers/hevy/connection",
      {
        method: "POST",
        body: JSON.stringify({ secrets: { token } }),
      },
    );
    expect(writeWorkspaceDocument).not.toHaveBeenCalled();
    expect(responseText).not.toContain(token);
  });

  it("rejects missing provider or token", async () => {
    const request = new Request(
      "http://localhost/api/integrations/save-token",
      {
        method: "POST",
        body: JSON.stringify({ provider: "hevy" }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(400);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
    expect(writeWorkspaceDocument).not.toHaveBeenCalled();
  });
});
