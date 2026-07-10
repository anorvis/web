import {
  deleteJson,
  patchJson,
  postJson,
  requestJson,
} from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";
import type {
  Account,
  Category,
  FinanceData,
  Position,
  Transaction,
} from "@/lib/life-intelligence/model";
import {
  requestBrowserLocalJson,
  shouldUseBrowserLocalBackend,
} from "@/lib/local-backend-client";

// ---------------------------------------------------------------------------
// Canonical finance dashboard response.
//
// These record shapes mirror the reporting dashboard exported by anorvis-os.
// CSV and SnapTrade records share one provider-neutral contract. anorvis-os
// converts every monetary value into the requested reporting currency while
// the canonical database retains each record's original currency.
// ---------------------------------------------------------------------------

export type FinanceAccountRecord = {
  id: string;
  source: string;
  sourceId: string | null;
  sourceVariant: string | null;
  name: string;
  type: string;
  currency: string;
  balance: number | null;
  institution: string | null;
  mask: string | null;
  status: string | null;
  importId: string | null;
  observedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceBalanceRecord = {
  id: string;
  accountId: string;
  currency: string;
  cash: number | null;
  buyingPower: number | null;
  observedAt: string;
  source: string;
  sourceVariant: string | null;
  importId: string | null;
  updatedAt: string;
};

export type FinanceTransactionRecord = {
  id: string;
  accountId: string | null;
  source: string;
  sourceVariant: string | null;
  description: string;
  amount: number;
  currency: string;
  postedAt: string;
  categoryId: string | null;
  categoryName: string | null;
  categoryGroup: string | null;
  status: string;
};

export type FinanceCategoryRecord = {
  id: string;
  name: string;
  group: string;
  excludeFromSpending: boolean;
  color: string | null;
};

export type FinancePositionRecord = {
  id: string;
  accountId: string | null;
  source: string;
  sourceVariant: string | null;
  symbol: string;
  name: string | null;
  quantity: number;
  marketValue: number | null;
  averageCost: number | null;
  currency: string;
  observedAt: string | null;
  updatedAt: string;
};

export type FinanceActivityRecord = {
  id: string;
  accountId: string | null;
  source: string;
  sourceVariant: string | null;
  type: string;
  description: string | null;
  amount: number | null;
  currency: string;
  symbol: string | null;
  quantity: number | null;
  price: number | null;
  occurredAt: string;
  settledAt: string | null;
  status: string;
};

export type FinanceHistoryRecord = {
  accountId: string | null;
  date: string;
  equity: number;
  netWorth?: number | null;
  cash: number | null;
  currency: string;
  source: string;
};

export type FinanceAccountReturnRateRecord = {
  accountId: string;
  source: string;
  sourceVariant: string | null;
  timeframe: string;
  returnPercent: number;
  asOf: string | null;
  observedAt: string;
  updatedAt: string;
};

export type FinanceImportRecord = {
  id: string;
  source: string;
  sourceVariant: string | null;
  accountId: string | null;
  status: string;
  importedCount: number;
  skippedCount: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FinanceSourceFreshness = {
  source: string;
  sourceVariant: string | null;
  accountCount: number;
  transactionCount: number;
  lastObservedAt: string | null;
  lastImportedAt: string | null;
};

export type FinanceCurrencyGroup = {
  currency: string;
  accounts: FinanceAccountRecord[];
  balances: FinanceBalanceRecord[];
  transactions: FinanceTransactionRecord[];
  positions: FinancePositionRecord[];
  activities: FinanceActivityRecord[];
};

export type FinanceConversion = {
  currency: string;
  asOf: string | null;
  providers: string[];
  stale: boolean;
};

export type FinanceDashboard = {
  accounts: FinanceAccountRecord[];
  balances: FinanceBalanceRecord[];
  transactions: FinanceTransactionRecord[];
  categories: FinanceCategoryRecord[];
  positions: FinancePositionRecord[];
  activities: FinanceActivityRecord[];
  history: FinanceHistoryRecord[];
  returnRates: FinanceAccountReturnRateRecord[];
  imports: FinanceImportRecord[];
  byCurrency: FinanceCurrencyGroup[];
  sources: FinanceSourceFreshness[];
  conversion: FinanceConversion;
};

export async function fetchFinanceDashboard(
  currency: string,
): Promise<FinanceDashboard> {
  const query = `currency=${encodeURIComponent(currency)}`;
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<FinanceDashboard>(
      `/v1/finance/dashboard?${query}`,
    );
  }

  return runEffect(
    requestJson<FinanceDashboard>(`/api/finance/dashboard?${query}`),
  );
}

// ---------------------------------------------------------------------------
// Canonical CSV import.
//
// Mirrors `CsvImportBody` from os/src/capability/finance/schema.ts. The web
// parses CSV locally, but the normalized payload persists through the canonical
// OS import route — the source of truth for the dashboard on reload.
// ---------------------------------------------------------------------------

export type CsvImportSource =
  | "chase_cc"
  | "chase_checking"
  | "td_canada"
  | "wealthsimple"
  | "manual";

export type CsvImportAccountType =
  | "checking"
  | "savings"
  | "credit"
  | "investment"
  | "crypto"
  | "loan";

export type CsvImportTransaction = {
  externalId?: string | null;
  fingerprint: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  currency: string;
};

export type CsvImportRequest = {
  source: CsvImportSource;
  accountId: string;
  balance?: number | null;
  transactions: CsvImportTransaction[];
};

export type CsvImportResult = {
  imported: number;
  skippedDuplicates: number;
  skippedCrossSource?: number;
  accountId: string;
  importId: string;
  status: string;
};

export type FinanceImportUndoResult = {
  ok: true;
  importId: string;
  deletedTransactions: number;
  deletedAccountId: string | null;
};

export async function undoFinanceImport(
  importId: string,
): Promise<FinanceImportUndoResult> {
  const encodedImportId = encodeURIComponent(importId);
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<FinanceImportUndoResult>(
      `/v1/finance/imports/${encodedImportId}`,
      { method: "DELETE" },
    );
  }

  return runEffect(
    deleteJson<FinanceImportUndoResult>(
      `/api/finance/imports/${encodedImportId}`,
    ),
  );
}

export async function importFinanceCsv(
  body: CsvImportRequest,
): Promise<CsvImportResult> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<CsvImportResult>("/v1/finance/imports/csv", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  return runEffect(postJson<CsvImportResult>("/api/finance/imports/csv", body));
}

export type CreateFinanceAccountRequest = {
  name: string;
  type: CsvImportAccountType;
  currency: string;
  balance?: number | null;
};

export type CreateFinanceAccountResult = {
  ok: true;
  account: FinanceAccountRecord;
};

export async function createFinanceAccount(
  body: CreateFinanceAccountRequest,
): Promise<CreateFinanceAccountResult> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<CreateFinanceAccountResult>(
      "/v1/finance/accounts",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  return runEffect(
    postJson<CreateFinanceAccountResult>("/api/finance/accounts", body),
  );
}

export type UpdateFinanceAccountRequest = {
  status?: "hidden" | "active";
  name?: string;
  balance?: number | null;
};

export type UpdateFinanceAccountResult = {
  ok: true;
  account: FinanceAccountRecord;
};

export async function updateFinanceAccount(
  accountId: string,
  body: UpdateFinanceAccountRequest,
): Promise<UpdateFinanceAccountResult> {
  const encodedAccountId = encodeURIComponent(accountId);
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<UpdateFinanceAccountResult>(
      `/v1/finance/accounts/${encodedAccountId}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
  }

  return runEffect(
    patchJson<UpdateFinanceAccountResult>(
      `/api/finance/accounts/${encodedAccountId}`,
      body,
    ),
  );
}

export type DeleteFinanceAccountResult = {
  ok: true;
  accountId: string;
  deletedTransactions: number;
};

export async function deleteFinanceAccount(
  accountId: string,
): Promise<DeleteFinanceAccountResult> {
  const encodedAccountId = encodeURIComponent(accountId);
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<DeleteFinanceAccountResult>(
      `/v1/finance/accounts/${encodedAccountId}`,
      { method: "DELETE" },
    );
  }

  return runEffect(
    deleteJson<DeleteFinanceAccountResult>(
      `/api/finance/accounts/${encodedAccountId}`,
    ),
  );
}

export type FinanceAccountLinkRequest = {
  canonicalAccountId: string;
  duplicateAccountId: string;
};

export type FinanceAccountLinkResult = {
  linked: true;
  canonicalAccountId: string;
  duplicateAccountId: string;
  transactionsMerged: number;
  transactionsRekeyed: number;
};

export async function linkFinanceAccounts(
  body: FinanceAccountLinkRequest,
): Promise<FinanceAccountLinkResult> {
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<FinanceAccountLinkResult>(
      "/v1/finance/accounts/links",
      {
        method: "POST",
        body: JSON.stringify(body),
      },
    );
  }

  return runEffect(
    postJson<FinanceAccountLinkResult>("/api/finance/accounts/links", body),
  );
}

export async function unlinkFinanceAccount(
  accountId: string,
): Promise<{ unlinked: true; accountId: string }> {
  const path = `/api/finance/accounts/links/${encodeURIComponent(accountId)}`;
  if (shouldUseBrowserLocalBackend()) {
    return requestBrowserLocalJson<{ unlinked: true; accountId: string }>(
      `/v1/finance/accounts/links/${encodeURIComponent(accountId)}`,
      { method: "DELETE" },
    );
  }

  return runEffect(deleteJson<{ unlinked: true; accountId: string }>(path));
}

// ---------------------------------------------------------------------------
// Canonical reporting dashboard -> provider-neutral FinanceData UI model.
// Conversion is complete before this adapter runs, so every amount carries the
// selected reporting currency and the view layer never performs FX math.

const ACCOUNT_TYPES: Record<Account["type"], true> = {
  checking: true,
  savings: true,
  credit: true,
  investment: true,
  crypto: true,
  loan: true,
};

const CATEGORY_GROUPS: Record<Category["group"], true> = {
  income: true,
  spending: true,
  transfers: true,
  debt: true,
  investing: true,
  other: true,
};

export function financeDataFromDashboard(
  dashboard: FinanceDashboard | null | undefined,
): FinanceData {
  if (!dashboard) {
    return { accounts: [], categories: [], transactions: [], positions: [] };
  }

  const cashBalancesByAccountCurrency = new Map<string, FinanceBalanceRecord>();
  for (const balance of dashboard.balances) {
    if (balance.cash === null) continue;
    cashBalancesByAccountCurrency.set(
      `${balance.accountId}\u0000${balance.currency}`,
      balance,
    );
  }

  const accounts: Account[] = dashboard.accounts.map((account) => {
    const canonicalCash = cashBalancesByAccountCurrency.get(
      `${account.id}\u0000${account.currency}`,
    );
    return {
      id: account.id,
      name: account.name,
      type:
        account.type in ACCOUNT_TYPES
          ? (account.type as Account["type"])
          : "checking",
      currency: account.currency,
      balance: account.balance ?? canonicalCash?.cash ?? undefined,
      source: account.source,
      status: account.status ?? "active",
      institution: account.institution ?? undefined,
      mask: account.mask ?? undefined,
      updatedAt: account.updatedAt,
    };
  });

  const categories: Category[] = dashboard.categories.map((category) => ({
    id: category.id,
    name: category.name,
    group:
      category.group in CATEGORY_GROUPS
        ? (category.group as Category["group"])
        : "other",
    excludeFromSpending: category.excludeFromSpending,
    color: category.color ?? undefined,
  }));

  const transactions: Transaction[] = dashboard.transactions.map(
    (transaction) => ({
      id: transaction.id,
      title: transaction.description,
      amount: transaction.amount,
      currency: transaction.currency,
      time: transaction.postedAt,
      accountId: transaction.accountId ?? undefined,
      categoryId: transaction.categoryId ?? undefined,
      status: transaction.status === "pending" ? "pending" : "posted",
      createdAt: transaction.postedAt,
      updatedAt: transaction.postedAt,
    }),
  );

  const positions: Position[] = dashboard.positions.map((position) => ({
    id: position.id,
    accountId: position.accountId ?? "",
    symbol: position.symbol,
    name: position.name ?? undefined,
    quantity: position.quantity,
    marketValue: position.marketValue ?? undefined,
    averageCost: position.averageCost ?? undefined,
    currency: position.currency,
    updatedAt: position.updatedAt,
  }));

  return { accounts, categories, transactions, positions };
}
