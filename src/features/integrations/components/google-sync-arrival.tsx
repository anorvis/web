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

export type GoogleSyncWatcherDeps = {
  takeJobId: () => string | null;
  releaseJobId: () => void;
  fetchStatus: (jobId: string) => Promise<SyncJobStatus>;
  refresh: () => void;
  delayMs?: number;
};

// The URL param is consumed on the first read, but React Strict Mode replays
// effects (setup -> cleanup -> setup). The pending job therefore lives in
// module state so the replayed setup can resume the watch; it is released
// only once a terminal state (or the budget) has triggered the refresh.
let pendingJobId: string | null = null;

function takeHandedJobId(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("googleSync");
  if (fromUrl) {
    pendingJobId = fromUrl;
    const url = new URL(window.location.href);
    url.searchParams.delete("googleSync");
    window.history.replaceState(null, "", url.toString());
  }
  return pendingJobId;
}

function releaseHandedJobId(): void {
  pendingJobId = null;
}

// Follows the initial sync job handed over by the Google OAuth callback and
// refreshes cached life reads when it finishes. Returns a cleanup; a
// cancelled watcher leaves the job pending so a replayed effect resumes it.
export function watchGoogleSyncArrival(
  deps: GoogleSyncWatcherDeps,
): () => void {
  const jobId = deps.takeJobId();
  if (!jobId) return () => {};
  let cancelled = false;
  const finish = () => {
    deps.releaseJobId();
    deps.refresh();
  };
  const follow = async () => {
    for (let attempt = 0; attempt < 60; attempt += 1) {
      // A rejected query is transient (auth still settling, network blip):
      // retry within the budget. Only a successful null answer means the job
      // is unknown or foreign and gets consumed without a refresh.
      let job: SyncJobStatus | undefined;
      try {
        job = await deps.fetchStatus(jobId);
      } catch {
        job = undefined;
      }
      if (cancelled) return;
      if (job === null) {
        deps.releaseJobId();
        return;
      }
      if (
        job !== undefined &&
        (job.status === "completed" || job.status === "failed")
      ) {
        finish();
        return;
      }
      const { promise, resolve } = Promise.withResolvers<void>();
      setTimeout(resolve, deps.delayMs ?? 1000);
      await promise;
      if (cancelled) return;
    }
    // Budget exhausted: refresh anyway so partial results appear.
    finish();
  };
  void follow();
  return () => {
    cancelled = true;
  };
}

export function GoogleSyncArrival() {
  const queryClient = useQueryClient();
  useMountEffect(() =>
    watchGoogleSyncArrival({
      takeJobId: takeHandedJobId,
      releaseJobId: releaseHandedJobId,
      fetchStatus: (jobId) =>
        convexClient.query(convexApi.integrations.syncJobStatus, {
          jobId,
        }) as Promise<SyncJobStatus>,
      refresh: () => {
        clearLifeReadCache();
        void queryClient.invalidateQueries({ queryKey: ["life"] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.overview() });
      },
    }),
  );
  return null;
}
