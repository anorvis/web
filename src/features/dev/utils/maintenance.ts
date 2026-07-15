import { isRecord } from "@/lib/guards";

export type MaintenanceUsage = {
  sessions: number;
  messageCount: number;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  totalTokens: number;
  usdCost: number;
  outputLimitWarningCount: number;
};

export type MaintenanceSession = MaintenanceUsage & {
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  provider: string;
  model: string;
  reviewed: boolean;
};

export type MaintenanceModelUsage = MaintenanceUsage & {
  provider: string;
  model: string;
};

export type MaintenanceTicket = {
  status: string;
  task: string;
  createdAt: string | null;
  updatedAt: string | null;
  pullRequest: string | null;
  verificationCount: number;
};

export type MaintenanceOverview = {
  usage: {
    totals: MaintenanceUsage;
    recent: MaintenanceSession[];
    byModel: MaintenanceModelUsage[];
  };
  tickets: MaintenanceTicket[];
};

const EMPTY_USAGE: MaintenanceUsage = {
  sessions: 0,
  messageCount: 0,
  inputTokens: 0,
  outputTokens: 0,
  cacheTokens: 0,
  totalTokens: 0,
  usdCost: 0,
  outputLimitWarningCount: 0,
};

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function date(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value))
    ? value
    : null;
}

function usage(value: unknown): MaintenanceUsage {
  if (!isRecord(value)) return { ...EMPTY_USAGE };
  return {
    sessions: number(value.sessions),
    messageCount: number(value.messageCount),
    inputTokens: number(value.inputTokens),
    outputTokens: number(value.outputTokens),
    cacheTokens: number(value.cacheTokens),
    totalTokens: number(value.totalTokens),
    usdCost: number(value.usdCost),
    outputLimitWarningCount: number(value.outputLimitWarningCount),
  };
}

function safeTask(value: unknown): string {
  const task = text(value, "Generalized maintenance request");
  if (
    task.length > 280 ||
    /(?:^|\s)(?:\/{2}|\/Users\/|\/home\/|[A-Za-z]:\\|file:\/\/|~\/)/i.test(
      task,
    )
  ) {
    return "Generalized maintenance request";
  }
  return task.replace(/\s+/g, " ");
}

function pullRequest(value: unknown): string | null {
  return typeof value === "string" &&
    /^https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/[1-9]\d*$/.test(value)
    ? value
    : null;
}

function verificationCount(value: unknown): number {
  if (Array.isArray(value)) {
    return value.filter(
      (entry) => typeof entry === "string" && entry.trim().length > 0,
    ).length;
  }
  return number(value);
}

function session(value: unknown): MaintenanceSession | null {
  if (!isRecord(value)) return null;
  return {
    ...usage(value),
    firstSeenAt: date(value.firstSeenAt),
    lastSeenAt: date(value.lastSeenAt),
    provider: text(value.provider, "unknown provider"),
    model: text(value.model, "unknown model"),
    reviewed: value.reviewed === true,
  };
}

function modelUsage(value: unknown): MaintenanceModelUsage | null {
  if (!isRecord(value)) return null;
  return {
    ...usage(value),
    provider: text(value.provider, "unknown provider"),
    model: text(value.model, "unknown model"),
  };
}

function ticket(value: unknown): MaintenanceTicket | null {
  if (!isRecord(value)) return null;
  const result = isRecord(value.result) ? value.result : null;
  return {
    status: text(value.status, "unknown"),
    task: safeTask(value.task),
    createdAt: date(value.createdAt),
    updatedAt: date(value.updatedAt),
    pullRequest: pullRequest(value.pullRequest ?? result?.pullRequest),
    verificationCount: verificationCount(
      value.verification ?? value.verificationCount ?? result?.verification,
    ),
  };
}

export function normalizeMaintenanceOverview(
  value: unknown,
): MaintenanceOverview {
  const root = isRecord(value) ? value : {};
  const usageValue = isRecord(root.usage) ? root.usage : {};
  const recent = Array.isArray(usageValue.recent)
    ? usageValue.recent.flatMap((value) => {
        const parsed = session(value);
        return parsed ? [parsed] : [];
      })
    : [];
  const byModel = Array.isArray(usageValue.byModel)
    ? usageValue.byModel.flatMap((value) => {
        const parsed = modelUsage(value);
        return parsed ? [parsed] : [];
      })
    : [];
  const tickets = Array.isArray(root.tickets)
    ? root.tickets.flatMap((value) => {
        const parsed = ticket(value);
        return parsed ? [parsed] : [];
      })
    : [];

  return {
    usage: {
      totals: usage(usageValue.totals),
      recent,
      byModel,
    },
    tickets,
  };
}
