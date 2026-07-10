"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { formatConverted } from "@/features/finance/lib/currency";
import type {
  Currency,
  FxRates,
  MonthlySummary,
  Transaction,
} from "@/features/finance/types/finance";

type SpendingCategoriesProps = {
  transactions: Transaction[];
  summaries: MonthlySummary[];
  currency: Currency;
  rates: FxRates;
  originalCurrency: Currency;
};

type CategoryRow = {
  category: string;
  total: number;
  trend: "up" | "down" | "stable" | null;
};

function fmt(amount: number, currency: Currency): string {
  if (currency === "BTC") return `\u20bf${amount.toFixed(6)}`;
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

const TREND_ARROW: Record<string, string> = {
  up: "\u25b2",
  down: "\u25bc",
  stable: "\u2014",
};

function computeTrend(
  category: string,
  transactions: Transaction[],
  summaries: MonthlySummary[],
): CategoryRow["trend"] {
  if (summaries.length < 2) return null;

  const months = summaries.map((s) => s.month);
  const lastTwo = months.slice(-2);
  const spending = lastTwo.map((month) =>
    transactions
      .filter(
        (t) =>
          t.amount < 0 && t.category === category && t.date.startsWith(month),
      )
      .reduce((s, t) => s + Math.abs(t.amount), 0),
  );

  if (spending[1] > spending[0] * 1.1) return "up";
  if (spending[1] < spending[0] * 0.9) return "down";
  return "stable";
}

export function SpendingCategories({
  transactions,
  summaries,
  currency,
  rates,
  originalCurrency,
}: SpendingCategoriesProps) {
  const display = (amount: number) =>
    formatConverted(amount, originalCurrency, currency, rates, fmt);

  const outflows = transactions.filter((t) => t.amount < 0);
  const byCategory = new Map<string, number>();
  for (const t of outflows) {
    byCategory.set(
      t.category,
      (byCategory.get(t.category) ?? 0) + Math.abs(t.amount),
    );
  }

  const rows: CategoryRow[] = [...byCategory.entries()]
    .sort(([, a], [, b]) => b - a)
    .map(([category, total]) => ({
      category,
      total,
      trend: computeTrend(category, transactions, summaries),
    }));

  if (rows.length === 0) {
    return (
      <p className="text-[0.65rem] text-muted-foreground">
        no spending data available
      </p>
    );
  }

  const maxTotal = rows[0]?.total ?? 1;

  return (
    <div className="space-y-2">
      {rows.map((row) => {
        const pct = (row.total / maxTotal) * 100;
        const trendColor =
          row.trend === "up"
            ? "text-red-500"
            : row.trend === "down"
              ? "text-green-500"
              : "text-muted-foreground/50";

        return (
          <div key={row.category} className="space-y-0.5">
            <div className="flex items-center justify-between">
              <span className={workspacePageStyles.listLabel}>
                {row.category}
              </span>
              <div className="flex items-center gap-1.5">
                <span className={workspacePageStyles.listValue}>
                  {display(row.total)}
                </span>
                {row.trend && (
                  <span className={`text-[0.5rem] ${trendColor}`}>
                    {TREND_ARROW[row.trend]}
                  </span>
                )}
              </div>
            </div>
            <div className="h-1 w-full bg-muted rounded-sm overflow-hidden">
              <div
                className="h-full rounded-sm bg-foreground/30"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
