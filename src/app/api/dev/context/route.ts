import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { isDirectLoopbackRequest } from "@/lib/direct-loopback-request";
import { errorMessage } from "@/lib/effect/errors";
import { isRecord } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTEXT_COMPILE_LIMIT = 25;

type SanitizedStatus = {
  ok: boolean;
  services: string[];
};

type SanitizedEvent = {
  id: string;
  kind: string;
  surface: string;
  visibility: string;
  occurredAt: number | null;
};

type SanitizedSummary = {
  summary: string;
  scopeKind: string;
  visibility: string | null;
  updatedAt: number | null;
};

type SanitizedWikiPage = {
  path: string;
  title: string;
};

type SanitizedContext = {
  summaries: SanitizedSummary[];
  events: SanitizedEvent[];
  wikiPages: SanitizedWikiPage[];
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/** Forward only availability facts; the authority config never reaches the browser. */
function sanitizeStatus(value: unknown): SanitizedStatus {
  const root = isRecord(value) ? value : {};
  return {
    ok: root.ok === true,
    services: Array.isArray(root.services)
      ? root.services.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
  };
}

/** Keep event metadata only; prompt, assistant, and tool payloads stay on this machine. */
function sanitizeEvent(value: unknown): SanitizedEvent | null {
  if (!isRecord(value)) return null;
  const source = isRecord(value.source) ? value.source : {};
  return {
    id: text(value.id) ?? "",
    kind: text(value.kind) ?? "unknown",
    surface: text(source.surface) ?? "unknown",
    visibility: text(source.visibility) ?? "unknown",
    occurredAt:
      typeof value.occurredAt === "number" &&
      Number.isFinite(value.occurredAt) &&
      value.occurredAt > 0
        ? value.occurredAt
        : null,
  };
}

function sanitizeSummary(value: unknown): SanitizedSummary | null {
  if (!isRecord(value)) return null;
  const summary = text(value.summary);
  if (!summary) return null;
  return {
    summary,
    scopeKind: text(value.scopeKind) ?? "owner",
    visibility: text(value.visibility),
    updatedAt:
      typeof value.updatedAt === "number" &&
      Number.isFinite(value.updatedAt) &&
      value.updatedAt > 0
        ? value.updatedAt
        : null,
  };
}

function sanitizeWikiPage(value: unknown): SanitizedWikiPage | null {
  if (!isRecord(value)) return null;
  const path = text(value.path);
  const title = text(value.title);
  if (!path || !title) return null;
  return { path, title };
}

function sanitizeCompile(value: unknown): SanitizedContext {
  const root = isRecord(value) ? value : {};
  const events = Array.isArray(root.events) ? root.events : [];
  const summaries = Array.isArray(root.summaries) ? root.summaries : [];
  const wikiPages = Array.isArray(root.wikiPages) ? root.wikiPages : [];
  return {
    summaries: summaries
      .map(sanitizeSummary)
      .filter((entry): entry is SanitizedSummary => entry !== null)
      .slice(0, CONTEXT_COMPILE_LIMIT),
    events: events
      .map(sanitizeEvent)
      .filter((entry): entry is SanitizedEvent => entry !== null)
      .slice(0, CONTEXT_COMPILE_LIMIT),
    wikiPages: wikiPages
      .map(sanitizeWikiPage)
      .filter((entry): entry is SanitizedWikiPage => entry !== null)
      .slice(0, CONTEXT_COMPILE_LIMIT),
  };
}

export async function GET(request: Request) {
  if (!isDirectLoopbackRequest(request)) {
    return NextResponse.json({ error: "local only" }, { status: 403 });
  }
  const [status, compile] = await Promise.allSettled([
    gatewayFetchJson<unknown>("/v1/os/status"),
    gatewayFetchJson<unknown>("/v1/context/compile", {
      method: "POST",
      body: JSON.stringify({
        scope: { kind: "owner" },
        limit: CONTEXT_COMPILE_LIMIT,
      }),
    }),
  ]);

  if (status.status === "rejected" && compile.status === "rejected") {
    return gatewayErrorResponse(status.reason);
  }

  return NextResponse.json(
    {
      os: status.status === "fulfilled" ? sanitizeStatus(status.value) : null,
      osError:
        status.status === "rejected" ? errorMessage(status.reason) : null,
      context:
        compile.status === "fulfilled" ? sanitizeCompile(compile.value) : null,
      contextError:
        compile.status === "rejected" ? errorMessage(compile.reason) : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
