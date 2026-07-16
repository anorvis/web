import { beforeEach, describe, expect, it, vi } from "vitest";

const gatewayFetchJson = vi.hoisted(() => vi.fn());
const gatewayErrorResponse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
  gatewayErrorResponse,
}));

import { GET } from "./route";

describe("GET /api/dev/context", () => {
  beforeEach(() => {
    gatewayFetchJson.mockReset();
    gatewayErrorResponse.mockReset();
  });

  it("compiles owner scope with a bounded limit and strips private bodies", async () => {
    gatewayFetchJson.mockImplementation(async (pathname: string) => {
      if (pathname === "/v1/os/status") {
        return {
          ok: true,
          authority: { token: "secret-token", port: 4820 },
          services: ["llm-wiki", "context", "os"],
        };
      }
      return {
        scope: { kind: "owner", ownerId: "owner-1" },
        summaries: [
          {
            summary: "Owner reviewed workouts.",
            scopeKind: "owner",
            visibility: "private",
            channelId: "discord-123",
            updatedAt: 1_752_600_000_000,
          },
        ],
        events: [
          {
            id: "evt-1",
            kind: "conversation_turn",
            occurredAt: 1_752_601_000_000,
            source: {
              surface: "pi",
              visibility: "private",
              conversationId: "conv-1",
              principalId: "user-1",
            },
            content: {
              prompt: "secret prompt text",
              assistant: { text: "secret assistant text" },
              toolResults: [{ output: "secret tool output" }],
            },
          },
        ],
        wikiPages: [{ pageId: "p1", path: "life/health.md", title: "Health" }],
      };
    });

    const response = await GET();
    const payload = await response.json();

    expect(gatewayFetchJson).toHaveBeenCalledWith("/v1/os/status");
    expect(gatewayFetchJson).toHaveBeenCalledWith("/v1/context/compile", {
      method: "POST",
      body: JSON.stringify({ scope: { kind: "owner" }, limit: 25 }),
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");

    expect(payload.os).toEqual({
      ok: true,
      services: ["llm-wiki", "context", "os"],
    });
    expect(payload.context.events).toEqual([
      {
        id: "evt-1",
        kind: "conversation_turn",
        surface: "pi",
        visibility: "private",
        occurredAt: 1_752_601_000_000,
      },
    ]);
    expect(payload.context.summaries).toEqual([
      {
        summary: "Owner reviewed workouts.",
        scopeKind: "owner",
        visibility: "private",
        updatedAt: 1_752_600_000_000,
      },
    ]);
    expect(payload.context.wikiPages).toEqual([
      { path: "life/health.md", title: "Health" },
    ]);

    const raw = JSON.stringify(payload);
    expect(raw).not.toContain("secret prompt text");
    expect(raw).not.toContain("secret assistant text");
    expect(raw).not.toContain("secret tool output");
    expect(raw).not.toContain("secret-token");
    expect(raw).not.toContain("conv-1");
    expect(raw).not.toContain("discord-123");
  });

  it("keeps OS status when the compile pipeline is unavailable", async () => {
    gatewayFetchJson.mockImplementation(async (pathname: string) => {
      if (pathname === "/v1/os/status") {
        return { ok: true, services: ["os"] };
      }
      throw new Error("context client is not configured");
    });

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.os).toEqual({ ok: true, services: ["os"] });
    expect(payload.context).toBeNull();
    expect(payload.contextError).toContain("context client is not configured");
    expect(gatewayErrorResponse).not.toHaveBeenCalled();
  });

  it("uses the shared gateway error response when the gateway is unreachable", async () => {
    const error = new Error("OS unavailable");
    const degraded = Response.json(
      { error: "gateway unavailable" },
      { status: 503 },
    );
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
