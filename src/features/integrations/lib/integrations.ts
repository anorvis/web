import "server-only";

import type { IntegrationCatalogEntry } from "@/features/overview/types/overview";
import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";

const convexIntegrations: IntegrationCatalogEntry[] = [
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
  )) as Array<{
    provider: string;
    status: IntegrationCatalogEntry["status"];
  }>;
  return convexIntegrations.map((integration) => ({
    ...integration,
    status:
      connections.find((connection) => connection.provider === integration.id)
        ?.status ?? integration.status,
  }));
}
