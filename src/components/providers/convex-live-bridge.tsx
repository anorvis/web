"use client";

import { type QueryClient, useQueryClient } from "@tanstack/react-query";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { convexClient } from "@/lib/convex-client";
import { convexApi, type IntegrationPublication } from "@/lib/convex-functions";
import { clearLifeReadCache } from "@/lib/life-intelligence/life-read-cache";
import { queryKeys } from "@/lib/query/keys";

const PROVIDERS = {
  google: true,
  hevy: true,
  snaptrade: true,
  pinterest: true,
} as const;

type Provider = keyof typeof PROVIDERS;
type QueryKey = readonly unknown[];
type UpdateQuery = typeof convexApi.integrations.list;

export type ConvexWatchClient = {
  watchQuery: (
    query: UpdateQuery,
    args: Record<string, never>,
  ) => {
    onUpdate: (callback: () => void) => () => void;
    localQueryResult: () => IntegrationPublication[] | undefined;
  };
};

type LiveCache = {
  queryClient: Pick<QueryClient, "invalidateQueries">;
  clearLife: () => void;
  clearCalendar: () => void;
  onError: (error: Error) => void;
};

function asError(cause: unknown): Error {
  return cause instanceof Error
    ? cause
    : new Error("Convex live update failed");
}

function isProvider(value: string): value is Provider {
  return value in PROVIDERS;
}

function sequenceByProvider(connections: IntegrationPublication[]) {
  const sequences = new Map<string, number>();
  for (const connection of connections) {
    const { sequence } = connection.sync;
    if (!Number.isSafeInteger(sequence) || sequence < 0) continue;
    const current = sequences.get(connection.provider);
    if (current === undefined || sequence > current) {
      sequences.set(connection.provider, sequence);
    }
  }
  return sequences;
}

function changedProviders(
  previous: Map<string, number>,
  current: Map<string, number>,
): Set<Provider> {
  const changed = new Set<Provider>();
  for (const [provider, sequence] of current) {
    const prior = previous.get(provider);
    if (isProvider(provider) && (prior === undefined || sequence > prior)) {
      changed.add(provider);
    }
    if (prior !== undefined && sequence < prior) current.set(provider, prior);
  }
  for (const provider of previous.keys()) {
    if (!current.has(provider) && isProvider(provider)) changed.add(provider);
  }
  return changed;
}

function invalidationPlan(providers: Set<Provider>) {
  const keys: QueryKey[] = [];
  const seen = new Set<string>();
  const add = (key: QueryKey) => {
    const id = JSON.stringify(key);
    if (seen.has(id)) return;
    seen.add(id);
    keys.push(key);
  };

  let clearLife = false;
  let clearCalendar = false;
  if (providers.has("google")) {
    clearLife = true;
    clearCalendar = true;
    add(queryKeys.life.snapshot());
    add(queryKeys.life.calendarRoot());
  }
  if (providers.has("hevy")) {
    clearLife = true;
    add(queryKeys.health.dashboard());
    add(queryKeys.health.workoutsRoot());
    add(queryKeys.health.workoutRoot());
    add(queryKeys.health.sources());
    add(queryKeys.health.hevyRoutines());
    add(queryKeys.health.hevyExerciseTemplates());
    add(queryKeys.life.snapshot());
  }
  if (providers.has("snaptrade")) {
    add(queryKeys.finance.snapshot());
    add(queryKeys.finance.snaptradeSettings());
  }
  if (providers.has("pinterest")) {
    clearLife = true;
    add(queryKeys.life.pinterestBoardImages());
    add(queryKeys.life.snapshot());
  }
  if (providers.size > 0) {
    add(queryKeys.overview());
    add(queryKeys.integrations());
  }

  return { clearLife, clearCalendar, keys };
}

function invalidate(providers: Set<Provider>, cache: LiveCache) {
  if (providers.size === 0) return;
  const plan = invalidationPlan(providers);
  if (plan.clearLife) cache.clearLife();
  if (plan.clearCalendar) cache.clearCalendar();
  for (const queryKey of plan.keys) {
    void cache.queryClient
      .invalidateQueries({ queryKey })
      .catch((cause) => cache.onError(asError(cause)));
  }
}

export function subscribeConvexLiveUpdates(
  client: ConvexWatchClient,
  cache: LiveCache,
): () => void {
  let baseline: Map<string, number> | null = null;
  try {
    const watch = client.watchQuery(convexApi.integrations.list, {});
    const publish = () => {
      try {
        const connections = watch.localQueryResult();
        if (connections === undefined) return;
        const current = sequenceByProvider(connections);
        if (baseline === null) {
          baseline = current;
          return;
        }
        const changed = changedProviders(baseline, current);
        baseline = current;
        invalidate(changed, cache);
      } catch (cause) {
        cache.onError(asError(cause));
      }
    };
    const unsubscribe = watch.onUpdate(publish);
    publish();
    return unsubscribe;
  } catch (cause) {
    cache.onError(asError(cause));
    return () => {};
  }
}

function reportLiveError(error: Error) {
  console.error("Convex live update failed", error);
}

export function ConvexLiveBridge() {
  const queryClient = useQueryClient();

  useMountEffect(() =>
    subscribeConvexLiveUpdates(convexClient, {
      queryClient,
      clearLife: clearLifeReadCache,
      clearCalendar: () =>
        window.dispatchEvent(new Event("anorvis:calendar-cache-invalidated")),
      onError: reportLiveError,
    }),
  );

  return null;
}
