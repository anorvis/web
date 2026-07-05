"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { prefetchCoreData, preloadRoutes } from "@/lib/query/preloads";

const PRELOAD_PATHS = new Set(["/life", "/health", "/chat", "/dev"]);

function onIdle(callback: () => void, timeout = 1_500) {
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(callback, { timeout });
    return () => window.cancelIdleCallback(id);
  }
  const id = globalThis.setTimeout(callback, 250);
  return () => globalThis.clearTimeout(id);
}

export function AppDataPreloader() {
  const queryClient = useQueryClient();
  const router = useRouter();

  useMountEffect(() => {
    const warmRoutes = () => {
      for (const route of preloadRoutes) router.prefetch(route);
    };

    const cancelDataWarm = PRELOAD_PATHS.has(window.location.pathname)
      ? onIdle(() => prefetchCoreData(queryClient))
      : () => {};
    const cancelRouteWarm = onIdle(warmRoutes, 2_000);

    return () => {
      cancelDataWarm();
      cancelRouteWarm();
    };
  });

  return null;
}
