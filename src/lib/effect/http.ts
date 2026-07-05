import { Effect } from "effect";
import {
  ApiError,
  DecodeError,
  errorMessage,
  isApiError,
} from "@/lib/effect/errors";

function readErrorPayload(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

export function requestJson<T>(
  path: string,
  init?: RequestInit,
): Effect.Effect<T, ApiError | DecodeError, never> {
  return Effect.tryPromise({
    try: async () => {
      const response = await fetch(path, {
        cache: "no-store",
        ...init,
        headers: {
          ...(init?.body ? { "Content-Type": "application/json" } : {}),
          ...init?.headers,
        },
      });
      const value: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new ApiError({
          status: response.status,
          path,
          message: readErrorPayload(
            value,
            `Request failed with status ${response.status}`,
          ),
        });
      }
      return value as T;
    },
    catch: (error) =>
      isApiError(error)
        ? error
        : new DecodeError({ message: errorMessage(error) }),
  });
}

export function postJson<T>(
  path: string,
  body: unknown,
): Effect.Effect<T, ApiError | DecodeError, never> {
  return requestJson<T>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function patchJson<T>(
  path: string,
  body: unknown,
): Effect.Effect<T, ApiError | DecodeError, never> {
  return requestJson<T>(path, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function deleteJson<T>(
  path: string,
  body?: unknown,
): Effect.Effect<T, ApiError | DecodeError, never> {
  return requestJson<T>(path, {
    method: "DELETE",
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
