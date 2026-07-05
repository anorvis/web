import {
  dehydrate,
  hydrate,
  type Query,
  type QueryClient,
  type QueryKey,
} from "@tanstack/react-query";

const STORAGE_KEY = "anorvis.query-cache.v1";
const MAX_CACHE_AGE_MS = 24 * 60 * 60_000;

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

function isFreshEnough(value: unknown) {
  if (!value || typeof value !== "object" || !("savedAt" in value)) {
    return false;
  }
  const savedAt = (value as { savedAt: unknown }).savedAt;
  return typeof savedAt === "number" && Date.now() - savedAt < MAX_CACHE_AGE_MS;
}

export function restorePersistedQueryCache(queryClient: QueryClient) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as unknown;
    if (!isFreshEnough(parsed)) return;
    hydrate(queryClient, (parsed as { cache: unknown }).cache);
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
