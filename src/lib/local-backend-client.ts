import { Schema } from "effect";
import { decodeUnknown } from "@/lib/effect/schema";

const DEFAULT_LOCAL_BACKEND_URL = "http://127.0.0.1:8787";
const LOCAL_BACKEND_TOKEN_STORAGE_KEY = "anorvis.localBackendToken";

const JsonTextSchema = Schema.parseJson(Schema.Unknown);

export function shouldUseBrowserLocalBackend() {
  return false;
}

export function resolveBrowserLocalBackendUrl() {
  return (
    process.env.NEXT_PUBLIC_ANORVIS_OS_URL?.replace(/\/$/, "") ||
    DEFAULT_LOCAL_BACKEND_URL
  );
}

export function getStoredBrowserLocalBackendToken() {
  try {
    return window.localStorage.getItem(LOCAL_BACKEND_TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeBrowserLocalToken(token: string) {
  try {
    window.localStorage.setItem(LOCAL_BACKEND_TOKEN_STORAGE_KEY, token);
  } catch {
    // Keep the in-memory request flow working even when storage is unavailable.
  }
}

export function clearBrowserLocalBackendToken() {
  try {
    window.localStorage.removeItem(LOCAL_BACKEND_TOKEN_STORAGE_KEY);
  } catch {
    // Storage may be disabled.
  }
}

function createBrowserLocalToken() {
  return `web-${crypto.randomUUID()}`;
}

async function handshakeBrowserLocalBackend(token: string) {
  const response = await fetch(
    new URL("/v1/auth/handshake", resolveBrowserLocalBackendUrl()).toString(),
    {
      method: "POST",
      cache: "no-store",
      mode: "cors",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    },
  );
  if (!response.ok) {
    throw new Error(`local anorvis-os handshake failed: ${response.status}`);
  }
}

export async function ensureBrowserLocalBackendToken() {
  const stored = getStoredBrowserLocalBackendToken();
  if (stored) return stored;
  const token = createBrowserLocalToken();
  await handshakeBrowserLocalBackend(token);
  storeBrowserLocalToken(token);
  return token;
}

export async function checkBrowserLocalBackendToken(token: string) {
  const response = await fetch(
    new URL("/v1/overview", resolveBrowserLocalBackendUrl()).toString(),
    {
      cache: "no-store",
      mode: "cors",
      headers: { authorization: `Bearer ${token}` },
    },
  );
  return response.status !== 401;
}

async function fetchBrowserLocal(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const token = await ensureBrowserLocalBackendToken();
  headers.set("authorization", `Bearer ${token}`);

  return fetch(new URL(pathname, resolveBrowserLocalBackendUrl()).toString(), {
    cache: "no-store",
    mode: "cors",
    ...init,
    headers,
  });
}

export async function requestBrowserLocalJson<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  let response = await fetchBrowserLocal(pathname, init);
  if (response.status === 401) {
    clearBrowserLocalBackendToken();
    response = await fetchBrowserLocal(pathname, init);
  }

  if (!response.ok) {
    throw new Error(`local anorvis-os request failed: ${response.status}`);
  }

  if (response.status === 204) return null as T;
  const text = await response.text();
  return text ? (decodeUnknown(JsonTextSchema, text) as T) : (null as T);
}
