import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";

export type SnapTradeSettings = {
  connected: boolean;
  hasClientId: boolean;
  hasConsumerKey: boolean;
  status: string;
  secretProvider: string | null;
  lastCheckedAt: string | null;
};

export type SnapTradeCredentials = {
  clientId: string;
  consumerKey: string;
};

export type SnapTradePortal = {
  redirectUri: string;
  sessionId: string | null;
};

export type SnapTradeSyncSummary = {
  ok: true;
  accounts: number;
  balances: number;
  positions: number;
  activities: number;
  activitiesInserted: number;
  activitiesSkipped: number;
  transactions?: number;
  transactionsInserted?: number;
  transactionsSkipped?: number;
  accountsLinked?: number;
  historyPoints: number;
  returnRates: number;
  warnings: string[];
};

export async function fetchSnapTradeSettings(): Promise<SnapTradeSettings> {
  const settings = (await convexClient.action(
    convexApi.snaptrade.settings,
    {},
  )) as SnapTradeSettings;
  return {
    ...settings,
    status: settings.connected ? "connected" : "available",
  } as SnapTradeSettings;
}

export async function saveSnapTradeSettings(
  credentials: SnapTradeCredentials,
): Promise<SnapTradeSettings> {
  await convexClient.action(convexApi.snaptrade.saveSettings, credentials);
  return fetchSnapTradeSettings();
}

export function openSnapTradePortal(): Promise<SnapTradePortal> {
  return convexClient.action(
    convexApi.snaptrade.createConnectionPortal,
    {},
  ) as Promise<SnapTradePortal>;
}

export function syncSnapTrade(): Promise<SnapTradeSyncSummary> {
  return convexClient.action(
    convexApi.snaptrade.syncNow,
    {},
  ) as Promise<SnapTradeSyncSummary>;
}

export async function disconnectSnapTrade(): Promise<{ ok: true }> {
  await convexClient.mutation(convexApi.integrations.disconnect, {
    provider: "snaptrade",
  });
  return { ok: true };
}
