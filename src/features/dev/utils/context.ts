import { isRecord } from "@/lib/guards";

export type ContextGatewayStatus = {
  ok: boolean;
  services: string[];
};

export type ContextSummary = {
  summary: string;
  scopeKind: string;
  visibility: string | null;
  updatedAt: string | null;
};

export type ContextEventMeta = {
  id: string;
  kind: string;
  surface: string;
  visibility: string;
  occurredAt: string | null;
};

export type ContextWikiPage = {
  path: string;
  title: string;
};

export type ContextSnapshot = {
  summaries: ContextSummary[];
  events: ContextEventMeta[];
  wikiPages: ContextWikiPage[];
};

export type ContextOverview = {
  os: ContextGatewayStatus | null;
  context: ContextSnapshot | null;
};

function text(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : fallback;
}

function isoDate(value: unknown): string | null {
  // The proxy sends epoch milliseconds; anything non-positive is treated as unknown.
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function summary(value: unknown): ContextSummary | null {
  if (!isRecord(value)) return null;
  const body = text(value.summary, "");
  if (body.length === 0) return null;
  return {
    summary: body,
    scopeKind: text(value.scopeKind, "owner"),
    visibility:
      typeof value.visibility === "string" && value.visibility.trim().length > 0
        ? value.visibility.trim()
        : null,
    updatedAt: isoDate(value.updatedAt),
  };
}

function event(value: unknown): ContextEventMeta | null {
  if (!isRecord(value)) return null;
  return {
    id: text(value.id, ""),
    kind: text(value.kind, "unknown"),
    surface: text(value.surface, "unknown"),
    visibility: text(value.visibility, "unknown"),
    occurredAt: isoDate(value.occurredAt),
  };
}

function wikiPage(value: unknown): ContextWikiPage | null {
  if (!isRecord(value)) return null;
  const path = text(value.path, "");
  const title = text(value.title, "");
  if (path.length === 0 || title.length === 0) return null;
  return { path, title };
}

export function normalizeContextOverview(value: unknown): ContextOverview {
  const root = isRecord(value) ? value : {};
  const os = isRecord(root.os)
    ? {
        ok: root.os.ok === true,
        services: Array.isArray(root.os.services)
          ? root.os.services.filter(
              (entry): entry is string => typeof entry === "string",
            )
          : [],
      }
    : null;
  const snapshot = isRecord(root.context) ? root.context : null;
  const context = snapshot
    ? {
        summaries: (Array.isArray(snapshot.summaries) ? snapshot.summaries : [])
          .map(summary)
          .filter((entry): entry is ContextSummary => entry !== null),
        events: (Array.isArray(snapshot.events) ? snapshot.events : [])
          .map(event)
          .filter((entry): entry is ContextEventMeta => entry !== null)
          .sort((a, b) =>
            (b.occurredAt ?? "").localeCompare(a.occurredAt ?? ""),
          ),
        wikiPages: (Array.isArray(snapshot.wikiPages) ? snapshot.wikiPages : [])
          .map(wikiPage)
          .filter((entry): entry is ContextWikiPage => entry !== null),
      }
    : null;
  return { os, context };
}
