const LIFE_READ_CACHE_TTL_MS = 60_000;
const lifeReadCache = new Map<
  string,
  { expiresAt: number; promise: Promise<unknown> }
>();

export function clearLifeReadCache() {
  lifeReadCache.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("anorvis:life-read-cache-invalidated", () => {
    clearLifeReadCache();
  });
  window.addEventListener("anorvis:calendar-cache-invalidated", () => {
    clearLifeReadCache();
  });
}

export function cachedLifeRead<T>(
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cached = lifeReadCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.promise as Promise<T>;
  }
  const promise = load().catch((error) => {
    lifeReadCache.delete(key);
    throw error;
  });
  lifeReadCache.set(key, {
    expiresAt: Date.now() + LIFE_READ_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

export function clearAfterLifeMutation<T>(promise: Promise<T>): Promise<T> {
  return promise.finally(clearLifeReadCache);
}
