import { NextResponse } from "next/server";
import {
  resolveAnorvisGatewayBaseUrl,
  resolveAnorvisGatewayToken,
} from "@/lib/anorvis-local-config";

export type GatewayAgent = {
  key: string;
  name: string;
};

export type GatewaySession = {
  id: string;
  surface?: string;
  externalId?: string;
  agent: string;
  piSessionId?: string;
  createdAt?: string;
  updatedAt?: string;
  title?: string;
  messageCount?: number;
  lastMessagePreview?: string | null;
  lastMessageAt?: string | null;
};

export type GatewayMessage = {
  id: string;
  sender: string;
  displayName: string;
  content: string;
  createdAt: string;
};

export async function gatewayFetch(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${resolveAnorvisGatewayToken()}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(new URL(pathname, resolveAnorvisGatewayBaseUrl()), {
    ...init,
    headers,
    cache: "no-store",
  });
}

export async function gatewayFetchJson<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await gatewayFetch(pathname, init);
  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new Error(`anorvis-os returned invalid JSON for ${pathname}.`);
    }
  }

  if (!response.ok) {
    const error =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof payload.error === "string"
        ? payload.error
        : text || `Request failed with status ${response.status}`;
    throw new Error(error);
  }

  return payload as T;
}

export function buildWebSdkSessionId(userId: string, threadId: string): string {
  return `web:${userId}:${threadId}`;
}

export function buildWebExternalId(
  userId: string,
  threadId: string,
  agent: string,
): string {
  return `${agent}:${buildWebSdkSessionId(userId, threadId)}`;
}

export async function resolveWebGatewaySession(input: {
  userId: string;
  threadId: string;
  agent: string;
}) {
  return gatewayFetchJson<{ record: GatewaySession }>("/v1/chat/sessions", {
    method: "POST",
    body: JSON.stringify({
      surface: "web",
      externalId: buildWebExternalId(input.userId, input.threadId, input.agent),
      agent: input.agent,
    }),
  });
}

export function gatewayErrorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return NextResponse.json({ error: message }, { status: 502 });
}
