import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  SnapTradePortal,
  SnapTradeSettings,
  SnapTradeSyncSummary,
} from "./snaptrade";
import {
  disconnectSnapTrade,
  openSnapTradePortal,
  saveSnapTradeSettings,
  syncSnapTrade,
} from "./snaptrade";

// SnapTrade Personal is a read-only BYOK source. These tests pin what the web
// client is allowed to send: the two credentials and nothing else, no
// connection/trade type on the portal, and a non-destructive disconnect verb.
// `fetch` is stubbed so the tests stay hermetic and can inspect each request.
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function sentRequest() {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was never called");
  const [path, init] = call as [string, RequestInit | undefined];
  const rawBody = init?.body;
  return {
    path,
    method: init?.method ?? "GET",
    body:
      typeof rawBody === "string"
        ? (JSON.parse(rawBody) as Record<string, unknown>)
        : undefined,
  };
}

const settings: SnapTradeSettings = {
  connected: true,
  hasClientId: true,
  hasConsumerKey: true,
  status: "connected",
  secretProvider: "os",
  lastCheckedAt: "2026-01-01T00:00:00.000Z",
};

describe("saveSnapTradeSettings request contract", () => {
  it("posts both BYOK credentials to the settings route and surfaces the returned status", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(settings));

    const returned = await saveSnapTradeSettings({
      clientId: "client-123",
      consumerKey: "consumer-abc",
    });

    const sent = sentRequest();
    expect(sent.path).toBe("/api/integrations/snaptrade/settings");
    expect(sent.method).toBe("POST");
    // BYOK provenance: both credentials must travel together and unchanged.
    expect(sent.body).toEqual({
      clientId: "client-123",
      consumerKey: "consumer-abc",
    });
    // The status echo never leaks credentials back and is surfaced as-is.
    expect(returned).toEqual(settings);
  });
});

describe("openSnapTradePortal request contract", () => {
  it("opens the portal with an empty body so no connection/trade type is ever sent", async () => {
    const portal: SnapTradePortal = {
      redirectUri: "https://app.snaptrade.com/connect/session-1",
      sessionId: "session-1",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(portal));

    const returned = await openSnapTradePortal();

    const sent = sentRequest();
    expect(sent.path).toBe("/api/integrations/snaptrade/portal");
    expect(sent.method).toBe("POST");
    // Read-only lock: the web sends no connection options at all. Any added
    // field (e.g. a trade/connection type) would break this.
    expect(sent.body).toEqual({});
    expect(returned).toEqual(portal);
  });
});

describe("syncSnapTrade request contract", () => {
  it("posts a sync and surfaces promoted-spend and account-link counters when the OS returns them", async () => {
    const summary: SnapTradeSyncSummary = {
      ok: true,
      accounts: 1,
      balances: 1,
      positions: 2,
      activities: 3,
      activitiesInserted: 2,
      activitiesSkipped: 1,
      transactions: 1,
      transactionsInserted: 1,
      transactionsSkipped: 0,
      accountsLinked: 1,
      historyPoints: 4,
      returnRates: 5,
      warnings: [],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(summary));

    const returned = await syncSnapTrade();

    const sent = sentRequest();
    expect(sent.path).toBe("/api/integrations/snaptrade/sync");
    expect(sent.method).toBe("POST");
    expect(sent.body).toEqual({});
    expect(returned).toMatchObject({
      transactions: 1,
      transactionsInserted: 1,
      transactionsSkipped: 0,
      accountsLinked: 1,
    });
  });

  it("accepts older sync summaries that do not include optional transaction counters", async () => {
    const summary: SnapTradeSyncSummary = {
      ok: true,
      accounts: 1,
      balances: 1,
      positions: 2,
      activities: 3,
      activitiesInserted: 2,
      activitiesSkipped: 1,
      historyPoints: 4,
      returnRates: 5,
      warnings: ["manual link required"],
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(summary));

    const returned = await syncSnapTrade();

    expect(returned).toEqual(summary);
    expect(returned).not.toHaveProperty("transactions");
    expect(returned).not.toHaveProperty("transactionsInserted");
    expect(returned).not.toHaveProperty("transactionsSkipped");
    expect(returned).not.toHaveProperty("accountsLinked");
  });
});

describe("disconnectSnapTrade request contract", () => {
  it("clears Anorvis credentials with a DELETE and never a money-moving verb", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const returned = await disconnectSnapTrade();

    const sent = sentRequest();
    expect(sent.path).toBe("/api/integrations/snaptrade/disconnect");
    expect(sent.method).toBe("DELETE");
    expect(returned).toEqual({ ok: true });
  });
});
