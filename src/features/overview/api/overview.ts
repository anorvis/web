import type { OverviewData } from "@/features/overview/types/overview";
import { requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";
import {
  requestBrowserLocalJson,
  shouldUseBrowserLocalBackend,
} from "@/lib/local-backend-client";

export function fetchOverview(): Promise<OverviewData> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<OverviewData>("/v1/overview");
  }

  return runEffect(requestJson<OverviewData>("/api/overview"));
}
