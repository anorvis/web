import { deleteJson, postJson, requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";

export function fetchIntegrationSettings<T>(path: string): Promise<T> {
  return runEffect(requestJson<T>(path));
}

export function saveIntegrationSettings<T>(
  path: string,
  body: unknown,
): Promise<T> {
  return runEffect(postJson<T>(path, body));
}

export function postIntegrationAction<T>(path: string): Promise<T> {
  return runEffect(postJson<T>(path, undefined));
}

export function deleteIntegrationAction<T>(
  path: string,
  body: unknown,
): Promise<T> {
  return runEffect(deleteJson<T>(path, body));
}

export function saveIntegrationToken(input: {
  provider: string;
  token: string;
}): Promise<unknown> {
  return runEffect(postJson<unknown>("/api/integrations/save-token", input));
}
