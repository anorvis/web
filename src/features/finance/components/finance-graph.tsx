"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@anorvis/ui/chart";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts";
import type { PortfolioHistoryPoint } from "@/features/finance/types/finance";
import type { FinanceData } from "@/lib/life-intelligence/model";
import { monthlySeries, netWorthSeries } from "./finance-derive";
import {
  currencyTooltipFormatter,
  EmptyState,
  FinanceTabs,
  financeTabPanelProps,
} from "./finance-panels";

type GraphTab = "networth" | "cashflow";

const TABS: { id: GraphTab; label: string }[] = [
  { id: "networth", label: "net worth" },
  { id: "cashflow", label: "cash flow" },
];

const PANEL_LABEL = "finance graph tabs";
const captionClass =
  "text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground";

const netWorthConfig: ChartConfig = {
  netWorth: { label: "net worth", color: "var(--foreground)" },
};
// Match the emerald/red money tones used across Finance rows and cards.
const cashflowConfig: ChartConfig = {
  income: { label: "income", color: "var(--color-emerald-300, #6ee7b7)" },
  spending: { label: "spending", color: "var(--color-red-300, #fca5a5)" },
};

const axisProps = {
  tickLine: false,
  axisLine: false,
  tickMargin: 8,
} as const;

/**
 * records only — backend-converted all-account net-worth history and imported
 * transactions — and each currency is charted on its own; different currencies
 * are never merged.
 */
export function FinanceGraph({
  finance,
  history,
  currency,
  loading,
  isError,
  onRetry,
}: {
  finance: FinanceData;
  history: PortfolioHistoryPoint[];
  currency: string;
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [tab, setTab] = useState<GraphTab>("networth");
  const netWorth = useMemo(() => netWorthSeries(history), [history]);
  const monthly = useMemo(
    () => monthlySeries(finance, currency, 6),
    [finance, currency],
  );

  if (loading) {
    return <Skeleton className="h-full rounded-none" />;
  }

  const caption =
    tab === "networth" ? "all-account net worth" : "monthly income vs spending";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 overflow-hidden">
        <div className="min-w-0">
          <p className={workspacePageStyles.cardLabel}>overview</p>
          <p className={`${captionClass} truncate`} title={caption}>
            {caption}
          </p>
        </div>
        <FinanceTabs
          label={PANEL_LABEL}
          tabs={TABS}
          active={tab}
          onSelect={(id) => setTab(id as GraphTab)}
        />
      </div>

      <div
        className="min-h-0 flex-1"
        {...financeTabPanelProps(PANEL_LABEL, tab)}
      >
        {tab === "networth" ? (
          isError ? (
            <EmptyState
              title="Net-worth history could not be loaded."
              body="Check that anorvis-os is running, then retry."
              action={
                <button
                  type="button"
                  className={workspacePageStyles.modalButton}
                  onClick={onRetry}
                >
                  retry
                </button>
              }
            />
          ) : netWorth.length > 0 ? (
            <ChartContainer
              config={netWorthConfig}
              className="aspect-auto h-full min-h-0 w-full"
            >
              <LineChart
                data={netWorth}
                margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" minTickGap={24} {...axisProps} />
                <YAxis width={52} {...axisProps} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="line"
                      formatter={currencyTooltipFormatter(
                        netWorthConfig,
                        currency,
                      )}
                    />
                  }
                />
                <Line
                  dataKey="netWorth"
                  type="monotone"
                  stroke="var(--color-netWorth)"
                  strokeWidth={2}
                  dot={netWorth.length === 1 ? { r: 4 } : false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
          ) : (
            <EmptyState
              title="No net-worth history yet."
              body="Net-worth history appears after accounts have reported balances."
            />
          )
        ) : monthly.length > 0 ? (
          <ChartContainer
            config={cashflowConfig}
            className="aspect-auto h-full min-h-0 w-full"
          >
            <BarChart
              data={monthly}
              margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" minTickGap={16} {...axisProps} />
              <YAxis width={52} {...axisProps} />
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    indicator="line"
                    formatter={currencyTooltipFormatter(
                      cashflowConfig,
                      currency,
                    )}
                  />
                }
              />
              <Bar dataKey="income" fill="var(--color-income)" radius={2} />
              <Bar dataKey="spending" fill="var(--color-spending)" radius={2} />
            </BarChart>
          </ChartContainer>
        ) : (
          <EmptyState
            title="No monthly cash flow yet."
            body="Import transactions to build a monthly income and spending series."
          />
        )}
      </div>
    </div>
  );
}
