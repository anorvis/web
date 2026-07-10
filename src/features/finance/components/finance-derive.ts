import type { PortfolioHistoryPoint } from "@/features/finance/types/finance";
import { formatDateTime } from "@/lib/life-intelligence/derive";
import type { FinanceData } from "@/lib/life-intelligence/model";

export type FinanceAccount = FinanceData["accounts"][number];
export type FinanceCategory = FinanceData["categories"][number];
export type FinanceTransaction = FinanceData["transactions"][number];

export type CurrencyGroups = Map<string, number>;

const LIABILITY_TYPE: Record<string, true> = {
  credit: true,
  loan: true,
};

// Categories that must never count toward spending or cash flow. We rely on the
// canonical `group`/`excludeFromSpending` fields, and additionally treat the
// canonical Plaid transfer/investment category names as excluded because the CSV
// adapter files every imported category under the "spending" group.
const EXCLUDED_CATEGORY_NAME =
  /^(transfers?|internal transfer|investing|investment|investments)$/i;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function monthKey(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})/.exec(value);
  return match ? `${match[1]}-${match[2]}` : null;
}

/** Current local calendar month key (YYYY-MM), matching transaction time prefixes. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * ISO code is always passed through untouched. BTC retains six decimal places;
 * other unsupported currency codes fall back to a suffixed plain number.
 */
export function formatCurrencyAmount(value: number, currency = "USD"): string {
  if (currency === "BTC") {
    const sign = value < 0 ? "−" : "";
    return `${sign}₿${Math.abs(value).toFixed(6)}`;
  }
  try {
    return value.toLocaleString("en-US", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return `${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${currency}`;
  }
}

/**
 * Orders currency codes with `preferred` first when it is present in the list.
 * The remaining codes keep their original order. This never adds or drops a
 * currency — ordering is a display concern only, never a conversion.
 */
export function orderCurrencies(
  currencies: string[],
  preferred?: string | null,
): string[] {
  if (!preferred || !currencies.includes(preferred)) return currencies;
  return [
    preferred,
    ...currencies.filter((currency) => currency !== preferred),
  ];
}

/**
 * Renders a per-currency map as separate values joined with " / ". Different
 * currencies are shown side by side and are never summed into one number. When
 * `preferred` is supplied and present, its value is floated to the front while
 * the remaining currencies stay alphabetical.
 */
export function formatCurrencyGroups(
  groups: CurrencyGroups,
  preferred?: string | null,
): string {
  const entries = Array.from(groups.entries())
    .filter(([, value]) => value !== 0)
    .sort(([left], [right]) => left.localeCompare(right));
  const ordered =
    preferred && entries.some(([currency]) => currency === preferred)
      ? [
          ...entries.filter(([currency]) => currency === preferred),
          ...entries.filter(([currency]) => currency !== preferred),
        ]
      : entries;
  const values = ordered.map(([currency, value]) =>
    formatCurrencyAmount(value, currency),
  );
  return values.length
    ? values.join(" / ")
    : formatCurrencyAmount(0, preferred ?? "USD");
}

export function formatTransactionDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
  }
  return formatDateTime(value);
}

export function isLiabilityAccount(account: FinanceAccount): boolean {
  return LIABILITY_TYPE[account.type] === true;
}

export function isTransferOrInvesting(
  category: FinanceCategory | undefined,
): boolean {
  if (!category) return false;
  if (category.excludeFromSpending) return true;
  if (category.group === "transfers" || category.group === "investing")
    return true;
  return EXCLUDED_CATEGORY_NAME.test(category.name.trim());
}

function categoryLookup(finance: FinanceData) {
  return new Map(finance.categories.map((category) => [category.id, category]));
}

function resolveCategory(
  finance: FinanceData,
  transaction: FinanceTransaction,
  lookup?: Map<string, FinanceCategory>,
): FinanceCategory | undefined {
  if (!transaction.categoryId) return undefined;
  return (lookup ?? categoryLookup(finance)).get(transaction.categoryId);
}

export type BalanceBreakdown = {
  assets: CurrencyGroups;
  liabilities: CurrencyGroups;
  net: CurrencyGroups;
  currencies: string[];
};

/**
 * Conservative net worth: asset balances add, liability balances subtract as
 * magnitudes, and each currency is tracked independently. Accounts with an
 * unknown balance are excluded from the totals (but still listed elsewhere).
 */
export function balanceBreakdown(finance: FinanceData): BalanceBreakdown {
  const assets: CurrencyGroups = new Map();
  const liabilities: CurrencyGroups = new Map();
  for (const account of finance.accounts) {
    if (account.status === "hidden" || account.balance === undefined) continue;
    const currency = account.currency;
    if (isLiabilityAccount(account)) {
      liabilities.set(
        currency,
        (liabilities.get(currency) ?? 0) + Math.abs(account.balance),
      );
    } else {
      assets.set(currency, (assets.get(currency) ?? 0) + account.balance);
    }
  }
  const net: CurrencyGroups = new Map();
  for (const [currency, value] of assets)
    net.set(currency, (net.get(currency) ?? 0) + value);
  for (const [currency, value] of liabilities)
    net.set(currency, (net.get(currency) ?? 0) - value);
  const currencies = Array.from(
    new Set([...assets.keys(), ...liabilities.keys()]),
  ).sort((left, right) => left.localeCompare(right));
  return { assets, liabilities, net, currencies };
}

export type CashflowGroups = {
  income: CurrencyGroups;
  spending: CurrencyGroups;
  net: CurrencyGroups;
};

/**
 * Income (inflows) and spending (outflows) per currency, excluding transfer and
 * investing categories so internal money movement never inflates either side.
 * Pass `month` (YYYY-MM) to scope totals to a single calendar month.
 */
export function cashflow(
  finance: FinanceData,
  month?: string | null,
): CashflowGroups {
  const lookup = categoryLookup(finance);
  const income: CurrencyGroups = new Map();
  const spending: CurrencyGroups = new Map();
  for (const transaction of finance.transactions) {
    if (transaction.status === "pending") continue;
    if (month && monthKey(transaction.time) !== month) continue;
    if (isTransferOrInvesting(resolveCategory(finance, transaction, lookup)))
      continue;
    const currency = transaction.currency;
    if (transaction.amount >= 0) {
      income.set(currency, (income.get(currency) ?? 0) + transaction.amount);
    } else {
      spending.set(
        currency,
        (spending.get(currency) ?? 0) + Math.abs(transaction.amount),
      );
    }
  }
  for (const [currency, value] of income) income.set(currency, round2(value));
  for (const [currency, value] of spending)
    spending.set(currency, round2(value));
  const net: CurrencyGroups = new Map();
  for (const [currency, value] of income)
    net.set(currency, round2((net.get(currency) ?? 0) + value));
  for (const [currency, value] of spending)
    net.set(currency, round2((net.get(currency) ?? 0) - value));
  return { income, spending, net };
}

export function investmentValue(finance: FinanceData): CurrencyGroups {
  const totals: CurrencyGroups = new Map();
  const hiddenAccountIds = new Set(
    finance.accounts
      .filter((account) => account.status === "hidden")
      .map((account) => account.id),
  );
  for (const position of finance.positions) {
    if (hiddenAccountIds.has(position.accountId)) continue;
    totals.set(
      position.currency,
      (totals.get(position.currency) ?? 0) + (position.marketValue ?? 0),
    );
  }
  return totals;
}

export type CategoryTotal = {
  id: string;
  label: string;
  group: string;
  currency: string;
  total: number;
};

/**
 * Spending grouped by category for a single currency, excluding transfers and
 * investing. Sorted highest-first. Pass `month` (YYYY-MM) to scope to one
 * calendar month.
 */
export function spendingByCategory(
  finance: FinanceData,
  currency: string,
  month?: string | null,
): CategoryTotal[] {
  const lookup = categoryLookup(finance);
  const totals = new Map<string, CategoryTotal>();
  for (const transaction of finance.transactions) {
    if (transaction.status === "pending") continue;
    if (month && monthKey(transaction.time) !== month) continue;
    if (transaction.currency !== currency) continue;
    if (transaction.amount >= 0) continue;
    const category = resolveCategory(finance, transaction, lookup);
    if (isTransferOrInvesting(category)) continue;
    const id = category?.id ?? "uncategorized";
    const current = totals.get(id) ?? {
      id,
      label: category?.name ?? "uncategorized",
      group: category?.group ?? "other",
      currency,
      total: 0,
    };
    current.total += Math.abs(transaction.amount);
    totals.set(id, current);
  }
  return Array.from(totals.values())
    .map((entry) => ({ ...entry, total: round2(entry.total) }))
    .sort((left, right) => right.total - left.total);
}

/**
 * Income grouped by category for a single currency, excluding transfers. Pass
 * `month` (YYYY-MM) to scope to one calendar month.
 */
export function incomeByCategory(
  finance: FinanceData,
  currency: string,
  month?: string | null,
): CategoryTotal[] {
  const lookup = categoryLookup(finance);
  const totals = new Map<string, CategoryTotal>();
  for (const transaction of finance.transactions) {
    if (transaction.status === "pending") continue;
    if (month && monthKey(transaction.time) !== month) continue;
    if (transaction.currency !== currency) continue;
    if (transaction.amount <= 0) continue;
    const category = resolveCategory(finance, transaction, lookup);
    if (isTransferOrInvesting(category)) continue;
    const id = category?.id ?? "uncategorized-income";
    const current = totals.get(id) ?? {
      id,
      label: category?.name ?? "uncategorized",
      group: category?.group ?? "income",
      currency,
      total: 0,
    };
    current.total += transaction.amount;
    totals.set(id, current);
  }
  return Array.from(totals.values())
    .map((entry) => ({ ...entry, total: round2(entry.total) }))
    .sort((left, right) => right.total - left.total);
}

export type MonthlyPoint = {
  month: string;
  income: number;
  spending: number;
  net: number;
};

/**
 * Monthly income vs spending for one currency (transfers/investing excluded),
 * oldest-first. Pass `null` to return every available month; the default keeps
 * chart callers bounded to six buckets.
 */
export function monthlySeries(
  finance: FinanceData,
  currency: string,
  months: number | null = 6,
): MonthlyPoint[] {
  const lookup = categoryLookup(finance);
  const buckets = new Map<string, { income: number; spending: number }>();
  for (const transaction of finance.transactions) {
    if (transaction.status === "pending") continue;
    if (transaction.currency !== currency) continue;
    if (isTransferOrInvesting(resolveCategory(finance, transaction, lookup)))
      continue;
    const month = monthKey(transaction.time);
    if (!month) continue;
    const bucket = buckets.get(month) ?? { income: 0, spending: 0 };
    if (transaction.amount >= 0) bucket.income += transaction.amount;
    else bucket.spending += Math.abs(transaction.amount);
    buckets.set(month, bucket);
  }
  const entries = Array.from(buckets.entries()).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  return (months === null ? entries : entries.slice(-months)).map(
    ([month, bucket]) => ({
      month,
      income: round2(bucket.income),
      spending: round2(bucket.spending),
      net: round2(bucket.income - bucket.spending),
    }),
  );
}

/** Distinct transaction currencies, most-used first. */
export function transactionCurrencies(finance: FinanceData): string[] {
  const counts = new Map<string, number>();
  for (const transaction of finance.transactions) {
    counts.set(
      transaction.currency,
      (counts.get(transaction.currency) ?? 0) + 1,
    );
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([currency]) => currency);
}

export type NetWorthPoint = { label: string; netWorth: number; equity: number };

/** Backend-converted all-account net-worth history as chart-ready points. */
export function netWorthSeries(
  history: PortfolioHistoryPoint[],
): NetWorthPoint[] {
  return history.map((point) => {
    const netWorth = point.netWorth ?? point.equity;
    return {
      label: point.date.length >= 10 ? point.date.slice(5) : point.date,
      netWorth,
      equity: netWorth,
    };
  });
}

export function cashflowTransactions(
  finance: FinanceData,
  currency: string,
): FinanceTransaction[] {
  const lookup = categoryLookup(finance);
  return finance.transactions
    .filter(
      (transaction) =>
        transaction.status !== "pending" &&
        transaction.currency === currency &&
        !isTransferOrInvesting(resolveCategory(finance, transaction, lookup)),
    )
    .sort((a, b) => (b.time ?? "").localeCompare(a.time ?? ""));
}
