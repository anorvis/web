"use client";

import { Button } from "@anorvis/ui/button";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  Metric,
  RecordRow,
  Section,
} from "@/components/life-intelligence/record-ui";
import { fetchFinancePortfolio } from "@/features/finance/api/finance";
import { CsvImport } from "@/features/finance/components/csv-import";
import { categorizeAll } from "@/features/finance/lib/categorize";
import type { Transaction as ImportedTransaction } from "@/features/finance/types/finance";
import {
  financeFromImportedTransactions,
  financeFromPortfolio,
} from "@/lib/life-intelligence/adapters";
import { accountName, formatDateTime } from "@/lib/life-intelligence/derive";
import type { FinanceData } from "@/lib/life-intelligence/model";
import { queryKeys } from "@/lib/query/keys";

function formatTransactionDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }
  return formatDateTime(value);
}

function formatTransactionCurrency(value: number, currency = "USD") {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatCurrencyGroups(groups: Map<string, number>) {
  const values = Array.from(groups.entries())
    .filter(([, value]) => value !== 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currency, value]) => formatTransactionCurrency(value, currency));
  return values.length ? values.join(" / ") : formatTransactionCurrency(0);
}

function groupedBalances(finance: FinanceData) {
  const totals = new Map<string, number>();
  for (const account of finance.accounts) {
    totals.set(
      account.currency,
      (totals.get(account.currency) ?? 0) + (account.balance ?? 0),
    );
  }
  return totals;
}

function groupedCashflow(finance: FinanceData) {
  const income = new Map<string, number>();
  const spending = new Map<string, number>();
  for (const transaction of finance.transactions) {
    const currency = transaction.currency;
    income.set(
      currency,
      (income.get(currency) ?? 0) + Math.max(0, transaction.amount),
    );
    spending.set(
      currency,
      (spending.get(currency) ?? 0) + Math.abs(Math.min(0, transaction.amount)),
    );
  }
  return { income, spending };
}

function groupedInvestmentValue(finance: FinanceData) {
  const totals = new Map<string, number>();
  for (const position of finance.positions) {
    totals.set(
      position.currency,
      (totals.get(position.currency) ?? 0) + (position.marketValue ?? 0),
    );
  }
  return totals;
}

function groupedCategoryTotals(finance: FinanceData) {
  const categoryById = new Map(
    finance.categories.map((category) => [category.id, category]),
  );
  const totals = new Map<
    string,
    {
      category: FinanceData["categories"][number];
      currency: string;
      total: number;
    }
  >();
  for (const transaction of finance.transactions) {
    const category = transaction.categoryId
      ? categoryById.get(transaction.categoryId)
      : undefined;
    if (!category || category.group !== "spending") continue;
    const key = `${category.id}:${transaction.currency}`;
    const current = totals.get(key) ?? {
      category,
      currency: transaction.currency,
      total: 0,
    };
    current.total += Math.abs(Math.min(0, transaction.amount));
    totals.set(key, current);
  }
  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

function mergeFinanceData(left: FinanceData, right: FinanceData): FinanceData {
  return {
    accounts: Array.from(
      new Map(
        [...left.accounts, ...right.accounts].map((value) => [value.id, value]),
      ).values(),
    ),
    categories: Array.from(
      new Map(
        [...left.categories, ...right.categories].map((value) => [
          value.id,
          value,
        ]),
      ).values(),
    ),
    transactions: Array.from(
      new Map(
        [...left.transactions, ...right.transactions].map((value) => [
          value.importFingerprint ?? value.id,
          value,
        ]),
      ).values(),
    ),
    positions: Array.from(
      new Map(
        [...left.positions, ...right.positions].map((value) => [
          value.id,
          value,
        ]),
      ).values(),
    ),
  };
}

export function FinanceDashboard() {
  const [importedFinance, setImportedFinance] = useState<FinanceData | null>(
    null,
  );
  const portfolioQuery = useQuery({
    queryKey: queryKeys.finance.snapshot(),
    queryFn: fetchFinancePortfolio,
  });
  const finance = useMemo(() => {
    const portfolioFinance = financeFromPortfolio(
      portfolioQuery.data?.portfolio ?? null,
    );
    return importedFinance
      ? mergeFinanceData(portfolioFinance, importedFinance)
      : portfolioFinance;
  }, [importedFinance, portfolioQuery.data]);
  const cashflow = groupedCashflow(finance);
  const categories = groupedCategoryTotals(finance);
  const investmentValue = groupedInvestmentValue(finance);
  const loading = portfolioQuery.isLoading;
  const loadError = portfolioQuery.isError;

  return (
    <div className="space-y-4">
      <Section label="sources" title="finance records">
        <p className={workspacePageStyles.cardBodyText}>
          Finance data is imported directly from CSV and portfolio refresh
          flows. There is no external finance connector to configure here yet.
        </p>
      </Section>

      <section className="grid gap-4 xl:grid-cols-4">
        <Metric
          label="net worth"
          value={formatCurrencyGroups(groupedBalances(finance))}
          note={`${finance.accounts.length} accounts loaded`}
        />
        <Metric
          label="income"
          value={formatCurrencyGroups(cashflow.income)}
          note="from imported transactions"
        />
        <Metric
          label="spending"
          value={formatCurrencyGroups(cashflow.spending)}
          note="category-derived"
        />
        <Metric
          label="investments"
          value={formatCurrencyGroups(investmentValue)}
          note={`${finance.positions.length} positions`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
        <Section label="import" title="import">
          <div className="space-y-4">
            <CsvImport
              onImport={(
                transactions: ImportedTransaction[],
                balance: number | null,
              ) => {
                const categorized = categorizeAll(transactions);
                const nextFinance = financeFromImportedTransactions(
                  categorized,
                  balance,
                );
                setImportedFinance((current) =>
                  current
                    ? mergeFinanceData(current, nextFinance)
                    : nextFinance,
                );
              }}
            />
            <p className={workspacePageStyles.cardBodyText}>
              CSV uploads become Account, Category, and Transaction records in
              memory. Persistence should write these records to anorvis-os next.
            </p>
          </div>
        </Section>

        <Section
          label="accounts"
          title="accounts"
          headerExtra={
            <Button
              size="sm"
              variant="outline"
              className="h-7 rounded-none px-2 text-[0.6rem]"
              onClick={() => portfolioQuery.refetch()}
              disabled={portfolioQuery.isFetching}
            >
              refresh
            </Button>
          }
        >
          {loading ? (
            <Skeleton className="h-48 rounded-none" />
          ) : loadError && !importedFinance ? (
            <EmptyState
              title="Finance source unavailable."
              body="Refresh to retry the portfolio source, or import CSV files while the backend is unavailable."
            />
          ) : finance.accounts.length > 0 || finance.positions.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-0">
                {finance.accounts.map((account) => (
                  <RecordRow
                    key={account.id}
                    label={account.type}
                    value={
                      account.balance === undefined
                        ? "unknown"
                        : formatTransactionCurrency(
                            account.balance,
                            account.currency,
                          )
                    }
                    meta={account.name}
                  />
                ))}
              </div>
              <div className="space-y-0">
                {finance.positions.map((position) => (
                  <RecordRow
                    key={position.id}
                    label={position.symbol}
                    value={formatTransactionCurrency(
                      position.marketValue ?? 0,
                      position.currency,
                    )}
                    meta={`${position.quantity} shares · ${position.name ?? "position"}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No finance records yet."
              body="Upload a CSV for transactions or connect a portfolio source to populate accounts and positions."
            />
          )}
        </Section>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <Section label="transactions" title="transactions">
          {finance.transactions.length > 0 ? (
            <div className="space-y-0">
              {finance.transactions.map((transaction) => (
                <RecordRow
                  key={transaction.id}
                  label={formatTransactionDate(transaction.time)}
                  value={formatTransactionCurrency(
                    transaction.amount,
                    transaction.currency,
                  )}
                  meta={`${transaction.title} · ${accountName(finance, transaction)}`}
                  tone={
                    transaction.amount < 0 ? "text-red-300" : "text-emerald-300"
                  }
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No transactions yet."
              body="Import bank or card CSV files to create transaction records."
            />
          )}
        </Section>

        <Section label="categories" title="categories">
          {categories.length > 0 ? (
            <div className="space-y-0">
              {categories.map(({ category, currency, total }) => (
                <RecordRow
                  key={`${category.id}-${currency}`}
                  label={category.group}
                  value={formatTransactionCurrency(total, currency)}
                  meta={category.name}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title="No spending categories yet."
              body="Categories appear after transaction import."
            />
          )}
        </Section>
      </section>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-border p-4">
      <p className="text-xs text-foreground">{title}</p>
      <p className={workspacePageStyles.cardBodyText}>{body}</p>
    </div>
  );
}
