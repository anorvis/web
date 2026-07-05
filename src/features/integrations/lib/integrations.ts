import "server-only";

import type { IntegrationCatalogEntry } from "@/features/overview/types/overview";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

type IntegrationsPayload = {
  integrations: IntegrationCatalogEntry[];
};

const fallbackIntegrations: IntegrationCatalogEntry[] = [
  {
    id: "hevy",
    displayName: "Hevy",
    category: "health",
    description:
      "Workout history import and sync from Hevy into native fitness records.",
    capabilities: ["Workout import", "Exercise history", "Fitness sync"],
    authType: "token",
    status: "unavailable",
    setupHint: "Start anorvis-os to configure this integration.",
  },
  {
    id: "fatsecret",
    displayName: "FatSecret",
    category: "health",
    description: "Global food database for meal search and macro lookup.",
    capabilities: ["Food search", "Macro lookup", "Global foods"],
    authType: "token",
    status: "unavailable",
    setupHint: "Start anorvis-os to configure this integration.",
  },
  {
    id: "nutritionix",
    displayName: "Nutritionix",
    category: "health",
    description: "Branded and common food database for meal search.",
    capabilities: ["Food search", "Macro lookup", "Branded foods"],
    authType: "token",
    status: "unavailable",
    setupHint: "Start anorvis-os to configure this integration.",
  },
  {
    id: "google",
    displayName: "Google Workspace",
    category: "life",
    description:
      "Calendar, Gmail, and Drive context for scheduling and retrieval.",
    capabilities: ["Calendar", "Gmail", "Drive"],
    authType: "oauth2",
    status: "unavailable",
    setupHint: "Start anorvis-os to connect this integration.",
  },
  {
    id: "obsidian",
    displayName: "Workspace Sources",
    category: "library",
    description:
      "Approved local folders that agents can search as workspace context.",
    capabilities: ["Approved folders", "Local search", "Agent context"],
    authType: "local",
    status: "unavailable",
    setupHint: "Start anorvis-os to manage local workspace sources.",
  },
];

export async function getIntegrationCatalog(): Promise<
  IntegrationCatalogEntry[]
> {
  try {
    const payload =
      await gatewayFetchJson<IntegrationsPayload>("/v1/integrations");
    return payload.integrations;
  } catch {
    return fallbackIntegrations;
  }
}
