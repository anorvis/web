"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";
import { clearLifeReadCache } from "@/lib/life-intelligence/life-read-cache";
import { queryKeys } from "@/lib/query/keys";

type SyncJobStatus = {
  provider: string;
  status: string;
  error?: string;
} | null;

function handedJobId(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get("googleSync");
}

function stripParam(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete("googleSync");
  window.history.replaceState(null, "", url.toString());
}

// The Google OAuth callback lands here with the initial sync job in the URL.
// Follow that exact job and refresh the cached life reads when it finishes,
// so the calendar populates without a manual reload.
export function GoogleSyncArrival() {
  const queryClient = useQueryClient();
  useMountEffect(() => {
    const jobId = handedJobId();
    if (!jobId) return;
    stripParam();
    let cancelled = false;
    const refresh = () => {
      clearLifeReadCache();
      void queryClient.invalidateQueries({ queryKey: ["life"] });
      void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
    };
    const follow = async () => {
      for (let attempt = 0; attempt < 60 && !cancelled; attempt += 1) {
        const job = (await convexClient
          .query(convexApi.integrations.syncJobStatus, { jobId })
          .catch(() => null)) as SyncJobStatus;
        if (job === null) return;
        if (job.status === "completed" || job.status === "failed") {
          refresh();
          return;
        }
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, 1000);
        await promise;
      }
      // Budget exhausted: refresh anyway so partial results appear.
      refresh();
    };
    void follow();
    return () => {
      cancelled = true;
    };
  });
  return null;
}
