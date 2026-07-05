"use client";

import { createContext, type ReactNode, use } from "react";
import type { OverviewData } from "@/features/overview/types/overview";

const OverviewContext = createContext<OverviewData | null>(null);

export function OverviewProvider({
  data,
  children,
}: {
  data: OverviewData;
  children: ReactNode;
}) {
  return (
    <OverviewContext.Provider value={data}>{children}</OverviewContext.Provider>
  );
}

function useOverviewContext(): OverviewData {
  const ctx = use(OverviewContext);
  if (!ctx)
    throw new Error("useOverview* must be used inside OverviewProvider");
  return ctx;
}

export function useOverview() {
  return useOverviewContext();
}

export function useHealth() {
  return useOverviewContext().health;
}

export function useLife() {
  return useOverviewContext().life;
}

export function useFinance() {
  return useOverviewContext().finance;
}

export function useIntegrations() {
  return useOverviewContext().integrations;
}
