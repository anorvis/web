"use client";

import { fetchOverview } from "@/features/overview/api/overview";
import { MetricField } from "@/features/overview/components/metric-field";
import { usePersistedQuery } from "@/hooks/use-persisted-query";
import { queryKeys } from "@/lib/query/keys";

export function HomeDashboard() {
  const overviewQuery = usePersistedQuery({
    queryKey: queryKeys.overview(),
    queryFn: fetchOverview,
  });

  return <MetricField overview={overviewQuery.hydratedData} />;
}
