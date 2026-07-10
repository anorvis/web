import type { QueryClient } from "@tanstack/react-query";
import { fetchFinanceDashboard } from "@/features/finance/api/finance";
import { fetchHealthDashboard } from "@/features/health/api/health";
import { fetchLifeSnapshot } from "@/features/life/api/life";
import { fetchOverview } from "@/features/overview/api/overview";
import { queryKeys } from "@/lib/query/keys";
import { useFinancePreferences } from "@/lib/stores/finance-preferences";

export const preloadRoutes = ["/", "/life", "/health", "/finance"] as const;

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
  "/finance": (queryClient) => {
    const currency = useFinancePreferences.getState().preferredCurrency;
    void queryClient.prefetchQuery({
      queryKey: queryKeys.finance.snapshot(currency),
      queryFn: () => fetchFinanceDashboard(currency),
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
