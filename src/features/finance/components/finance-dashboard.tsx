"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMemo, useState } from "react";
import {
  Workspace,
  WorkspaceCard,
  WorkspaceHeader,
} from "@/components/layout/workspace";
import { CashflowSummary } from "@/features/finance/components/cashflow-summary";
import { CsvImport } from "@/features/finance/components/csv-import";
import {
  FinanceProvider,
  useFinanceData,
} from "@/features/finance/components/finance-provider";
import { PortfolioOverview } from "@/features/finance/components/portfolio-overview";
import { RecurringExpenses } from "@/features/finance/components/recurring-expenses";
import { SpendingCategories } from "@/features/finance/components/spending-categories";
import { StabilityScoreCard } from "@/features/finance/components/stability-score";
import { TransactionList } from "@/features/finance/components/transaction-list";
import { detectRecurring } from "@/features/finance/lib/categorize";
import {
  buildMonthlySummaries,
  calculateStabilityScore,
} from "@/features/finance/lib/score";
import type {
  AlpacaPortfolio,
  Currency,
  FxRates,
  PortfolioHistoryPoint,
} from "@/features/finance/types/finance";
import { formatPageDate } from "@/lib/workspace/view-utils";

const CURRENCIES: Currency[] = ["CAD", "USD", "BTC"];

type FinanceDashboardProps = {
  initialRates: FxRates;
  initialPortfolio: AlpacaPortfolio | null;
  initialHistory: PortfolioHistoryPoint[];
};

export function FinanceDashboard(props: FinanceDashboardProps) {
  return (
    <FinanceProvider>
      <FinanceDashboardInner {...props} />
    </FinanceProvider>
  );
}

function FinanceDashboardInner({
  initialRates,
  initialPortfolio,
  initialHistory,
}: FinanceDashboardProps) {
  const {
    transactions,
    liquidBalance,
    importTransactions,
    recategorize,
    clearAll,
  } = useFinanceData();
  const [currency, setCurrency] = useState<Currency>("USD");
  const [importOpen, setImportOpen] = useState(false);

  const hasData = transactions.length > 0;
  const summaries = useMemo(
    () => buildMonthlySummaries(transactions),
    [transactions],
  );
  const score = useMemo(
    () =>
      hasData ? calculateStabilityScore(transactions, liquidBalance) : null,
    [transactions, liquidBalance, hasData],
  );
  const recurring = useMemo(
    () => detectRecurring(transactions),
    [transactions],
  );

  const originalCurrency = useMemo<Currency>(() => {
    const counts: Record<Currency, number> = { CAD: 0, USD: 0, BTC: 0 };
    for (const t of transactions) counts[t.originalCurrency]++;
    return counts.CAD > counts.USD ? "CAD" : "USD";
  }, [transactions]);

  const currencyToggle = (
    <div className="flex items-center gap-1">
      {CURRENCIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCurrency(c)}
          className={`${workspacePageStyles.toggleButton} ${
            currency === c ? "border-foreground text-foreground" : ""
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  );

  return (
    <Workspace>
      <WorkspaceHeader
        header="ledger"
        title="finance"
        subtitle={formatPageDate()}
        description={`"be fearful when others are greedy and greedy when others are fearful."`}
        headerExtra={currencyToggle}
      >
        {!hasData && (
          <WorkspaceCard label="import" title="upload bank csv">
            <CsvImport onImport={importTransactions} />
          </WorkspaceCard>
        )}

        {(score || initialPortfolio) && (
          <div
            className={
              score && initialPortfolio
                ? "grid gap-4 lg:grid-cols-[2fr_3fr]"
                : ""
            }
          >
            {score && (
              <WorkspaceCard label="stability score">
                <StabilityScoreCard score={score} />
              </WorkspaceCard>
            )}

            {initialPortfolio && (
              <WorkspaceCard label="portfolio" title="alpaca holdings">
                <PortfolioOverview
                  portfolio={initialPortfolio}
                  history={initialHistory}
                  currency={currency}
                  rates={initialRates}
                />
              </WorkspaceCard>
            )}
          </div>
        )}

        {hasData && (
          <div className={workspacePageStyles.grid}>
            <WorkspaceCard label="cashflow" title="income vs expenses">
              <CashflowSummary
                summaries={summaries}
                currency={currency}
                rates={initialRates}
                originalCurrency={originalCurrency}
              />
            </WorkspaceCard>

            <WorkspaceCard label="spending" title="by category">
              <SpendingCategories
                transactions={transactions}
                summaries={summaries}
                currency={currency}
                rates={initialRates}
                originalCurrency={originalCurrency}
              />
            </WorkspaceCard>
          </div>
        )}

        {hasData && (
          <div className={workspacePageStyles.grid}>
            <WorkspaceCard label="recurring" title="subscriptions & bills">
              <RecurringExpenses
                expenses={recurring}
                currency={currency}
                rates={initialRates}
                originalCurrency={originalCurrency}
              />
            </WorkspaceCard>

            <WorkspaceCard
              label="transactions"
              headerExtra={
                <p className={workspacePageStyles.metricLabel}>
                  {transactions.length} imported
                </p>
              }
            >
              <TransactionList
                transactions={transactions}
                currency={currency}
                rates={initialRates}
                onRecategorize={recategorize}
              />
            </WorkspaceCard>
          </div>
        )}

        {hasData && (
          <WorkspaceCard
            label={importOpen ? "import" : undefined}
            headerExtra={
              importOpen ? (
                <button
                  type="button"
                  onClick={() => setImportOpen(false)}
                  className={workspacePageStyles.inlineAction}
                >
                  collapse
                </button>
              ) : null
            }
          >
            {importOpen ? (
              <CsvImport onImport={importTransactions} />
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className={workspacePageStyles.outlineButton}
                >
                  + upload csv
                </button>
                <button
                  type="button"
                  onClick={clearAll}
                  className={workspacePageStyles.outlineButton}
                >
                  clear all
                </button>
              </div>
            )}
          </WorkspaceCard>
        )}
      </WorkspaceHeader>
    </Workspace>
  );
}
