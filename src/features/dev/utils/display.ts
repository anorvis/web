import { Schema } from "effect";
import { decodeUnknownResult } from "@/lib/effect/schema";
import { isRecord } from "@/lib/guards";

import { getStatusTone } from "@/lib/workspace/view-utils";

const JsonRecordSchema = Schema.parseJson(
  Schema.Record({ key: Schema.String, value: Schema.Unknown }),
);

export type JobRecord = {
  id: string;
  agent: string;
  instruction: string;
  status: string;
  enabled: boolean;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  createdAt: string;
};

export type RunRecord = {
  id: string;
  jobId: string | null;
  agent: string;
  instruction: string;
  piSessionId: string | null;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  outputPreview: string | null;
};

export type OsEvent = {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
};

export type MemoryDocument = {
  id: string;
  kind: string;
  title: string;
  body: string;
  links?: string[];
  createdAt?: string;
  updatedAt?: string;
  provenance?: unknown[];
};

export type MemoryGraphNode = {
  id: string;
  kind: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  inbound: number;
  outbound: number;
};

export type MemoryGraphEdge = {
  source: string;
  target: string;
  kind: "reference" | "missing";
};

export type MemoryGraph = {
  nodes: MemoryGraphNode[];
  edges: MemoryGraphEdge[];
};

export const STREAM_ROW_HEIGHT_PX = 34;
export const DEV_PANEL_HEIGHT =
  "h-[min(590px,calc(100vh-17rem))] min-h-[430px]";

export function formatPayload(payload: unknown): string {
  if (payload === undefined || payload === null) return "";
  if (typeof payload === "string") return payload;
  if (isRecord(payload)) {
    const message =
      typeof payload.message === "string" ? payload.message : null;
    const event = typeof payload.event === "string" ? payload.event : null;
    const scope = Array.isArray(payload.scope) ? payload.scope.join(".") : null;
    const fields =
      typeof payload.fields === "string"
        ? formatFieldString(payload.fields)
        : isRecord(payload.fields)
          ? formatFields(payload.fields)
          : "";
    if (message || event || scope) {
      return [scope, event, message, fields].filter(Boolean).join(" ");
    }
    return formatFields(payload);
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function formatFieldString(value: string): string {
  const decoded = decodeUnknownResult(JsonRecordSchema, value);
  return decoded.ok ? formatFields(decoded.value) : value;
}

export function formatFields(fields: Record<string, unknown>): string {
  const entries = Object.entries(fields).filter(
    ([, value]) => value !== undefined,
  );
  if (entries.length === 0) {
    return "";
  }

  return entries
    .map(([key, value]) => {
      const rendered =
        typeof value === "string"
          ? value
          : value === null
            ? "null"
            : JSON.stringify(value);
      return `${key}=${rendered}`;
    })
    .join(" ");
}

export function parseFields(value: unknown): Record<string, unknown> {
  if (isRecord(value)) return value;
  if (typeof value !== "string") return {};
  const decoded = decodeUnknownResult(JsonRecordSchema, value);
  return decoded.ok ? decoded.value : {};
}

export function streamEventDetails(event: OsEvent): {
  label: string;
  message: string;
  meta: string;
} {
  if (event.type === "observability.log" && isRecord(event.payload)) {
    const scope = Array.isArray(event.payload.scope)
      ? event.payload.scope.join(".")
      : "observability";
    const name =
      typeof event.payload.event === "string"
        ? event.payload.event
        : "observability.log";
    const message =
      typeof event.payload.message === "string" ? event.payload.message : "";
    const fields = parseFields(event.payload.fields);
    return {
      label: scope,
      message: message && message !== name ? message : name,
      meta: formatFields(fields),
    };
  }

  return {
    label: event.type,
    message:
      event.type === "run.log.appended" && isRecord(event.payload)
        ? formatPayload(event.payload.event)
        : formatPayload(event.payload),
    meta:
      event.type === "run.log.appended" && isRecord(event.payload)
        ? formatFields({
            runId: event.payload.runId,
            path: event.payload.path,
          })
        : "",
  };
}

export function statusTone(status: string) {
  switch (status.toLowerCase()) {
    case "succeeded":
    case "completed":
    case "success":
      return "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-200";
    case "failed":
    case "cancelled":
    case "canceled":
    case "error":
      return "border-rose-600/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/50 dark:text-rose-200";
    case "running":
      return "border-blue-600/30 bg-blue-500/10 text-blue-700 dark:border-blue-500/50 dark:text-blue-200";
    case "queued":
      return "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/50 dark:text-amber-200";
    default:
      return getStatusTone(status);
  }
}

export function jobDisplayStatus(
  job: JobRecord | null,
  run: RunRecord,
): string {
  if (!job) return run.status;
  const isExecutionRun = run.instruction === job.instruction;
  if (isExecutionRun) return run.status;
  if (job.status === "idle" && job.enabled && job.nextRunAt) {
    return Date.parse(job.nextRunAt) <= Date.now() ? "queued" : "scheduled";
  }
  return job.status;
}

export function preview(value: string, length = 140) {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length > length ? `${compact.slice(0, length - 1)}…` : compact;
}
