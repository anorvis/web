export type DomainStatus = "connected" | "partial" | "disconnected";

export type OverviewHealthSnapshot = {
  status: DomainStatus;
  score: number | null;
  nudge: string;
  confidence: "low" | "medium" | "high";
  weekWorkoutCount: number;
};

export type OverviewLifeSnapshot = {
  status: DomainStatus;
  executionScore: number | null;
  doNow: string;
  doNext: string;
  currentEvent: { summary: string } | null;
  nextEvent: { summary: string; startsInMinutes: number } | null;
  todayEventCount: number;
};

export type OverviewFinanceSnapshot = {
  status: DomainStatus;
  equity: number | null;
  cash: number | null;
  dayChangePercent: number | null;
};

export type FocusRecommendation = {
  title: string;
  detail: string;
  href: string;
};

export type AgentRuntimeStatus = "online" | "idle" | "offline";

export type IntegrationCatalogStatus =
  | "connected"
  | "pending"
  | "available"
  | "unavailable";

export type IntegrationCatalogEntry = {
  id: string;
  displayName: string;
  category: "life" | "library" | "productivity" | "health" | "finance";
  description: string;
  capabilities: string[];
  authType: "local" | "oauth2" | "token" | "webhook";
  status: IntegrationCatalogStatus;
  connectProvider?: string;
  setupHint?: string;
};

export type OverviewData = {
  health: OverviewHealthSnapshot;
  life: OverviewLifeSnapshot;
  finance: OverviewFinanceSnapshot;
  integrations: IntegrationCatalogEntry[];
  agentStatus: AgentRuntimeStatus;
  agentCount: number;
  timezone: string;
};
