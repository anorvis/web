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
  pullRequest: string | null;
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

export const API_KEY_NAME_PATTERN = /^[A-Z][A-Z0-9_]*_API_KEY$/;

export const TICKET_GROUPS = [
  {
    key: "pending",
    label: "pending approval",
    statuses: ["pending_approval"],
  },
  {
    key: "running",
    label: "running",
    statuses: ["approved", "running"],
  },
  {
    key: "review",
    label: "review",
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

export type TicketGroupKey = (typeof TICKET_GROUPS)[number]["key"];

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
      hint: "sign in the sandbox vault or store a model API key below.",
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

export type CredentialsInput = {
  githubToken: string;
  apiKeyName: string;
  apiKeyValue: string;
};

export type CredentialsPayload = {
  githubToken?: string;
  apiKeys?: Record<string, string>;
};

export function emptyCredentialsInput(): CredentialsInput {
  return { githubToken: "", apiKeyName: "", apiKeyValue: "" };
}

function validSecret(value: string): boolean {
  return value.length > 0 && value.length <= 512 && !/[\r\n]/.test(value);
}

/**
 * Builds the write-only credentials payload. Returns an error instead of a
 * payload when the input is incomplete; empty fields are omitted entirely so
 * saved values are never overwritten with blanks.
 */
export function buildCredentialsPayload(input: CredentialsInput): {
  payload: CredentialsPayload | null;
  error: string | null;
} {
  const githubToken = input.githubToken.trim();
  const apiKeyName = input.apiKeyName.trim();
  const apiKeyValue = input.apiKeyValue.trim();

  if (!githubToken && !apiKeyName && !apiKeyValue) {
    return { payload: null, error: "enter a credential to save." };
  }
  const payload: CredentialsPayload = {};
  if (githubToken) {
    if (!validSecret(githubToken)) {
      return {
        payload: null,
        error: "github token must be a single line of at most 512 characters.",
      };
    }
    payload.githubToken = githubToken;
  }
  if (apiKeyName || apiKeyValue) {
    if (!apiKeyName || !apiKeyValue) {
      return {
        payload: null,
        error: "provide both an API key name and its value.",
      };
    }
    if (!API_KEY_NAME_PATTERN.test(apiKeyName)) {
      return {
        payload: null,
        error: "API key names must look like PROVIDER_API_KEY.",
      };
    }
    if (!validSecret(apiKeyValue)) {
      return {
        payload: null,
        error:
          "API key values must be a single line of at most 512 characters.",
      };
    }
    payload.apiKeys = { [apiKeyName]: apiKeyValue };
  }
  return { payload, error: null };
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
  return { input: emptyCredentialsInput(), error: null, saved: true };
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
    pullRequest: text(value.pullRequest),
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

export type MaintainerSession = {
  sessionKey: string;
  host: string;
  provider: string;
  model: string;
  messageCount: number;
  totalTokens: number;
  usdCost: number;
  lastSeenAt: string | null;
  reviewed: boolean;
};

export type MaintainerSessionPage = {
  sessions: MaintainerSession[];
  total: number;
};

function usageCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

function session(value: unknown): MaintainerSession | null {
  if (!isRecord(value)) return null;
  const sessionKey = text(value.sessionKey);
  if (!sessionKey) return null;
  return {
    sessionKey,
    host: text(value.host) ?? "unknown",
    provider: text(value.provider) ?? "unknown",
    model: text(value.model) ?? "unknown",
    messageCount: usageCount(value.messageCount),
    totalTokens: usageCount(value.totalTokens),
    usdCost: usageCount(value.usdCost),
    lastSeenAt: text(value.lastSeenAt),
    reviewed: value.reviewed === true,
  };
}

export function normalizeSessionPage(value: unknown): MaintainerSessionPage {
  const root = isRecord(value) ? value : {};
  const sessions = (Array.isArray(root.sessions) ? root.sessions : [])
    .map(session)
    .filter((entry): entry is MaintainerSession => entry !== null);
  return {
    sessions,
    total:
      typeof root.total === "number" && Number.isFinite(root.total)
        ? Math.max(0, Math.trunc(root.total))
        : sessions.length,
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
