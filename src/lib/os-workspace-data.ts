import "server-only";
import { Schema } from "effect";

import { gatewayFetchJson } from "@/lib/anorvis-gateway";
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

function encodeSegment(value: string): string {
  return encodeURIComponent(value);
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
    const document = await gatewayFetchJson<MemoryDocument>(
      `/v1/memory/documents/${encodeSegment(input.kind)}/${encodeSegment(input.id)}`,
    );
    const value = parseJsonBody(document.body);
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
  return gatewayFetchJson<MemoryDocument>("/v1/memory/documents", {
    method: "POST",
    body: JSON.stringify({
      kind: input.kind,
      id: input.id,
      title: input.title,
      body: JSON.stringify(input.value, null, 2),
      provenance: [
        {
          source: "web-app",
          author: "web-app",
          createdAt: new Date().toISOString(),
        },
      ],
    }),
  });
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
