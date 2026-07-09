import {
  dehydrate,
  hydrate,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";
import { Schema } from "effect";
import { decodeUnknownResult } from "@/lib/effect/schema";

const STORAGE_KEY = "anorvis.query-cache.v1";
const MAX_CACHE_AGE_MS = 24 * 60 * 60_000;

const PersistedQueryCacheSchema = Schema.parseJson(
  Schema.Struct({
    savedAt: Schema.Number,
    cache: Schema.Unknown,
  }),
);

function isPersistableQueryKey(queryKey: QueryKey) {
  const [scope, entity] = queryKey;
  if (scope === "overview") return true;
  if (scope === "agents") return true;
  if (scope === "health" && entity === "dashboard") return true;
  if (scope === "life" && entity === "snapshot") return true;
  return scope === "dev";
}

function isPersistableQuery(query: Query) {
  return (
    query.state.status === "success" && isPersistableQueryKey(query.queryKey)
  );
}

function isFreshEnough(savedAt: number) {
  return Date.now() - savedAt < MAX_CACHE_AGE_MS;
}

export function restorePersistedQueryCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = decodeUnknownResult(PersistedQueryCacheSchema, raw);
    if (!parsed.ok || !isFreshEnough(parsed.value.savedAt)) return;
    hydrate(queryClient, parsed.value.cache);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function subscribePersistedQueryCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return () => {};

  let timer: number | null = null;
  const persist = () => {
    timer = null;
    try {
      const cache = dehydrate(queryClient, {
        shouldDehydrateQuery: isPersistableQuery,
      });
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ savedAt: Date.now(), cache }),
      );
    } catch {
      // Cache persistence is best effort.
    }
  };

  const unsubscribe = queryClient.getQueryCache().subscribe(() => {
    if (timer !== null) window.clearTimeout(timer);
    timer = window.setTimeout(persist, 500);
  });

  return () => {
    if (timer !== null) window.clearTimeout(timer);
    unsubscribe();
  };
}
