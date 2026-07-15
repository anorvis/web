import {
  type MaintenanceOverview,
  normalizeMaintenanceOverview,
} from "@/features/dev/utils/maintenance";
import { requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";

export function fetchDevJobs(): Promise<unknown[]> {
  return runEffect(requestJson<unknown[]>("/api/dev/jobs"));
}

export function fetchDevRuns(): Promise<unknown[]> {
  return runEffect(requestJson<unknown[]>("/api/dev/runs"));
}

export function fetchDevOsEvents(): Promise<unknown[]> {
  return runEffect(requestJson<unknown[]>("/api/dev/os-events"));
}

export async function fetchDevMaintenance(): Promise<MaintenanceOverview> {
  const value = await runEffect(
    requestJson<unknown>("/api/dev/maintenance", { cache: "no-store" }),
  );
  return normalizeMaintenanceOverview(value);
}
