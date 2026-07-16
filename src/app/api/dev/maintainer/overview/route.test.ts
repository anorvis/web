import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const gatewayFetchJson = vi.hoisted(() => vi.fn());
const gatewayErrorResponse = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
  gatewayErrorResponse,
}));

const originalBindHost = process.env.ANORVIS_WEB_BIND_HOST;

import { GET } from "./route";

function get(query: string) {
  return new Request(
    `http://127.0.0.1:3000/api/dev/maintainer/overview${query}`,
    { headers: { host: "127.0.0.1:3000" } },
  );
}

function ticket(id: string, status: string) {
  return {
    id,
    status,
    task: `task ${id}`,
    project: "proj",
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z",
  };
}

describe("GET /api/dev/maintainer/overview", () => {
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

  it("forwards pagination and status filters and trusts a paginated gateway", async () => {
    gatewayFetchJson.mockResolvedValue({
      usage: { totals: {} },
      tickets: [
        { ...ticket("t1", "running"), pullRequest: "https://pr.example/1" },
      ],
      total: 33,
    });

    const response = await GET(
      get("?status=approved,running&limit=20&offset=20"),
    );

    const [pathname] = gatewayFetchJson.mock.calls[0] as [string];
    expect(pathname).toContain("/v1/maintenance/overview?");
    expect(pathname).toContain("limit=20");
    expect(pathname).toContain("offset=20");
    expect(pathname).toContain("status=approved%2Crunning");

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      tickets: [
        {
          id: "t1",
          status: "running",
          task: "task t1",
          project: "proj",
          createdAt: "2026-07-01T00:00:00.000Z",
          updatedAt: "2026-07-02T00:00:00.000Z",
          pullRequest: "https://pr.example/1",
        },
      ],
      total: 33,
    });
  });

  it("filters and slices locally when a legacy gateway returns everything", async () => {
    gatewayFetchJson.mockResolvedValue({
      tickets: [
        ticket("t1", "running"),
        ticket("t2", "pending_approval"),
        ticket("t3", "running"),
        ticket("t4", "fixed"),
        ticket("t5", "running"),
      ],
    });

    const response = await GET(get("?status=running&limit=2&offset=1"));
    const payload = await response.json();
    expect(payload.total).toBe(3);
    expect(payload.tickets.map((entry: { id: string }) => entry.id)).toEqual([
      "t3",
      "t5",
    ]);
  });

  it("maps sessions pagination onto sessionLimit/sessionOffset and trusts usageTotal", async () => {
    gatewayFetchJson.mockResolvedValue({
      usage: {
        recent: [
          {
            sessionKey: "s1",
            host: "omp",
            provider: "anthropic",
            model: "claude-opus",
            messageCount: 12,
            totalTokens: 4200,
            usdCost: 1.25,
            lastSeenAt: "2026-07-15T10:00:00.000Z",
            reviewed: true,
            inputTokens: 9999,
          },
        ],
      },
      usageTotal: 57,
    });

    const response = await GET(get("?view=sessions&limit=20&offset=20"));
    const [pathname] = gatewayFetchJson.mock.calls[0] as [string];
    expect(pathname).toContain("sessionLimit=20");
    expect(pathname).toContain("sessionOffset=20");

    expect(await response.json()).toEqual({
      sessions: [
        {
          sessionKey: "s1",
          host: "omp",
          provider: "anthropic",
          model: "claude-opus",
          messageCount: 12,
          totalTokens: 4200,
          usdCost: 1.25,
          lastSeenAt: "2026-07-15T10:00:00.000Z",
          reviewed: true,
        },
      ],
      total: 57,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("slices sessions locally when a legacy gateway omits usageTotal", async () => {
    gatewayFetchJson.mockResolvedValue({
      usage: {
        recent: [1, 2, 3, 4, 5].map((index) => ({
          sessionKey: `s${index}`,
          host: "omp",
          provider: "anthropic",
          model: "claude-opus",
          messageCount: index,
          totalTokens: index,
          usdCost: index,
          lastSeenAt: "2026-07-15T10:00:00.000Z",
          reviewed: false,
        })),
      },
    });

    const response = await GET(get("?view=sessions&limit=2&offset=1"));
    const payload = await response.json();
    expect(payload.total).toBe(5);
    expect(
      payload.sessions.map((entry: { sessionKey: string }) => entry.sessionKey),
    ).toEqual(["s2", "s3"]);
  });

  it("rejects out-of-range limits", async () => {
    expect((await GET(get("?limit=0"))).status).toBe(400);
    expect((await GET(get("?limit=101"))).status).toBe(400);
    expect((await GET(get("?limit=abc"))).status).toBe(400);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("rejects unknown status filters", async () => {
    const response = await GET(get("?status=exfiltrate"));
    expect(response.status).toBe(400);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });

  it("denies non-loopback requests", async () => {
    const response = await GET(
      new Request("http://192.168.1.20:3000/api/dev/maintainer/overview", {
        headers: { host: "192.168.1.20:3000" },
      }),
    );
    expect(response.status).toBe(403);
    expect(gatewayFetchJson).not.toHaveBeenCalled();
  });
});
