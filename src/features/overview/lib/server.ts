import "server-only";

import { getHealthSnapshot } from "@/features/health/lib/server";
import { getIntegrationCatalog } from "@/features/integrations/lib/integrations";
import { getLifeSnapshot } from "@/features/life/lib/server";
import type {
  AgentRuntimeStatus,
  IntegrationCatalogEntry,
  OverviewData,
  OverviewFinanceSnapshot,
  OverviewHealthSnapshot,
  OverviewLifeSnapshot,
} from "@/features/overview/types/overview";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import { readWorkspaceDocument } from "@/lib/os-workspace-data";
import { isAlpacaPortfolio, isOverviewData } from "@/lib/workspace-type-guards";

type GatewayAgent = {
  key: string;
  name: string;
};

const localHealth: OverviewHealthSnapshot = {
  status: "disconnected",
  score: null,
  nudge: "Local-only mode: connect Health through Anorvis OS when ready.",
  confidence: "low",
  weekWorkoutCount: 0,
};

const localLife: OverviewLifeSnapshot = {
  status: "disconnected",
  executionScore: null,
  doNow: "Open the life workspace",
  doNext: "Connect life records through the local backend.",
  currentEvent: null,
  nextEvent: null,
  todayEventCount: 0,
};

const localFinance: OverviewFinanceSnapshot = {
  status: "disconnected",
  equity: null,
  cash: null,
  dayChangePercent: null,
};

const localIntegrations: IntegrationCatalogEntry[] = [];

function healthOverviewFrom(
  snapshot: Awaited<ReturnType<typeof getHealthSnapshot>>,
): OverviewHealthSnapshot {
  if (!snapshot.hasHevy) return localHealth;

  return {
    status: "connected",
    score: snapshot.score.overall,
    nudge: snapshot.score.nudge,
    confidence: snapshot.score.confidence,
    weekWorkoutCount: snapshot.weekWorkoutCount,
  };
}

function lifeOverviewFrom(
  snapshot: Awaited<ReturnType<typeof getLifeSnapshot>>,
): OverviewLifeSnapshot {
  const hasData =
    snapshot.hasGoogleCalendar ||
    snapshot.hasGoogleTasks ||
    snapshot.hasSpotify;
  if (!hasData) return localLife;

  return {
    status:
      snapshot.hasGoogleCalendar && snapshot.hasGoogleTasks
        ? "connected"
        : "partial",
    executionScore: snapshot.executionScore,
    doNow: snapshot.doNow,
    doNext: snapshot.doNext,
    currentEvent: snapshot.currentEvent,
    nextEvent: snapshot.nextEvent,
    todayEventCount: snapshot.todayEventCount,
  };
}

async function getFinanceOverview(): Promise<OverviewFinanceSnapshot> {
  const portfolio = await readWorkspaceDocument({
    kind: "summary",
    id: "web-finance-portfolio",
    isValue: isAlpacaPortfolio,
  });

  if (!portfolio) return localFinance;

  return {
    status: "connected",
    equity: portfolio.equity,
    cash: portfolio.cash,
    dayChangePercent: null,
  };
}

async function getAgentRuntime(): Promise<{
  status: AgentRuntimeStatus;
  count: number;
}> {
  try {
    const agents = await gatewayFetchJson<GatewayAgent[]>("/v1/agents");
    return {
      status: agents.length > 0 ? "online" : "idle",
      count: agents.length,
    };
  } catch {
    return { status: "offline", count: 0 };
  }
}

export async function getOverviewData(timezone: string): Promise<OverviewData> {
  const explicitOverview = await readWorkspaceDocument({
    kind: "summary",
    id: "web-overview-snapshot",
    isValue: isOverviewData,
  });

  const [health, life, finance, integrations, agentRuntime] = await Promise.all(
    [
      getHealthSnapshot(timezone)
        .then(healthOverviewFrom)
        .catch(() => localHealth),
      getLifeSnapshot({ skipCalendar: true })
        .then(lifeOverviewFrom)
        .catch(() => localLife),
      getFinanceOverview().catch(() => localFinance),
      getIntegrationCatalog().catch(() => localIntegrations),
      getAgentRuntime(),
    ],
  );

  return {
    health: explicitOverview?.health ?? health,
    life: explicitOverview?.life ?? life,
    finance: explicitOverview?.finance ?? finance,
    integrations,
    agentStatus: agentRuntime.status,
    agentCount: agentRuntime.count,
    timezone: explicitOverview?.timezone ?? timezone,
  };
}
