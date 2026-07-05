import type { OverviewData } from "@/features/overview/types/overview";
import { requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";

export function fetchOverview(): Promise<OverviewData> {
  return runEffect(requestJson<OverviewData>("/api/overview"));
}
