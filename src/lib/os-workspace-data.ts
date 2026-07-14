import "server-only";
import { Schema } from "effect";

import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";
import { decodeUnknownResult } from "@/lib/effect/schema";

export type MemoryDocument = {
  id: string;
  kind: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type JsonGuard<T> = (value: unknown) => value is T;

type WorkspaceMemoryKind =
  | "note"
  | "summary"
  | "fact"
  | "decision"
  | "preference";

const JsonBodySchema = Schema.parseJson(Schema.Unknown);
function workspaceDocumentPath(kind: WorkspaceMemoryKind, id: string): string {
  return `workspace/${kind}/${id}`;
}

function parseJsonBody(body: string): unknown | null {
  const decoded = decodeUnknownResult(JsonBodySchema, body);
  return decoded.ok ? decoded.value : null;
}

export async function readWorkspaceDocument<T>(input: {
  kind: WorkspaceMemoryKind;
  id: string;
  isValue: JsonGuard<T>;
}): Promise<T | null> {
  try {
    const page = (await convexClient.query(convexApi.wiki.get, {
      path: workspaceDocumentPath(input.kind, input.id),
    })) as { revision?: { markdown?: unknown } | null } | null;
    const revision = page?.revision ?? null;
    const body =
      typeof revision?.markdown === "string" ? revision.markdown : "";
    const value = parseJsonBody(body);
    return input.isValue(value) ? value : null;
  } catch {
    return null;
  }
}

export async function writeWorkspaceDocument(input: {
  kind: WorkspaceMemoryKind;
  id: string;
  title: string;
  value: Record<string, unknown>;
}): Promise<MemoryDocument> {
  const body = JSON.stringify(input.value, null, 2);
  const now = new Date().toISOString();
  await convexClient.mutation(convexApi.wiki.save, {
    path: workspaceDocumentPath(input.kind, input.id),
    title: input.title,
    markdown: body,
    authorKind: "user",
    summary: "Saved from web workspace document API.",
  });
  return {
    id: input.id,
    kind: input.kind,
    title: input.title,
    body,
    createdAt: now,
    updatedAt: now,
  };
}
export function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function booleanValue(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

export function arrayValue<T>(
  value: unknown,
  isItem: JsonGuard<T>,
): T[] | null {
  if (!Array.isArray(value)) return null;
  const items: T[] = [];
  for (const item of value) {
    if (!isItem(item)) return null;
    items.push(item);
  }
  return items;
}
