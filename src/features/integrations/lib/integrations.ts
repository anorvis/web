import "server-only";

import type { IntegrationCatalogEntry } from "@/features/overview/types/overview";
import { convexClient } from "@/lib/convex-client";
import {
  convexApi,
  type IntegrationPublication,
  type IntegrationSync,
} from "@/lib/convex-functions";

const EMPTY_SYNC: IntegrationSync = {
  sequence: null,
  lastSyncedAt: null,
  lastChangedAt: null,
  lastAttemptAt: null,
  lastError: null,
  lastErrorAt: null,
};

const convexIntegrations: Omit<
  IntegrationCatalogEntry,
  "hasCredentials" | "sync"
>[] = [
  {
    id: "hevy",
    displayName: "Hevy",
    category: "health",
    description:
      "Workout history import and sync from Hevy into native fitness records.",
    capabilities: ["Workout import", "Exercise history", "Fitness sync"],
    authType: "token",
    status: "available",
    setupHint: "Connect with a Hevy API key. Sync runs through Convex.",
  },
  {
    id: "google",
    displayName: "Google Workspace",
    category: "life",
    description:
      "Calendar context for scheduling and retrieval through authenticated Google OAuth.",
    capabilities: ["Calendar"],
    authType: "oauth2",
    status: "available",
    setupHint:
      "Connect through Google OAuth. Credentials are stored in Convex.",
  },
  {
    id: "snaptrade",
    displayName: "SnapTrade",
    category: "finance",
    description:
      "Brokerage connection portal for investment account syncing through SnapTrade.",
    capabilities: ["Brokerage portal", "Investment accounts", "Portfolio sync"],
    authType: "token",
    status: "available",
    setupHint:
      "Configure SnapTrade credentials to launch the connection portal.",
  },
];

export async function getIntegrationCatalog(): Promise<
  IntegrationCatalogEntry[]
> {
  const connections = (await convexClient.query(
    convexApi.integrations.list,
    {},
  )) as IntegrationPublication[];
  return convexIntegrations.map((integration) => {
    const connection = connections.find(
      (item) => item.provider === integration.id,
    );
    return {
      ...integration,
      status:
        (connection?.status as IntegrationCatalogEntry["status"] | undefined) ??
        integration.status,
      hasCredentials: connection?.hasCredentials ?? false,
      sync: connection?.sync ?? EMPTY_SYNC,
    };
  });
}
