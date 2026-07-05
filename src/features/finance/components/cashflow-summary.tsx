"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { convertAmount } from "@/features/finance/lib/currency";
import type {
  Currency,
  FxRates,
  MonthlySummary,
} from "@/features/finance/types/finance";

type CashflowSummaryProps = {
  summaries: MonthlySummary[];
  currency: Currency;
  rates: FxRates;
  originalCurrency: Currency;
};

function fmt(amount: number, currency: Currency): string {
  if (currency === "BTC") return `₿${amount.toFixed(6)}`;
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function CashflowSummary({
  summaries,
  currency,
  rates,
  originalCurrency,
}: CashflowSummaryProps) {
  const convert = (amount: number) =>
    convertAmount(amount, originalCurrency, currency, rates);

  const totalIncome = summaries.reduce((s, m) => s + m.income, 0);
  const totalExpenses = summaries.reduce((s, m) => s + m.expenses, 0);
  const totalNet = totalIncome - totalExpenses;
  const avgSavingsRate =
    totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const monthlyExpenses =
    summaries.length > 0 ? totalExpenses / summaries.length : 0;
  const runwayMonths =
    monthlyExpenses > 0 && totalNet > 0
      ? (totalNet / monthlyExpenses).toFixed(1)
      : "—";

  const metrics = [
    { label: "total income", value: fmt(convert(totalIncome), currency) },
    { label: "total expenses", value: fmt(convert(totalExpenses), currency) },
    {
      label: "net cashflow",
      value: fmt(convert(totalNet), currency),
    },
    { label: "savings rate", value: `${avgSavingsRate.toFixed(1)}%` },
    {
      label: "runway",
      value: runwayMonths === "—" ? "—" : `${runwayMonths}mo`,
    },
  ];

  return (
    <div className="space-y-3">
      <div className={workspacePageStyles.metricsStrip}>
        {metrics.map((m) => (
          <div key={m.label} className={workspacePageStyles.metricCell}>
            <p className={workspacePageStyles.metricLabel}>{m.label}</p>
            <p className={workspacePageStyles.metricValue}>{m.value}</p>
          </div>
        ))}
      </div>

      {summaries.length > 1 && (
        <div className={workspacePageStyles.list}>
          {summaries.map((m) => (
            <div key={m.month} className={workspacePageStyles.listRow}>
              <span className={workspacePageStyles.listLabel}>{m.month}</span>
              <span className={workspacePageStyles.listValue}>
                {fmt(convert(m.income), currency)} in ·{" "}
                {fmt(convert(m.expenses), currency)} out ·{" "}
                {m.savingsRate >= 0 ? "+" : ""}
                {(m.savingsRate * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
