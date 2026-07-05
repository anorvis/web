import { patchJson, postJson, requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";

export type GatewayAgent = {
  key: string;
  name: string;
};

export type GatewayMessage = {
  id: string;
  sender: string;
  displayName: string;
  content: string;
  createdAt: string;
};

export type GatewaySessionSummary = {
  id: string;
  surface: string;
  externalId: string;
  agent: string;
  piSessionId: string;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  title: string;
  messageCount: number;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
};

export type GatewayRun = {
  id: string;
  agent: string;
  piSessionId: string | null;
  status: string;
  startedAt: string | null;
  createdAt: string;
};

export type SendMessageResponse = {
  userMessage: GatewayMessage | null;
  assistantMessage?: GatewayMessage;
  assistantMessages?: GatewayMessage[];
};

const CHAT_SESSION_CACHE_KEY = "anorvis-chat-session-cache-v1";

export async function fetchAgents(): Promise<GatewayAgent[]> {
  const value: unknown = await runEffect(requestJson<unknown>("/api/agents"));
  if (!Array.isArray(value)) return [];
  return value.filter(isGatewayAgent);
}

export function isGatewayAgent(value: unknown): value is GatewayAgent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    "key" in value &&
    typeof value.key === "string" &&
    "name" in value &&
    typeof value.name === "string"
  );
}

export async function fetchSessions(
  agent: string,
  query = "",
): Promise<GatewaySessionSummary[]> {
  const params = new URLSearchParams({ agent });
  if (query.trim()) params.set("q", query.trim());
  const value: unknown = await runEffect(
    requestJson<unknown>(`/api/chat/sessions?${params.toString()}`),
  );
  if (!Array.isArray(value)) return [];
  return value.filter(isGatewaySessionSummary);
}

export function isGatewaySessionSummary(
  value: unknown,
): value is GatewaySessionSummary {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "agent" in value &&
    typeof value.agent === "string" &&
    "piSessionId" in value &&
    typeof value.piSessionId === "string" &&
    "title" in value &&
    typeof value.title === "string" &&
    "messageCount" in value &&
    typeof value.messageCount === "number"
  );
}

export async function createSession(
  agent: string,
): Promise<GatewaySessionSummary> {
  const value: unknown = await runEffect(
    postJson<unknown>("/api/chat/sessions", { agent }),
  );
  if (
    !value ||
    typeof value !== "object" ||
    !("record" in value) ||
    !value.record ||
    typeof value.record !== "object" ||
    !("id" in value.record) ||
    typeof value.record.id !== "string" ||
    !("piSessionId" in value.record) ||
    typeof value.record.piSessionId !== "string"
  ) {
    throw new Error("invalid session response");
  }

  const now = new Date().toISOString();
  return {
    id: value.record.id,
    surface:
      "surface" in value.record && typeof value.record.surface === "string"
        ? value.record.surface
        : "web",
    externalId:
      "externalId" in value.record &&
      typeof value.record.externalId === "string"
        ? value.record.externalId
        : value.record.id,
    agent,
    piSessionId: value.record.piSessionId,
    createdAt:
      "createdAt" in value.record && typeof value.record.createdAt === "string"
        ? value.record.createdAt
        : now,
    updatedAt:
      "updatedAt" in value.record && typeof value.record.updatedAt === "string"
        ? value.record.updatedAt
        : now,
    title: "New conversation",
    messageCount: 0,
    lastMessagePreview: null,
    lastMessageAt: null,
  };
}

export async function fetchMessages(
  sessionId: string,
): Promise<GatewayMessage[]> {
  const value: unknown = await runEffect(
    requestJson<unknown>(
      `/api/chat/sessions/${encodeURIComponent(sessionId)}/messages`,
    ),
  );
  if (!Array.isArray(value)) return [];
  return value.filter(isGatewayMessage);
}

export async function archiveSession(id: string): Promise<void> {
  await runEffect(
    patchJson<unknown>(
      `/api/chat/sessions/${encodeURIComponent(id)}/archive`,
      {},
    ),
  );
}

export async function rewindSession(input: {
  session: GatewaySessionSummary;
  messageId: string;
  content: string;
}): Promise<{ session: GatewaySessionSummary }> {
  const value: unknown = await runEffect(
    patchJson<unknown>(
      `/api/chat/sessions/${encodeURIComponent(input.session.id)}/messages`,
      {
        messageId: input.messageId,
        content: input.content,
        agent: input.session.agent,
        piSessionId: input.session.piSessionId,
      },
    ),
  );
  if (
    !value ||
    typeof value !== "object" ||
    !("session" in value) ||
    !value.session ||
    typeof value.session !== "object" ||
    Array.isArray(value.session) ||
    !("id" in value.session) ||
    value.session.id !== input.session.id ||
    !("piSessionId" in value.session) ||
    typeof value.session.piSessionId !== "string"
  ) {
    throw new Error("invalid rewind response");
  }
  const rewoundSession = value.session as { id: string; piSessionId: string };
  return {
    session: {
      ...input.session,
      id: rewoundSession.id,
      piSessionId: rewoundSession.piSessionId,
      messageCount: input.session.messageCount,
      lastMessagePreview: input.session.lastMessagePreview,
      lastMessageAt: input.session.lastMessageAt,
    },
  };
}

export async function fetchRuns(): Promise<GatewayRun[]> {
  const value: unknown = await runEffect(requestJson<unknown>("/api/dev/runs"));
  if (!Array.isArray(value)) return [];
  return value.filter(isGatewayRun);
}

export function isGatewayRun(value: unknown): value is GatewayRun {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "agent" in value &&
    typeof value.agent === "string" &&
    "status" in value &&
    typeof value.status === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    (!("startedAt" in value) ||
      value.startedAt === null ||
      typeof value.startedAt === "string") &&
    (!("piSessionId" in value) ||
      value.piSessionId === null ||
      typeof value.piSessionId === "string")
  );
}

export function isGatewayMessage(value: unknown): value is GatewayMessage {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "sender" in value &&
    typeof value.sender === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string" &&
    "content" in value &&
    typeof value.content === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string"
  );
}

export async function postMessage(
  session: GatewaySessionSummary,
  content: string,
): Promise<SendMessageResponse> {
  const value: unknown = await runEffect(
    postJson<unknown>(
      `/api/chat/sessions/${encodeURIComponent(session.id)}/messages`,
      {
        content,
        agent: session.agent,
        piSessionId: session.piSessionId,
      },
    ),
  );
  return parseSendMessageResponse(value);
}

export function parseSendMessageResponse(value: unknown): SendMessageResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { userMessage: null };
  }
  const userMessage =
    "userMessage" in value && isGatewayMessage(value.userMessage)
      ? value.userMessage
      : null;
  const assistantMessage =
    "assistantMessage" in value && isGatewayMessage(value.assistantMessage)
      ? value.assistantMessage
      : undefined;
  const assistantMessages =
    "assistantMessages" in value && Array.isArray(value.assistantMessages)
      ? value.assistantMessages.filter(isGatewayMessage)
      : undefined;
  return { userMessage, assistantMessage, assistantMessages };
}

export function formatTime(value: string | null): string {
  if (!value) return "No messages yet";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function readCachedSessions(): GatewaySessionSummary[] {
  const raw = window.localStorage.getItem(CHAT_SESSION_CACHE_KEY);
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value
      .filter(isGatewaySessionSummary)
      .filter((session) => session.surface === "web");
  } catch {
    return [];
  }
}

export function writeCachedSessions(sessions: GatewaySessionSummary[]): void {
  window.localStorage.setItem(
    CHAT_SESSION_CACHE_KEY,
    JSON.stringify(sessions.slice(0, 200)),
  );
}

export function cacheSession(session: GatewaySessionSummary): void {
  const existing = readCachedSessions().filter(
    (entry) => entry.id !== session.id,
  );
  writeCachedSessions([session, ...existing]);
}

export function removeCachedSession(id: string): void {
  writeCachedSessions(readCachedSessions().filter((entry) => entry.id !== id));
}

export function mergeSessionLists(
  remote: GatewaySessionSummary[],
  cached: GatewaySessionSummary[],
  agent: string,
): GatewaySessionSummary[] {
  const byId = new Map<string, GatewaySessionSummary>();
  for (const session of cached.filter(
    (entry) => entry.agent === agent && entry.surface === "web",
  )) {
    byId.set(session.id, session);
  }
  for (const session of remote.filter((entry) => entry.surface === "web")) {
    byId.set(session.id, session);
  }
  return [...byId.values()].sort((a, b) => {
    const aTime = a.lastMessageAt ?? a.updatedAt;
    const bTime = b.lastMessageAt ?? b.updatedAt;
    return bTime.localeCompare(aTime);
  });
}
