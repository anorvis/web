import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const writeWorkspaceDocument = vi.hoisted(() => vi.fn());

vi.mock("@/lib/os-workspace-data", () => ({
  writeWorkspaceDocument,
}));

describe("POST /api/integrations/save-token", () => {
  beforeEach(() => {
    writeWorkspaceDocument.mockClear();
  });

  it("records only token presence, never the raw token value", async () => {
    const token = "super-secret-token";
    const request = new Request(
      "http://localhost/api/integrations/save-token",
      {
        method: "POST",
        body: JSON.stringify({ provider: "hevy", token }),
      },
    );

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(writeWorkspaceDocument).toHaveBeenCalledOnce();
    const payload = writeWorkspaceDocument.mock.calls[0][0];
    expect(JSON.stringify(payload)).not.toContain(token);
    expect(payload.value).toMatchObject({
      provider: "hevy",
      tokenPresent: true,
    });
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
    expect(writeWorkspaceDocument).not.toHaveBeenCalled();
  });
});
