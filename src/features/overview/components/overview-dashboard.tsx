"use client";

import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import type { ReactNode } from "react";
import { fetchOverview } from "@/features/overview/api/overview";
import { IntegrationsCatalog } from "@/features/overview/components/integrations-catalog";
import { OverviewProvider } from "@/features/overview/components/overview-provider";
import { usePersistedQuery } from "@/hooks/use-persisted-query";
import { queryKeys } from "@/lib/query/keys";

type OverviewDashboardProps = {
  children?: ReactNode;
};

const INTEGRATION_SKELETONS = ["google", "obsidian", "next"];

export function OverviewDashboard({ children }: OverviewDashboardProps) {
  const { hydratedData: data } = usePersistedQuery({
    queryKey: queryKeys.overview(),
    queryFn: fetchOverview,
  });

  return data ? (
    <OverviewProvider data={data}>
      <IntegrationsCatalog />
      {children}
    </OverviewProvider>
  ) : (
    <OverviewDashboardLoading />
  );
}

function OverviewDashboardLoading() {
  return (
    <section className="space-y-3">
      <div className={workspacePageStyles.catalogHeader}>
        <div className="space-y-2">
          <Skeleton className="h-3 w-28 rounded-none" />
          <Skeleton className="h-5 w-48 rounded-none" />
        </div>
        <Skeleton className="h-3 w-32 rounded-none" />
      </div>
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-8 flex-1 rounded-none" />
        <Skeleton className="h-3 w-16 rounded-none" />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {INTEGRATION_SKELETONS.map((key) => (
          <Skeleton key={key} className="h-36 rounded-none" />
        ))}
      </div>
    </section>
  );
}
