import { fetchFinanceDashboard } from "@/features/finance/api/finance";
import { fetchHealthDashboard } from "@/features/health/api/health";
import { fetchLifeSnapshot } from "@/features/life/api/life";
import type {
  IntegrationCatalogEntry,
  OverviewData,
} from "@/features/overview/types/overview";
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

const catalog: Omit<
  IntegrationCatalogEntry,
  "status" | "hasCredentials" | "sync"
>[] = [
  {
    id: "google",
    displayName: "Google Workspace",
    category: "life",
    description: "Read-only calendar sync through authenticated Google OAuth.",
    capabilities: ["Calendar"],
    authType: "oauth2",
    setupHint: "Connect with Google OAuth.",
  },
  {
    id: "hevy",
    displayName: "Hevy",
    category: "health",
    description: "Workout and body-measurement sync from Hevy.",
    capabilities: ["Workouts", "Measurements", "Routines"],
    authType: "token",
    setupHint: "Connect with a Hevy API key.",
  },
  {
    id: "snaptrade",
    displayName: "SnapTrade",
    category: "finance",
    description: "Read-only investment account and portfolio sync.",
    capabilities: ["Accounts", "Positions", "Activities", "History"],
    authType: "token",
    setupHint: "Configure SnapTrade credentials.",
  },
];

export async function fetchOverview(): Promise<OverviewData> {
  const [life, health, finance, connections] = await Promise.all([
    fetchLifeSnapshot(),
    fetchHealthDashboard(),
    fetchFinanceDashboard("CAD"),
    convexClient.query(convexApi.integrations.list, {}) as Promise<
      IntegrationPublication[]
    >,
  ]);
  const now = Date.now();
  const weekAgo = now - 7 * 24 * 60 * 60 * 1_000;
  const weekWorkoutCount = health.recentWorkouts.filter(
    (workout) => new Date(workout.startedAt).valueOf() >= weekAgo,
  ).length;
  const equityValues = finance.accounts.flatMap((account) =>
    account.currency === "CAD" &&
    account.status !== "hidden" &&
    account.balance !== null
      ? [account.balance]
      : [],
  );
  const cashValues = finance.balances.flatMap((balance) =>
    balance.currency === "CAD" && balance.cash !== null ? [balance.cash] : [],
  );
  return {
    health: {
      status:
        health.macroProfile ||
        health.recentWorkouts.length ||
        health.recentMeals.length
          ? "connected"
          : "disconnected",
      score: null,
      nudge:
        weekWorkoutCount > 0
          ? `${weekWorkoutCount} workout${weekWorkoutCount === 1 ? "" : "s"} this week`
          : "log a workout or meal to establish a baseline",
      confidence: health.recentWorkouts.length >= 3 ? "high" : "low",
      weekWorkoutCount,
    },
    life: {
      status:
        life.queue.length || life.weekCalendarEvents.length
          ? "connected"
          : "disconnected",
      executionScore: life.executionScore,
      doNow: life.doNow,
      doNext: life.doNext,
      currentEvent: life.currentEvent,
      nextEvent: life.nextEvent,
      todayEventCount: life.todayEventCount,
    },
    finance: {
      status: finance.accounts.length ? "connected" : "disconnected",
      equity: equityValues.length
        ? equityValues.reduce((sum, value) => sum + value, 0)
        : null,
      cash: cashValues.length
        ? cashValues.reduce((sum, value) => sum + value, 0)
        : null,
      dayChangePercent: null,
    },
    integrations: mapIntegrations(connections),
    agentStatus: "offline",
    agentCount: 0,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function mapIntegrations(
  connections: IntegrationPublication[],
): IntegrationCatalogEntry[] {
  return catalog.map((entry) => {
    const connection = connections.find((item) => item.provider === entry.id);
    return {
      ...entry,
      status:
        (connection?.status as IntegrationCatalogEntry["status"] | undefined) ??
        "available",
      hasCredentials: connection?.hasCredentials ?? false,
      sync: connection?.sync ?? EMPTY_SYNC,
    };
  });
}

// Canonical fetch for queryKeys.integrations(): every subscriber stores the
// raw provider rows under this key and derives its own view (the catalog
// maps them with `select: mapIntegrations`). Two fetchers with different
// shapes on one key poison the cache.
export function fetchIntegrationsList(): Promise<IntegrationPublication[]> {
  return convexClient.query(convexApi.integrations.list, {}) as Promise<
    IntegrationPublication[]
  >;
}
