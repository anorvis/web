import { NextResponse } from "next/server";
import { normalizeUsageAnalytics, type UsageScope } from "@/features/dev/usage";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isDirectLoopbackRequest } from "@/lib/direct-loopback-request";
import { isRecord } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const TICKET_STATUSES: Record<string, true> = {
  pending_approval: true,
  approved: true,
  running: true,
  rejected: true,
  existing_pull_request: true,
  fixed: true,
  not_reproduced: true,
  blocked: true,
  verification_failed: true,
  failed: true,
};

type SanitizedTicket = {
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

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function textList(value: unknown): string[] {
  return (Array.isArray(value) ? value : [])
    .map(text)
    .filter((entry): entry is string => entry !== null);
}

function boundedInt(
  value: string | null,
  fallback: number,
  max: number,
): number | null {
  if (value === null) return fallback;
  if (!/^\d{1,7}$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return parsed <= max ? parsed : null;
}

/** Ticket metadata only; usage/session details stay on the maintenance page of the gateway. */
function sanitizeTicket(value: unknown): SanitizedTicket | null {
  if (!isRecord(value)) return null;
  const id = text(value.id);
  const status = text(value.status);
  if (!id || !status) return null;
  const linear = isRecord(value.linear) ? value.linear : {};
  const linearUrl = text(linear.url);
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
    linearIdentifier: text(linear.identifier),
    linearUrl: linearUrl?.startsWith("https://linear.app/") ? linearUrl : null,
  };
}

type SanitizedSession = {
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

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? value
    : 0;
}

/** Session usage facts only; prompts and transcripts never leave the gateway. */
function sanitizeSession(
  value: unknown,
  defaultScope: UsageScope,
): SanitizedSession | null {
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
    messageCount: count(value.messageCount),
    totalTokens: count(value.totalTokens),
    usdCost: count(value.usdCost),
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

export async function GET(request: Request) {
  if (!isDirectLoopbackRequest(request)) {
    return NextResponse.json({ error: "local only" }, { status: 403 });
  }
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;

  const params = new URL(request.url).searchParams;
  const limit = boundedInt(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
  const offset = boundedInt(params.get("offset"), 0, 1_000_000);
  if (limit === null || limit === 0 || offset === null) {
    return NextResponse.json(
      { error: "limit must be 1-100 and offset a non-negative integer" },
      { status: 400 },
    );
  }
  const view = params.get("view") === "sessions" ? "sessions" : "tickets";
  const requestedScope = params.get("scope") ?? "foreground";
  if (
    view === "sessions" &&
    requestedScope !== "foreground" &&
    requestedScope !== "monitor" &&
    requestedScope !== "maintainer"
  ) {
    return NextResponse.json(
      { error: "scope must be foreground, monitor, or maintainer" },
      { status: 400 },
    );
  }
  const scope: UsageScope =
    requestedScope === "monitor" || requestedScope === "maintainer"
      ? requestedScope
      : "foreground";
  const statuses =
    view === "tickets"
      ? (params.get("status") ?? "")
          .split(",")
          .map((entry) => entry.trim())
          .filter((entry) => entry.length > 0)
      : [];
  if (statuses.some((entry) => TICKET_STATUSES[entry] !== true)) {
    return NextResponse.json(
      { error: "unknown ticket status filter" },
      { status: 400 },
    );
  }

  const upstream =
    view === "sessions"
      ? new URLSearchParams({
          sessionLimit: String(limit),
          sessionOffset: String(offset),
          sessionScope: scope,
        })
      : new URLSearchParams({
          limit: String(limit),
          offset: String(offset),
        });
  if (statuses.length > 0) upstream.set("status", statuses.join(","));

  try {
    const upstreamQuery = upstream.toString();
    const overview = await gatewayFetchJson<unknown>(
      `/v1/maintainer/overview${upstreamQuery ? `?${upstreamQuery}` : ""}`,
    );
    const root = isRecord(overview) ? overview : {};

    if (view === "sessions") {
      const usage = isRecord(root.usage) ? root.usage : {};
      let sessions = (Array.isArray(usage.recent) ? usage.recent : [])
        .map((entry) => sanitizeSession(entry, scope))
        .filter((entry): entry is SanitizedSession => entry !== null);
      let total: number;
      if (
        typeof root.usageTotal === "number" &&
        Number.isFinite(root.usageTotal)
      ) {
        // Gateway windowed usage.recent itself via sessionLimit/sessionOffset.
        total = Math.max(0, Math.trunc(root.usageTotal));
      } else {
        // Legacy gateway: the full recent list came back, so slice here.
        total = sessions.length;
        sessions = sessions.slice(offset, offset + limit);
      }
      return NextResponse.json(
        {
          scope,
          usagePeriod:
            root.usagePeriod === "current_month"
              ? "current_month"
              : scope === "foreground"
                ? "all"
                : "current_month",
          usageSince: text(root.usageSince),
          sessions,
          total,
          analytics: normalizeUsageAnalytics({
            totals: usage.totals,
            byModel: usage.byModel,
            performance: root.performance,
          }),
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    let tickets = (Array.isArray(root.tickets) ? root.tickets : [])
      .map(sanitizeTicket)
      .filter((entry): entry is SanitizedTicket => entry !== null);
    let total: number;
    if (typeof root.total === "number" && Number.isFinite(root.total)) {
      // Gateway paginated (and filtered) the ticket list itself.
      total = Math.max(0, Math.trunc(root.total));
    } else {
      // Legacy gateway: full list came back, so filter and slice here to keep
      // the browser payload bounded.
      if (statuses.length > 0) {
        const wanted = new Set(statuses);
        tickets = tickets.filter((entry) => wanted.has(entry.status));
      }
      total = tickets.length;
      tickets = tickets.slice(offset, offset + limit);
    }
    return NextResponse.json(
      { tickets, total },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
