import { devAuthHeaders } from "@/features/dev/api/session-token";
import type { UsageScope } from "@/features/dev/usage";
import {
  type AgentUsagePage,
  type LinearStatus,
  type LinearSyncResult,
  type LinearTeam,
  type MaintainerStatus,
  type MaintainerTicketPage,
  normalizeLinearStatus,
  normalizeLinearSync,
  normalizeLinearTeams,
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
import { isRecord } from "@/lib/guards";

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

export async function triageMaintainerTicket(
  id: string,
  action: "approve" | "dismiss",
): Promise<void> {
  await runEffect(
    devPost("/api/dev/maintainer/tickets/triage", { id, action }),
  );
}

export async function fetchLinearStatus(): Promise<LinearStatus> {
  const value = await runEffect(devGet("/api/dev/maintainer/linear"));
  return normalizeLinearStatus(value);
}

export async function saveLinearCredentials(payload: {
  clientId?: string;
  clientSecret?: string;
  apiKey?: string;
}): Promise<void> {
  await runEffect(devPost("/api/dev/maintainer/linear/credentials", payload));
}

export async function startLinearSignIn(): Promise<string> {
  const value = await runEffect(
    devPost("/api/dev/maintainer/linear/authorize", {}),
  );
  const url =
    isRecord(value) && typeof value.authorizationUrl === "string"
      ? value.authorizationUrl
      : null;
  if (!url?.startsWith("https://linear.app/")) {
    throw new Error("the gateway did not return a linear sign-in url.");
  }
  return url;
}

export async function fetchLinearTeams(): Promise<LinearTeam[]> {
  const value = await runEffect(devGet("/api/dev/maintainer/linear/teams"));
  return normalizeLinearTeams(value);
}

export async function saveLinearTeam(teamId: string): Promise<void> {
  await runEffect(devPost("/api/dev/maintainer/linear/team", { teamId }));
}

export async function disconnectLinear(): Promise<void> {
  await runEffect(devPost("/api/dev/maintainer/linear/disconnect", {}));
}

export async function syncLinear(): Promise<LinearSyncResult> {
  const value = await runEffect(devPost("/api/dev/maintainer/linear/sync", {}));
  return normalizeLinearSync(value);
}
