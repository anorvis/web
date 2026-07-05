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
