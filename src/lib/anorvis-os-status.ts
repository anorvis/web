const CHECK_TIMEOUT_MS = 750;
const CHECK_TTL_MS = 5_000;

type CachedStatus = {
  checkedAt: number;
  isUp: boolean;
};

let cachedStatus: CachedStatus | null = null;

export function resolveAnorvisHealthUrl() {
  return new URL(
    "/health",
    process.env.ANORVIS_OS_URL?.trim() || "http://127.0.0.1:8787",
  ).toString();
}

export async function isAnorvisOsUp() {
  const now = Date.now();
  if (cachedStatus && now - cachedStatus.checkedAt < CHECK_TTL_MS) {
    return cachedStatus.isUp;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const response = await fetch(resolveAnorvisHealthUrl(), {
      cache: "no-store",
      signal: controller.signal,
    });
    const isUp = response.ok;
    cachedStatus = { checkedAt: now, isUp };
    return isUp;
  } catch {
    cachedStatus = { checkedAt: now, isUp: false };
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
