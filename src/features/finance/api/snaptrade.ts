import { deleteJson, postJson, requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";
import {
  requestBrowserLocalJson,
  shouldUseBrowserLocalBackend,
} from "@/lib/local-backend-client";

// ---------------------------------------------------------------------------
// SnapTrade Personal (BYOK) source client.
//
// Mirrors the read-only OS routes under /v1/integrations/snaptrade. Credentials
// are write-only: the API returns booleans/status only and NEVER echoes the
// clientId or consumerKey back. The connection portal is locked to read access
// server-side, so the web never sends a connection type and Anorvis can neither
// trade nor move money.
// ---------------------------------------------------------------------------

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

export function fetchSnapTradeSettings(): Promise<SnapTradeSettings> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<SnapTradeSettings>(
      "/v1/integrations/snaptrade/settings",
    );
  }

  return runEffect(
    requestJson<SnapTradeSettings>("/api/integrations/snaptrade/settings"),
  );
}

export function saveSnapTradeSettings(
  credentials: SnapTradeCredentials,
): Promise<SnapTradeSettings> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<SnapTradeSettings>(
      "/v1/integrations/snaptrade/settings",
      { method: "POST", body: JSON.stringify(credentials) },
    );
  }

  return runEffect(
    postJson<SnapTradeSettings>(
      "/api/integrations/snaptrade/settings",
      credentials,
    ),
  );
}

// Opens a read-only SnapTrade Connection Portal. The connection type is locked
// to `read` server-side, so no connection options are sent from the web.
export function openSnapTradePortal(): Promise<SnapTradePortal> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<SnapTradePortal>(
      "/v1/integrations/snaptrade/portal",
      { method: "POST", body: JSON.stringify({}) },
    );
  }

  return runEffect(
    postJson<SnapTradePortal>("/api/integrations/snaptrade/portal", {}),
  );
}

export function syncSnapTrade(): Promise<SnapTradeSyncSummary> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<SnapTradeSyncSummary>(
      "/v1/integrations/snaptrade/sync",
      { method: "POST" },
    );
  }

  return runEffect(
    postJson<SnapTradeSyncSummary>("/api/integrations/snaptrade/sync", {}),
  );
}

// Clears Anorvis-stored SnapTrade credentials only. Brokerage connections held
// by SnapTrade itself are never touched by this call.
export function disconnectSnapTrade(): Promise<{ ok: true }> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<{ ok: true }>(
      "/v1/integrations/snaptrade/disconnect",
      { method: "DELETE" },
    );
  }

  return runEffect(
    deleteJson<{ ok: true }>("/api/integrations/snaptrade/disconnect"),
  );
}
