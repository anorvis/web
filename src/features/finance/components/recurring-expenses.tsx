"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { convertAmount } from "@/features/finance/lib/currency";
import type {
  Currency,
  FxRates,
  RecurringExpense,
} from "@/features/finance/types/finance";

type RecurringExpensesProps = {
  expenses: RecurringExpense[];
  currency: Currency;
  rates: FxRates;
  originalCurrency: Currency;
};

function fmt(amount: number, currency: Currency): string {
  if (currency === "BTC") return `₿${amount.toFixed(6)}`;
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function RecurringExpenses({
  expenses,
  currency,
  rates,
  originalCurrency,
}: RecurringExpensesProps) {
  const convert = (amount: number) =>
    convertAmount(amount, originalCurrency, currency, rates);

  if (expenses.length === 0) {
    return (
      <p className="text-[0.65rem] text-muted-foreground">
        need 3+ months of data to detect recurring charges
      </p>
    );
  }

  const totalMonthly = expenses.reduce((s, e) => s + e.monthlyCost, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className={workspacePageStyles.metricLabel}>monthly commitment</p>
        <p className={workspacePageStyles.metricValue}>
          {fmt(convert(totalMonthly), currency)}
        </p>
      </div>

      <div className={workspacePageStyles.list}>
        {expenses.map((e) => (
          <div
            key={`${e.merchant}-${e.cadence}`}
            className={workspacePageStyles.listRow}
          >
            <div>
              <span className={workspacePageStyles.listLabel}>
                {e.merchant}
              </span>
              <span className="ml-2 text-[0.5rem] text-muted-foreground/50">
                {e.cadence}
              </span>
            </div>
            <span className={workspacePageStyles.listValue}>
              {fmt(convert(e.monthlyCost), currency)}/mo
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
