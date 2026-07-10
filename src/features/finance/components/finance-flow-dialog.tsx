"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@anorvis/ui/chart";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMemo, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { RecordRow } from "@/components/life-intelligence/record-ui";
import {
  cashflowTransactions,
  formatCurrencyAmount,
  formatTransactionDate,
  incomeByCategory,
  monthlySeries,
  spendingByCategory,
} from "@/features/finance/components/finance-derive";
import {
  currencyTooltipFormatter,
  EmptyState,
  FinanceDialog,
  PaginatedRecords,
  safePageIndex,
} from "@/features/finance/components/finance-panels";
import { accountName } from "@/lib/life-intelligence/derive";
import type { FinanceData } from "@/lib/life-intelligence/model";

// Theme defines exactly five chart tokens; the tail folds into "other" so the
// pie never renders an unfilled slice.
const SLICE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

type FlowKind = "income" | "spending";

type FlowSlice = {
  key: string;
  label: string;
  total: number;
  fill: string;
};

/**
 * Shared month-paged detail dialog for the income and spending cards: one
 * month at a time with a category pie, category totals, and that month's
 * posted transactions on the matching side of the cashflow.
 */
export function FinanceFlowDialog({
  finance,
  reportingCurrency,
  kind,
  open,
  onOpenChange,
}: {
  finance: FinanceData;
  reportingCurrency: string;
  kind: FlowKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [monthPage, setMonthPage] = useState(0);
  const months = useMemo(
    () => [...monthlySeries(finance, reportingCurrency, null)].reverse(),
    [finance, reportingCurrency],
  );
  const monthIndex = safePageIndex(monthPage, months.length);
  const month = months[monthIndex] ?? null;
  const total = month ? (kind === "income" ? month.income : month.spending) : 0;
  const categories = useMemo(
    () =>
      month
        ? kind === "income"
          ? incomeByCategory(finance, reportingCurrency, month.month)
          : spendingByCategory(finance, reportingCurrency, month.month)
        : [],
    [finance, reportingCurrency, month, kind],
  );
  const slices = useMemo<FlowSlice[]>(() => {
    const top = categories.slice(0, SLICE_COLORS.length - 1);
    const rest = categories.slice(SLICE_COLORS.length - 1);
    const entries = top.map((entry, index) => ({
      key: `slice-${index}`,
      label: entry.label,
      total: entry.total,
      fill: SLICE_COLORS[index],
    }));
    const restTotal = rest.reduce((sum, entry) => sum + entry.total, 0);
    if (restTotal > 0) {
      entries.push({
        key: `slice-${entries.length}`,
        label: "other",
        total: Math.round(restTotal * 100) / 100,
        fill: SLICE_COLORS[entries.length],
      });
    }
    return entries;
  }, [categories]);
  const pieConfig = useMemo(() => {
    const config: ChartConfig = {};
    for (const slice of slices) {
      config[slice.key] = { label: slice.label, color: slice.fill };
    }
    return config;
  }, [slices]);
  const transactions = useMemo(() => {
    if (!month) return [];
    const monthFinance = {
      ...finance,
      transactions: finance.transactions.filter((transaction) =>
        (transaction.time ?? "").startsWith(month.month),
      ),
    };
    return cashflowTransactions(monthFinance, reportingCurrency).filter(
      (transaction) =>
        kind === "income" ? transaction.amount > 0 : transaction.amount < 0,
    );
  }, [finance, reportingCurrency, month, kind]);
  const tone = kind === "income" ? "text-emerald-300" : "text-red-300";

  return (
    <FinanceDialog
      open={open}
      onOpenChange={onOpenChange}
      title={kind}
      description={`Posted ${kind} converted by anorvis-os into ${reportingCurrency}, month by month. Pending activity, transfers, and investing are excluded.`}
    >
      {finance.transactions.length === 0 ? (
        <EmptyState
          title="No transactions yet."
          body={`Import bank or card CSV files from Sources to build ${kind} history.`}
        />
      ) : month ? (
        <div className="flex min-h-full flex-col gap-5">
          <div className="shrink-0 border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={workspacePageStyles.cardLabel}>month</p>
                <p className="mt-1 text-sm text-foreground">{month.month}</p>
                <p className="mt-1 text-[0.58rem] uppercase tracking-[0.16em] text-muted-foreground">
                  month {monthIndex + 1} of {months.length}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={workspacePageStyles.inlineSubmit}
                  disabled={monthIndex === 0}
                  onClick={() =>
                    setMonthPage((current) => Math.max(0, current - 1))
                  }
                >
                  previous
                </button>
                <button
                  type="button"
                  className={workspacePageStyles.inlineSubmit}
                  disabled={monthIndex === months.length - 1}
                  onClick={() =>
                    setMonthPage((current) =>
                      Math.min(months.length - 1, current + 1),
                    )
                  }
                >
                  next
                </button>
              </div>
            </div>
            <div className="mt-3">
              <RecordRow
                label={`total ${kind}`}
                value={formatCurrencyAmount(total, reportingCurrency)}
                meta="posted only · excludes transfers & investing"
                tone={tone}
              />
            </div>
          </div>

          <div className="grid gap-5 lg:flex-1 lg:grid-cols-2 lg:grid-rows-[minmax(min-content,1fr)]">
            <section className="flex min-w-0 flex-col lg:min-h-0">
              <p className={`${workspacePageStyles.cardLabel} shrink-0`}>
                month transactions
              </p>
              <PaginatedRecords
                key={`transactions-${kind}-${month.month}`}
                fill
                footerClassName="mt-auto shrink-0 pt-3"
                items={transactions}
                pageSize={8}
                keyOf={(transaction) => transaction.id}
                empty={{
                  title: "No included transactions.",
                  body: "Transfers, investing, and pending entries are excluded.",
                }}
                renderRow={(transaction) => (
                  <RecordRow
                    label={formatTransactionDate(transaction.time)}
                    value={formatCurrencyAmount(
                      transaction.amount,
                      transaction.currency,
                    )}
                    meta={`${transaction.title} · ${accountName(finance, transaction)}`}
                    tone={tone}
                  />
                )}
              />
            </section>

            <section className="flex min-w-0 flex-col lg:min-h-0">
              <p className={`${workspacePageStyles.cardLabel} shrink-0`}>
                category breakdown
              </p>
              {slices.length > 0 ? (
                <div className="mt-2 flex min-h-0 flex-1 flex-col gap-4">
                  <ChartContainer
                    config={pieConfig}
                    className="mx-auto aspect-square w-full max-w-[14rem] shrink-0"
                  >
                    <PieChart>
                      <ChartTooltip
                        cursor={false}
                        content={
                          <ChartTooltipContent
                            nameKey="key"
                            hideLabel
                            formatter={currencyTooltipFormatter(
                              pieConfig,
                              reportingCurrency,
                            )}
                          />
                        }
                      />
                      <Pie
                        data={slices}
                        dataKey="total"
                        nameKey="key"
                        innerRadius={42}
                        strokeWidth={1}
                      >
                        {slices.map((slice) => (
                          <Cell key={slice.key} fill={slice.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <PaginatedRecords
                    key={`categories-${kind}-${month.month}`}
                    fill
                    footerClassName="mt-auto shrink-0 pt-3"
                    items={categories}
                    pageSize={6}
                    keyOf={(entry) => entry.id}
                    empty={{
                      title: `No ${kind} categories yet.`,
                      body: "Categories appear after transaction import.",
                    }}
                    renderRow={(entry) => (
                      <RecordRow
                        label={entry.label}
                        value={formatCurrencyAmount(
                          entry.total,
                          entry.currency,
                        )}
                        meta={entry.group}
                        tone={tone}
                      />
                    )}
                  />
                </div>
              ) : (
                <EmptyState
                  title={`No ${kind} this month.`}
                  body="Pick another month with the pager above."
                />
              )}
            </section>
          </div>
        </div>
      ) : (
        <EmptyState
          title="No included transactions."
          body="Transfers, investing, and pending entries are excluded."
        />
      )}
    </FinanceDialog>
  );
}
