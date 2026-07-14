import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";

import type {
  SnapTradePortal,
  SnapTradeSettings,
  SnapTradeSyncSummary,
} from "./snaptrade";
import {
  disconnectSnapTrade,
  fetchSnapTradeSettings,
  openSnapTradePortal,
  saveSnapTradeSettings,
  syncSnapTrade,
} from "./snaptrade";

vi.mock("@/lib/convex-client", () => ({
  convexClient: {
    action: vi.fn(),
    mutation: vi.fn(),
    query: vi.fn(),
  },
}));

const actionMock = vi.mocked(convexClient.action);
const mutationMock = vi.mocked(convexClient.mutation);

beforeEach(() => {
  actionMock.mockReset();
  mutationMock.mockReset();
  vi.mocked(convexClient.query).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

const connectedSettings: SnapTradeSettings = {
  connected: true,
  hasClientId: true,
  hasConsumerKey: true,
  status: "connected",
  secretProvider: "os",
  lastCheckedAt: "2026-01-01T00:00:00.000Z",
};

describe("SnapTrade settings Convex contract", () => {
  it("reads settings through the SnapTrade action and adapts connected status", async () => {
    actionMock.mockResolvedValueOnce({
      ...connectedSettings,
      status: "ignored",
    } as never);

    await expect(fetchSnapTradeSettings()).resolves.toEqual(connectedSettings);
    expect(actionMock).toHaveBeenCalledTimes(1);
    expect(actionMock).toHaveBeenCalledWith(convexApi.snaptrade.settings, {});
  });

  it("saves both BYOK credentials then refreshes returned status without echoing secrets", async () => {
    actionMock
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValueOnce(connectedSettings as never);

    const returned = await saveSnapTradeSettings({
      clientId: "client-123",
      consumerKey: "consumer-abc",
    });

    expect(actionMock).toHaveBeenNthCalledWith(
      1,
      convexApi.snaptrade.saveSettings,
      {
        clientId: "client-123",
        consumerKey: "consumer-abc",
      },
    );
    expect(actionMock).toHaveBeenNthCalledWith(
      2,
      convexApi.snaptrade.settings,
      {},
    );
    expect(returned).toEqual(connectedSettings);
    expect(returned).not.toHaveProperty("clientId");
    expect(returned).not.toHaveProperty("consumerKey");
  });

  it("surfaces save failures and does not read settings afterward", async () => {
    actionMock.mockRejectedValueOnce(
      new Error("invalid SnapTrade credentials") as never,
    );

    await expect(
      saveSnapTradeSettings({
        clientId: "client-123",
        consumerKey: "consumer-abc",
      }),
    ).rejects.toThrow("invalid SnapTrade credentials");
    expect(actionMock).toHaveBeenCalledTimes(1);
    expect(actionMock).toHaveBeenCalledWith(convexApi.snaptrade.saveSettings, {
      clientId: "client-123",
      consumerKey: "consumer-abc",
    });
  });
});

describe("openSnapTradePortal Convex contract", () => {
  it("opens the portal with empty args so no connection or trade type is sent", async () => {
    const portal: SnapTradePortal = {
      redirectUri: "https://app.snaptrade.com/connect/session-1",
      sessionId: "session-1",
    };
    actionMock.mockResolvedValueOnce(portal as never);

    await expect(openSnapTradePortal()).resolves.toEqual(portal);
    expect(actionMock).toHaveBeenCalledTimes(1);
    expect(actionMock).toHaveBeenCalledWith(
      convexApi.snaptrade.createConnectionPortal,
      {},
    );
  });
});

describe("syncSnapTrade Convex contract", () => {
  it("runs sync and surfaces promoted-spend and account-link counters when returned", async () => {
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
    actionMock.mockResolvedValueOnce(summary as never);

    await expect(syncSnapTrade()).resolves.toEqual(summary);
    expect(actionMock).toHaveBeenCalledWith(convexApi.snaptrade.syncNow, {});
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
    actionMock.mockResolvedValueOnce(summary as never);

    const returned = await syncSnapTrade();

    expect(returned).toEqual(summary);
    expect(returned).not.toHaveProperty("transactions");
    expect(returned).not.toHaveProperty("transactionsInserted");
    expect(returned).not.toHaveProperty("transactionsSkipped");
    expect(returned).not.toHaveProperty("accountsLinked");
    expect(actionMock).toHaveBeenCalledWith(convexApi.snaptrade.syncNow, {});
  });

  it("surfaces sync failures", async () => {
    actionMock.mockRejectedValueOnce(
      new Error("SnapTrade sync failed") as never,
    );

    await expect(syncSnapTrade()).rejects.toThrow("SnapTrade sync failed");
    expect(actionMock).toHaveBeenCalledWith(convexApi.snaptrade.syncNow, {});
  });
});

describe("disconnectSnapTrade Convex contract", () => {
  it("disconnects SnapTrade through the shared integration mutation and adapts ok result", async () => {
    mutationMock.mockResolvedValueOnce(undefined as never);

    await expect(disconnectSnapTrade()).resolves.toEqual({ ok: true });
    expect(mutationMock).toHaveBeenCalledTimes(1);
    expect(mutationMock).toHaveBeenCalledWith(
      convexApi.integrations.disconnect,
      { provider: "snaptrade" },
    );
    expect(actionMock).not.toHaveBeenCalled();
  });
});
