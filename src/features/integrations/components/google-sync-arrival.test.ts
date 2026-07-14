import { describe, expect, it, vi } from "vitest";
import {
  type GoogleSyncWatcherDeps,
  watchGoogleSyncArrival,
} from "./google-sync-arrival";

type Status = { provider: string; status: string } | null | "reject";

// Mirrors the module-level pending-job state: the URL param is consumed on
// first read, later reads return the retained value until released.
function pendingJobStore(initial: string | null) {
  let fromUrl = initial;
  let pending: string | null = null;
  return {
    takeJobId: () => {
      if (fromUrl) {
        pending = fromUrl;
        fromUrl = null;
      }
      return pending;
    },
    releaseJobId: () => {
      pending = null;
    },
  };
}

function watcherDeps(
  store: ReturnType<typeof pendingJobStore>,
  statuses: Status[],
): GoogleSyncWatcherDeps & { refreshes: () => number; polls: () => number } {
  let refreshCount = 0;
  let pollCount = 0;
  return {
    ...store,
    fetchStatus: () => {
      pollCount += 1;
      // `null` is a meaningful status; only an exhausted queue falls back.
      const next = statuses.length > 0 ? statuses.shift() : undefined;
      const value: Status =
        next === undefined ? { provider: "google", status: "completed" } : next;
      if (value === "reject") return Promise.reject(new Error("transient"));
      return Promise.resolve(value);
    },
    refresh: () => {
      refreshCount += 1;
    },
    delayMs: 1,
    refreshes: () => refreshCount,
    polls: () => pollCount,
  };
}

async function settled(): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    const { promise, resolve } = Promise.withResolvers<void>();
    setTimeout(resolve, 2);
    await promise;
  }
}

describe("watchGoogleSyncArrival", () => {
  it("survives a Strict Mode effect replay and refreshes once", async () => {
    const store = pendingJobStore("job-1");
    const deps = watcherDeps(store, [
      { provider: "google", status: "pending" },
      { provider: "google", status: "pending" },
      { provider: "google", status: "completed" },
    ]);

    // Strict Mode: setup, immediate cleanup, replayed setup.
    const cleanupFirst = watchGoogleSyncArrival(deps);
    cleanupFirst();
    const cleanupSecond = watchGoogleSyncArrival(deps);

    await settled();
    expect(deps.refreshes()).toBe(1);
    // The pending job was released: nothing left for a later remount.
    expect(store.takeJobId()).toBeNull();
    cleanupSecond();
  });

  it("is inert without a handed job", async () => {
    const deps = watcherDeps(pendingJobStore(null), []);
    const cleanup = watchGoogleSyncArrival(deps);
    await settled();
    expect(deps.polls()).toBe(0);
    expect(deps.refreshes()).toBe(0);
    cleanup();
  });

  it("refreshes on a failed job so the error state is visible", async () => {
    const deps = watcherDeps(pendingJobStore("job-2"), [
      { provider: "google", status: "failed" },
    ]);
    watchGoogleSyncArrival(deps);
    await settled();
    expect(deps.refreshes()).toBe(1);
  });

  it("consumes an unknown job without refreshing", async () => {
    const store = pendingJobStore("job-3");
    const deps = watcherDeps(store, [null]);
    watchGoogleSyncArrival(deps);
    await settled();
    expect(deps.refreshes()).toBe(0);
    expect(store.takeJobId()).toBeNull();
  });

  it("does not refresh after cancellation, leaving the job for a resume", async () => {
    const store = pendingJobStore("job-4");
    const deps = watcherDeps(store, [
      { provider: "google", status: "pending" },
      { provider: "google", status: "pending" },
      { provider: "google", status: "pending" },
    ]);
    const cleanup = watchGoogleSyncArrival(deps);
    cleanup();
    await settled();
    expect(deps.refreshes()).toBe(0);
    // The replayed effect can still resume the same job.
    expect(store.takeJobId()).toBe("job-4");
  });
});

describe("transient failures", () => {
  it("retries rejected status queries instead of giving up", async () => {
    const store = pendingJobStore("job-5");
    const deps = watcherDeps(store, [
      "reject",
      "reject",
      { provider: "google", status: "completed" },
    ]);
    watchGoogleSyncArrival(deps);
    await settled();
    expect(deps.polls()).toBe(3);
    expect(deps.refreshes()).toBe(1);
    expect(store.takeJobId()).toBeNull();
  });
});
