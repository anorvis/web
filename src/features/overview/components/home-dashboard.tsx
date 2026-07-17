"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchOverview } from "@/features/overview/api/overview";
import { MetricField } from "@/features/overview/components/metric-field";
import { queryKeys } from "@/lib/query/keys";

export function HomeDashboard() {
  const overviewQuery = useQuery({
    queryKey: queryKeys.overview(),
    queryFn: fetchOverview,
  });

  return <MetricField overview={overviewQuery.data} />;
}
