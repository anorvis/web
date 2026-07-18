import {
  normalizeUsageAnalytics,
  type UsageAnalytics,
  type UsageScope,
} from "@/features/dev/usage";
import { errorMessage } from "@/lib/effect/errors";
import { isRecord } from "@/lib/guards";

export type MaintainerStatus = {
  enabled: boolean;
  sandboxCommand: {
    registered: boolean;
    path: string | null;
    exists: boolean;
  };
  docker: boolean;
  sandboxImage: boolean;
  modelAuth: {
    vault: boolean;
    apiKeys: string[];
  };
  githubToken: boolean;
  botBrowserSession: boolean;
  maintainerModel: string | null;
  vaultSetupCommand: string | null;
};

export type MaintainerCheck = {
  key: string;
  label: string;
  ok: boolean;
  detail: string | null;
  hint: string;
};

export type MaintainerTicket = {
  id: string;
  status: string;
  task: string;
  project: string;
  createdAt: string | null;
  updatedAt: string | null;
  answer: string | null;
  pullRequest: string | null;
  verification: string[];
  warnings: string[];
  linearIdentifier: string | null;
  linearUrl: string | null;
};

export type MaintainerTicketPage = {
  tickets: MaintainerTicket[];
  total: number;
};

export type PreflightResult = {
  ok: boolean;
  repos: { repo: string; verdict: string }[];
};

export type SmokeResult = {
  ok: boolean;
  output: string;
};

export type VaultLoginResult = {
  ok: boolean;
  error: string | null;
};

export const PREFLIGHT_PASS_VERDICT = "push access";

export const TICKET_FILTERS = [
  {
    key: "inbox",
    label: "inbox",
    statuses: ["pending_approval"],
  },
  {
    key: "active",
    label: "active",
    statuses: ["approved", "running"],
  },
  {
    key: "done",
    label: "done",
    statuses: [
      "rejected",
      "existing_pull_request",
      "fixed",
      "not_reproduced",
      "blocked",
      "verification_failed",
      "failed",
    ],
  },
] as const;

export type TicketFilterKey = (typeof TICKET_FILTERS)[number]["key"];

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function normalizeMaintainerStatus(value: unknown): MaintainerStatus {
  const root = isRecord(value) ? value : {};
  const sandbox = isRecord(root.sandboxCommand) ? root.sandboxCommand : {};
  const modelAuth = isRecord(root.modelAuth) ? root.modelAuth : {};
  return {
    enabled: root.enabled === true,
    sandboxCommand: {
      registered: sandbox.registered === true,
      path: text(sandbox.path),
      exists: sandbox.exists === true,
    },
    docker: root.docker === true,
    sandboxImage: root.sandboxImage === true,
    modelAuth: {
      vault: modelAuth.vault === true,
      apiKeys: Array.isArray(modelAuth.apiKeys)
        ? modelAuth.apiKeys.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [],
    },
    githubToken: root.githubToken === true,
    botBrowserSession: root.botBrowserSession === true,
    maintainerModel: text(root.maintainerModel),
    vaultSetupCommand: text(root.vaultSetupCommand),
  };
}

export function hasModelAuth(status: MaintainerStatus): boolean {
  return status.modelAuth.vault || status.modelAuth.apiKeys.length > 0;
}

export function maintainerChecks(status: MaintainerStatus): MaintainerCheck[] {
  const sandbox = status.sandboxCommand;
  return [
    {
      key: "enabled",
      label: "maintainer enabled",
      ok: status.enabled,
      detail: null,
      hint: "flip the enable toggle in maintainer settings.",
    },
    {
      key: "sandbox-command",
      label: "sandbox command",
      ok: sandbox.registered && sandbox.exists,
      detail: sandbox.path,
      hint: sandbox.registered
        ? "the configured sandbox command path does not exist on disk."
        : 'set "sandboxCommand" in ~/.anorvis/agents.json.',
    },
    {
      key: "docker",
      label: "docker",
      ok: status.docker,
      detail: null,
      hint: "start Docker so `docker version` succeeds.",
    },
    {
      key: "sandbox-image",
      label: "sandbox image",
      ok: status.sandboxImage,
      detail: null,
      hint: "build the anorvis-sandbox image from the os repo Dockerfile.",
    },
    {
      key: "model-auth",
      label: "model auth",
      ok: hasModelAuth(status),
      detail:
        status.modelAuth.apiKeys.length > 0
          ? status.modelAuth.apiKeys.join(", ")
          : status.modelAuth.vault
            ? "sandbox vault present — run the sandbox smoke to verify the sign-in"
            : null,
      hint: "sign in to the dedicated sandbox vault with your subscription.",
    },
    {
      key: "github-token",
      label: "github token",
      ok: status.githubToken,
      detail: null,
      hint: "store a GitHub token with push access below.",
    },
    {
      key: "bot-session",
      label: "bot browser session",
      ok: status.botBrowserSession,
      detail: null,
      hint: "export the bot's GitHub cookies to ~/.anorvis/sandbox/github-bot-cookies.json.",
    },
  ];
}

export type CredentialsInput = { githubToken: string };

export type CredentialsPayload = { githubToken: string };

function validSecret(value: string): boolean {
  return value.length > 0 && value.length <= 512 && !/[\r\n]/.test(value);
}

/**
 * Builds the write-only credentials payload. Returns an error instead of a
 * payload when the input is empty or malformed. Model auth stays on the
 * subscription vault sign-in; API keys are a gateway-only power-user path.
 */
export function buildCredentialsPayload(input: CredentialsInput): {
  payload: CredentialsPayload | null;
  error: string | null;
} {
  const githubToken = input.githubToken.trim();
  if (!githubToken) {
    return { payload: null, error: "enter a credential to save." };
  }
  if (!validSecret(githubToken)) {
    return {
      payload: null,
      error: "github token must be a single line of at most 512 characters.",
    };
  }
  return { payload: { githubToken }, error: null };
}

/**
 * Write-only save flow: fields are cleared only after the gateway accepts the
 * payload, and kept intact on validation or transport failure so the operator
 * never retypes a long secret.
 */
export async function submitCredentials(
  input: CredentialsInput,
  save: (payload: CredentialsPayload) => Promise<void>,
): Promise<{ input: CredentialsInput; error: string | null; saved: boolean }> {
  const { payload, error } = buildCredentialsPayload(input);
  if (!payload) return { input, error, saved: false };
  try {
    await save(payload);
  } catch (cause) {
    return { input, error: errorMessage(cause), saved: false };
  }
  return { input: { githubToken: "" }, error: null, saved: true };
}

function textList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .map(text)
    .filter((entry): entry is string => entry !== null);
}

function linearUrl(value: unknown): string | null {
  const url = text(value);
  return url?.startsWith("https://linear.app/") ? url : null;
}

function ticket(value: unknown): MaintainerTicket | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const status = text(value.status);
  if (!id || !status) return null;
  return {
    id,
    status,
    task: text(value.task) ?? "",
    project: text(value.project) ?? "unknown",
    createdAt: text(value.createdAt),
    updatedAt: text(value.updatedAt),
    answer: text(value.answer),
    pullRequest: text(value.pullRequest),
    verification: textList(value.verification),
    warnings: textList(value.warnings),
    linearIdentifier: text(value.linearIdentifier),
    linearUrl: linearUrl(value.linearUrl),
  };
}

export function normalizeTicketPage(value: unknown): MaintainerTicketPage {
  const root = isRecord(value) ? value : {};
  const tickets = (Array.isArray(root.tickets) ? root.tickets : [])
    .map(ticket)
    .filter((entry): entry is MaintainerTicket => entry !== null);
  return {
    tickets,
    total:
      typeof root.total === "number" && Number.isFinite(root.total)
        ? Math.max(0, Math.trunc(root.total))
        : tickets.length,
  };
}

export type AgentUsageSession = {
  sessionKey: string;
  scope: UsageScope;
  host: string;
  provider: string;
  model: string;
  messageCount: number;
  totalTokens: number;
  usdCost: number;
  lastSeenAt: string | null;
  reviewed: boolean;
  stage: "generalizer" | "worker" | "monitor" | null;
  outcome: string | null;
};

export type AgentUsagePage = {
  sessions: AgentUsageSession[];
  scope: UsageScope;
  usagePeriod: "all" | "current_month";
  usageSince: string | null;
  total: number;
  analytics: UsageAnalytics;
};

function usageCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function usageScope(value: unknown): UsageScope {
  return value === "maintainer" || value === "monitor" ? value : "foreground";
}

function session(
  value: unknown,
  defaultScope: UsageScope,
): AgentUsageSession | null {
  if (!isRecord(value)) return null;
  const sessionKey = text(value.sessionKey);
  if (!sessionKey) return null;
  return {
    sessionKey,
    scope:
      value.scope === "foreground" ||
      value.scope === "monitor" ||
      value.scope === "maintainer"
        ? value.scope
        : defaultScope,
    host: text(value.host) ?? "unknown",
    provider: text(value.provider) ?? "unknown",
    model: text(value.model) ?? "unknown",
    messageCount: usageCount(value.messageCount),
    totalTokens: usageCount(value.totalTokens),
    usdCost: usageCount(value.usdCost),
    lastSeenAt: text(value.lastSeenAt),
    reviewed: value.reviewed === true,
    stage:
      value.stage === "generalizer" ||
      value.stage === "worker" ||
      value.stage === "monitor"
        ? value.stage
        : null,
    outcome: text(value.outcome),
  };
}

export function normalizeSessionPage(value: unknown): AgentUsagePage {
  const root = isRecord(value) ? value : {};
  const scope = usageScope(root.scope);
  const sessions = (Array.isArray(root.sessions) ? root.sessions : [])
    .map((entry) => session(entry, scope))
    .filter((entry): entry is AgentUsageSession => entry !== null);
  return {
    scope,
    usagePeriod:
      root.usagePeriod === "current_month"
        ? "current_month"
        : scope === "foreground"
          ? "all"
          : "current_month",
    usageSince: text(root.usageSince),
    sessions,
    total:
      typeof root.total === "number" && Number.isFinite(root.total)
        ? Math.max(0, Math.trunc(root.total))
        : sessions.length,
    analytics: normalizeUsageAnalytics(root.analytics),
  };
}

export function normalizePreflight(value: unknown): PreflightResult {
  const root = isRecord(value) ? value : {};
  const repos = (Array.isArray(root.repos) ? root.repos : []).flatMap(
    (entry) => {
      if (!isRecord(entry)) return [];
      const repo = text(entry.repo);
      const verdict = text(entry.verdict);
      return repo && verdict ? [{ repo, verdict }] : [];
    },
  );
  return { ok: root.ok === true, repos };
}

export function normalizeSmoke(value: unknown): SmokeResult {
  const root = isRecord(value) ? value : {};
  return {
    ok: root.ok === true,
    output: typeof root.output === "string" ? root.output : "",
  };
}

export function normalizeVaultLogin(value: unknown): VaultLoginResult {
  const root = isRecord(value) ? value : {};
  return { ok: root.ok === true, error: text(root.error) };
}

export type LinearStatus = {
  connected: boolean;
  auth: "oauth" | "api_key" | null;
  teamId: string | null;
  teamName: string | null;
  hasClientCredentials: boolean;
};

export type LinearTeam = {
  id: string;
  name: string;
  key: string;
};

export type LinearSyncResult = {
  ok: boolean;
  pushed: number;
  updated: number;
  error: string | null;
};

export function normalizeLinearStatus(value: unknown): LinearStatus {
  const root = isRecord(value) ? value : {};
  return {
    connected: root.connected === true,
    auth: root.auth === "oauth" || root.auth === "api_key" ? root.auth : null,
    teamId: text(root.teamId),
    teamName: text(root.teamName),
    hasClientCredentials: root.hasClientCredentials === true,
  };
}

export function normalizeLinearTeams(value: unknown): LinearTeam[] {
  const root = isRecord(value) ? value : {};
  return (Array.isArray(root.teams) ? root.teams : []).flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = text(entry.id);
    const name = text(entry.name);
    if (!id || !name) return [];
    return [{ id, name, key: text(entry.key) ?? "" }];
  });
}

export function normalizeLinearSync(value: unknown): LinearSyncResult {
  const root = isRecord(value) ? value : {};
  return {
    ok: root.ok === true,
    pushed:
      typeof root.pushed === "number" && Number.isFinite(root.pushed)
        ? Math.max(0, Math.trunc(root.pushed))
        : 0,
    updated:
      typeof root.updated === "number" && Number.isFinite(root.updated)
        ? Math.max(0, Math.trunc(root.updated))
        : 0,
    error: text(root.error),
  };
}
