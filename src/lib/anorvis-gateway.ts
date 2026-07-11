import { Cause, Effect, Runtime, Schema } from "effect";
import { NextResponse } from "next/server";
import {
  resolveAnorvisGatewayBaseUrl,
  resolveAnorvisGatewayToken,
} from "@/lib/anorvis-local-config";
import {
  ApiError,
  DecodeError,
  errorMessage,
  isApiError,
} from "@/lib/effect/errors";
import { decodeUnknown } from "@/lib/effect/schema";

export type GatewayAgent = {
  key: string;
  name: string;
};

const JsonTextSchema = Schema.parseJson(Schema.Unknown);
export async function gatewayFetch(pathname: string, init: RequestInit = {}) {
  return Effect.runPromise(gatewayFetchEffect(pathname, init));
}

export function gatewayFetchEffect(
  pathname: string,
  init: RequestInit = {},
): Effect.Effect<Response, DecodeError, never> {
  return Effect.tryPromise({
    try: async () => {
      const headers = new Headers(init.headers);
      const token = resolveAnorvisGatewayToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (init.body && !headers.has("Content-Type")) {
        headers.set("Content-Type", "application/json");
      }

      return fetch(new URL(pathname, resolveAnorvisGatewayBaseUrl()), {
        ...init,
        headers,
        cache: "no-store",
      });
    },
    catch: (error) => new DecodeError({ message: errorMessage(error) }),
  });
}

export async function gatewayFetchJson<T>(
  pathname: string,
  init: RequestInit = {},
): Promise<T> {
  return Effect.runPromise(gatewayFetchJsonEffect<T>(pathname, init));
}

export function gatewayFetchJsonEffect<T>(
  pathname: string,
  init: RequestInit = {},
): Effect.Effect<T, ApiError | DecodeError, never> {
  return Effect.flatMap(gatewayFetchEffect(pathname, init), (response) =>
    Effect.tryPromise({
      try: async () => {
        const text = await response.text();
        let payload: unknown = null;
        if (text) {
          try {
            payload = decodeUnknown(JsonTextSchema, text);
          } catch {
            throw new DecodeError({
              message: `anorvis-os returned invalid JSON for ${pathname}.`,
            });
          }
        }

        if (!response.ok) {
          throw new ApiError({
            status: response.status,
            path: pathname,
            message: errorPayload(
              payload,
              text || `Request failed with status ${response.status}`,
            ),
          });
        }

        return payload as T;
      },
      catch: (error) =>
        isApiError(error) || error instanceof DecodeError
          ? error
          : new DecodeError({ message: errorMessage(error) }),
    }),
  );
}

export function gatewayErrorResponse(error: unknown) {
  const apiError = getApiError(error);
  const message = apiError?.message ?? errorMessage(error);
  return NextResponse.json(
    { error: message },
    { status: apiError?.status ?? 502 },
  );
}

function getApiError(error: unknown): ApiError | undefined {
  if (isApiError(error)) return error;
  if (!Runtime.isFiberFailure(error)) return undefined;
  const failure = Cause.failureOption(error[Runtime.FiberFailureCauseId]);
  return failure._tag === "Some" && isApiError(failure.value)
    ? failure.value
    : undefined;
}

function errorPayload(value: unknown, fallback: string): string {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    "error" in value &&
    typeof value.error === "string"
  )
    return value.error;
  return fallback;
}
