import { devAuthHeaders } from "@/features/dev/api/session-token";
import type { UsageScope } from "@/features/dev/usage";
import {
  type AgentUsagePage,
  type MaintainerStatus,
  type MaintainerTicketPage,
  normalizeMaintainerStatus,
  normalizePreflight,
  normalizeSessionPage,
  normalizeSmoke,
  normalizeTicketPage,
  normalizeVaultLogin,
  type PreflightResult,
  type SmokeResult,
  type VaultLoginResult,
} from "@/features/dev/utils/maintainer";
import { requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";

/** GET against /api/dev with the owner-guard session token attached. */
function devGet(path: string) {
  return requestJson<unknown>(path, {
    cache: "no-store",
    headers: devAuthHeaders(),
  });
}

/** POST against /api/dev with the owner-guard session token attached. */
function devPost(path: string, body: unknown) {
  return requestJson<unknown>(path, {
    method: "POST",
    body: JSON.stringify(body),
    headers: devAuthHeaders(),
  });
}

export async function fetchMaintainerStatus(): Promise<MaintainerStatus> {
  const value = await runEffect(devGet("/api/dev/maintainer/status"));
  return normalizeMaintainerStatus(value);
}

export async function fetchMaintainerTickets(
  statuses: readonly string[],
  page: number,
  pageSize: number,
): Promise<MaintainerTicketPage> {
  const query = new URLSearchParams({
    status: statuses.join(","),
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  const value = await runEffect(
    devGet(`/api/dev/maintainer/overview?${query.toString()}`),
  );
  return normalizeTicketPage(value);
}

export async function fetchAgentUsagePage(
  scope: UsageScope,
  page: number,
  pageSize: number,
): Promise<AgentUsagePage> {
  const query = new URLSearchParams({
    view: "sessions",
    scope,
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  const value = await runEffect(
    devGet(`/api/dev/maintainer/overview?${query.toString()}`),
  );
  return normalizeSessionPage(value);
}

export async function updateMaintainerSettings(
  enabled: boolean,
): Promise<void> {
  await runEffect(devPost("/api/dev/maintainer/settings", { enabled }));
}

export async function saveMaintainerCredentials(payload: {
  githubToken: string;
}): Promise<void> {
  await runEffect(devPost("/api/dev/maintainer/credentials", payload));
}

export async function runMaintainerPreflight(): Promise<PreflightResult> {
  const value = await runEffect(devPost("/api/dev/maintainer/preflight", {}));
  return normalizePreflight(value);
}

export async function runMaintainerSmoke(): Promise<SmokeResult> {
  const value = await runEffect(devPost("/api/dev/maintainer/smoke", {}));
  return normalizeSmoke(value);
}

export async function runMaintainerVaultLogin(): Promise<VaultLoginResult> {
  const value = await runEffect(devPost("/api/dev/maintainer/vault-login", {}));
  return normalizeVaultLogin(value);
}
