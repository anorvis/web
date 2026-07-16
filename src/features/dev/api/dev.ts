import {
  type ContextOverview,
  normalizeContextOverview,
} from "@/features/dev/utils/context";
import {
  type MaintainerSessionPage,
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
import { postJson, requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";

export async function fetchDevContext(): Promise<ContextOverview> {
  const value = await runEffect(
    requestJson<unknown>("/api/dev/context", { cache: "no-store" }),
  );
  return normalizeContextOverview(value);
}

export async function fetchMaintainerStatus(): Promise<MaintainerStatus> {
  const value = await runEffect(
    requestJson<unknown>("/api/dev/maintainer/status", { cache: "no-store" }),
  );
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
    requestJson<unknown>(`/api/dev/maintainer/overview?${query.toString()}`, {
      cache: "no-store",
    }),
  );
  return normalizeTicketPage(value);
}

export async function fetchMaintainerSessions(
  page: number,
  pageSize: number,
): Promise<MaintainerSessionPage> {
  const query = new URLSearchParams({
    view: "sessions",
    limit: String(pageSize),
    offset: String(page * pageSize),
  });
  const value = await runEffect(
    requestJson<unknown>(`/api/dev/maintainer/overview?${query.toString()}`, {
      cache: "no-store",
    }),
  );
  return normalizeSessionPage(value);
}

export async function updateMaintainerSettings(
  enabled: boolean,
): Promise<void> {
  await runEffect(
    postJson<unknown>("/api/dev/maintainer/settings", { enabled }),
  );
}

export async function saveMaintainerCredentials(payload: {
  githubToken?: string;
  apiKeys?: Record<string, string>;
}): Promise<void> {
  await runEffect(
    postJson<unknown>("/api/dev/maintainer/credentials", payload),
  );
}

export async function runMaintainerPreflight(): Promise<PreflightResult> {
  const value = await runEffect(
    postJson<unknown>("/api/dev/maintainer/preflight", {}),
  );
  return normalizePreflight(value);
}

export async function runMaintainerSmoke(): Promise<SmokeResult> {
  const value = await runEffect(
    postJson<unknown>("/api/dev/maintainer/smoke", {}),
  );
  return normalizeSmoke(value);
}

export async function runMaintainerVaultLogin(): Promise<VaultLoginResult> {
  const value = await runEffect(
    postJson<unknown>("/api/dev/maintainer/vault-login", {}),
  );
  return normalizeVaultLogin(value);
}
