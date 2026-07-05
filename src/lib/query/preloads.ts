import type { QueryClient } from "@tanstack/react-query";
import { fetchAgents } from "@/features/chat/api/client";
import {
  fetchDevJobs,
  fetchDevOsEvents,
  fetchDevRuns,
} from "@/features/dev/api/dev";
import { fetchHealthDashboard } from "@/features/health/api/health";
import { fetchLifeSnapshot } from "@/features/life/api/life";
import { fetchOverview } from "@/features/overview/api/overview";
import { queryKeys } from "@/lib/query/keys";

export const preloadRoutes = [
  "/",
  "/life",
  "/health",
  "/dev",
  "/chat",
  "/finance",
] as const;

const routePreloads: Record<string, (queryClient: QueryClient) => void> = {
  "/": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.overview(),
      queryFn: fetchOverview,
    });
  },
  "/life": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.life.snapshot(),
      queryFn: fetchLifeSnapshot,
    });
  },
  "/health": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.health.dashboard(),
      queryFn: fetchHealthDashboard,
    });
  },
  "/dev": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.dev.jobs(),
      queryFn: fetchDevJobs,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.dev.runs(),
      queryFn: fetchDevRuns,
    });
    void queryClient.prefetchQuery({
      queryKey: queryKeys.dev.osEvents(),
      queryFn: fetchDevOsEvents,
    });
  },
  "/chat": (queryClient) => {
    void queryClient.prefetchQuery({
      queryKey: queryKeys.agents(),
      queryFn: fetchAgents,
    });
  },
};

export function prefetchRouteData(queryClient: QueryClient, href: string) {
  routePreloads[href]?.(queryClient);
}

export function prefetchCoreData(queryClient: QueryClient) {
  preloadRoutes.forEach((route, index) => {
    window.setTimeout(() => prefetchRouteData(queryClient, route), index * 125);
  });
}
