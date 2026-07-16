import {
  type ContextOverview,
  normalizeContextOverview,
} from "@/features/dev/utils/context";
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

export async function fetchDevContext(): Promise<ContextOverview> {
  const value = await runEffect(
    requestJson<unknown>("/api/dev/context", { cache: "no-store" }),
  );
  return normalizeContextOverview(value);
}
