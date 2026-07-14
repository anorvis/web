import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";
import type {
  Account,
  Category,
  FinanceData,
  Position,
  Transaction,
} from "@/lib/life-intelligence/model";

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
  const dashboard = await convexClient.action(
    convexApi.financeDashboard.dashboard,
    { currency },
  );
  return financeDashboardFromConvex(dashboard, currency);
}

// ---------------------------------------------------------------------------
// Canonical CSV import.
//
// Mirrors `CsvImportBody` from os/src/capability/finance/schema.ts. The web
// parses CSV locally, but the normalized payload persists through the canonical
// backend — the source of truth for the dashboard on reload.
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
  return convexClient.mutation(convexApi.financeImport.undoImport, {
    importId,
  }) as Promise<FinanceImportUndoResult>;
}

export async function importFinanceCsv(
  body: CsvImportRequest,
): Promise<CsvImportResult> {
  return convexClient.action(convexApi.financeImport.importCsv, {
    ...body,
    transactions: body.transactions.map((transaction, index) => ({
      ...transaction,
      rowNumber: index + 1,
    })),
  }) as Promise<CsvImportResult>;
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
  const accountId = await convexClient.mutation(convexApi.finance.saveAccount, {
    name: body.name,
    type: body.type,
    currency: body.currency,
    balance: body.balance == null ? undefined : String(body.balance),
  });
  const dashboard = await fetchFinanceDashboard(body.currency);
  const account = dashboard.accounts.find((row) => row.id === accountId);
  if (!account) throw new Error("Created finance account was not returned");
  return { ok: true, account };
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
  const current = await findFinanceAccount(accountId);
  const savedAccountId = await convexClient.mutation(
    convexApi.finance.saveAccount,
    {
      id: accountId,
      name: body.name ?? current.name,
      type: current.type,
      currency: current.currency,
      balance:
        body.balance === undefined || body.balance === null
          ? undefined
          : String(body.balance),
      clearBalance: body.balance === null ? true : undefined,
      status:
        body.status ?? (current.status as "hidden" | "active" | undefined),
    },
  );
  const updated = await findFinanceAccount(String(savedAccountId));
  return { ok: true, account: updated };
}

export type DeleteFinanceAccountResult = {
  ok: true;
  accountId: string;
  deletedTransactions: number;
};

export async function deleteFinanceAccount(
  accountId: string,
): Promise<DeleteFinanceAccountResult> {
  return convexClient.mutation(convexApi.finance.removeAccount, {
    accountId,
  }) as Promise<DeleteFinanceAccountResult>;
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
  return convexClient.mutation(convexApi.finance.linkAccount, {
    canonicalAccountId: body.canonicalAccountId,
    accountId: body.duplicateAccountId,
  }) as Promise<FinanceAccountLinkResult>;
}

export async function unlinkFinanceAccount(
  accountId: string,
): Promise<{ unlinked: true; accountId: string }> {
  await convexClient.mutation(convexApi.finance.unlinkAccount, { accountId });
  return { unlinked: true, accountId };
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

function textNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
  }
  return null;
}

function iso(value: unknown): string | null {
  if (typeof value === "number" || typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }
  return null;
}

function financeDashboardFromConvex(
  value: unknown,
  currency: string,
): FinanceDashboard {
  const raw = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const rows = (name: string): Array<Record<string, unknown>> =>
    Array.isArray(raw[name])
      ? (raw[name] as Array<Record<string, unknown>>)
      : [];
  const categories = rows("categories").map((row) => ({
    id: String(row._id),
    name: String(row.name ?? ""),
    group: String(row.group ?? "other"),
    excludeFromSpending: row.excludeFromSpending === true,
    color: typeof row.color === "string" ? row.color : null,
  }));
  const categoryById = new Map(categories.map((row) => [row.id, row]));
  const accounts: FinanceAccountRecord[] = rows("accounts").map((row) => ({
    id: String(row._id),
    source: String(row.source ?? "manual"),
    sourceId: typeof row.sourceId === "string" ? row.sourceId : null,
    sourceVariant:
      typeof row.sourceVariant === "string" ? row.sourceVariant : null,
    name: String(row.name ?? ""),
    type: String(row.type ?? "checking"),
    currency: String(row.currency ?? currency),
    balance: textNumber(row.balance),
    institution: typeof row.institution === "string" ? row.institution : null,
    mask: typeof row.mask === "string" ? row.mask : null,
    status: typeof row.status === "string" ? row.status : null,
    importId: typeof row.importJobId === "string" ? row.importJobId : null,
    observedAt: iso(row.observedAt),
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
  }));
  const balances: FinanceBalanceRecord[] = rows("balances").map((row) => ({
    id: String(row._id),
    accountId: String(row.accountId),
    currency: String(row.currency ?? currency),
    cash: textNumber(row.cash),
    buyingPower: textNumber(row.buyingPower),
    observedAt: iso(row.observedAt) ?? new Date(0).toISOString(),
    source: String(row.source ?? "manual"),
    sourceVariant:
      typeof row.sourceVariant === "string" ? row.sourceVariant : null,
    importId: typeof row.importJobId === "string" ? row.importJobId : null,
    updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
  }));
  const transactions: FinanceTransactionRecord[] = rows("transactions").map(
    (row) => {
      const category =
        typeof row.categoryId === "string"
          ? categoryById.get(row.categoryId)
          : undefined;
      return {
        id: String(row._id),
        accountId: typeof row.accountId === "string" ? row.accountId : null,
        source: String(row.source ?? "manual"),
        sourceVariant:
          typeof row.sourceVariant === "string" ? row.sourceVariant : null,
        description: String(row.description ?? ""),
        amount: textNumber(row.amount) ?? 0,
        currency: String(row.currency ?? currency),
        postedAt: iso(row.postedAt) ?? new Date(0).toISOString(),
        categoryId: typeof row.categoryId === "string" ? row.categoryId : null,
        categoryName: category?.name ?? null,
        categoryGroup: category?.group ?? null,
        status: String(row.status ?? "posted"),
      };
    },
  );
  const positions: FinancePositionRecord[] = rows("positions").map((row) => ({
    id: String(row._id),
    accountId: typeof row.accountId === "string" ? row.accountId : null,
    source: String(row.source ?? "manual"),
    sourceVariant:
      typeof row.sourceVariant === "string" ? row.sourceVariant : null,
    symbol: String(row.symbol ?? ""),
    name: typeof row.name === "string" ? row.name : null,
    quantity: textNumber(row.quantity) ?? 0,
    marketValue: textNumber(row.marketValue),
    averageCost: textNumber(row.averageCost),
    currency: String(row.currency ?? currency),
    observedAt: iso(row.observedAt),
    updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
  }));
  const activities: FinanceActivityRecord[] = rows("activities").map((row) => ({
    id: String(row._id),
    accountId: typeof row.accountId === "string" ? row.accountId : null,
    source: String(row.source ?? "manual"),
    sourceVariant:
      typeof row.sourceVariant === "string" ? row.sourceVariant : null,
    type: String(row.type ?? ""),
    description: typeof row.description === "string" ? row.description : null,
    amount: textNumber(row.amount),
    currency: String(row.currency ?? currency),
    symbol: typeof row.symbol === "string" ? row.symbol : null,
    quantity: textNumber(row.quantity),
    price: textNumber(row.price),
    occurredAt: iso(row.occurredAt) ?? new Date(0).toISOString(),
    settledAt: iso(row.settledAt),
    status: String(row.status ?? "posted"),
  }));
  const history: FinanceHistoryRecord[] = rows("valueHistory").map((row) => ({
    accountId: typeof row.accountId === "string" ? row.accountId : null,
    date: String(row.date ?? ""),
    equity: textNumber(row.equity) ?? 0,
    cash: textNumber(row.cash),
    currency: String(row.currency ?? currency),
    source: String(row.source ?? "manual"),
  }));
  const returnRates: FinanceAccountReturnRateRecord[] = rows("returnRates").map(
    (row) => ({
      accountId: String(row.accountId),
      source: String(row.source ?? "manual"),
      sourceVariant:
        typeof row.sourceVariant === "string" ? row.sourceVariant : null,
      timeframe: String(row.timeframe ?? ""),
      returnPercent: textNumber(row.returnPercent) ?? 0,
      asOf: typeof row.asOf === "string" ? row.asOf : null,
      observedAt: iso(row.observedAt) ?? new Date(0).toISOString(),
      updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
    }),
  );
  const imports: FinanceImportRecord[] = rows("imports").map((row) => ({
    id: String(row._id),
    source: String(row.source ?? "manual"),
    sourceVariant:
      typeof row.sourceVariant === "string" ? row.sourceVariant : null,
    accountId: typeof row.accountId === "string" ? row.accountId : null,
    status: String(row.status ?? "completed"),
    importedCount:
      textNumber(row.appliedCount) ?? textNumber(row.importedCount) ?? 0,
    skippedCount: textNumber(row.skippedCount) ?? 0,
    error: typeof row.error === "string" ? row.error : null,
    startedAt: iso(row.startedAt) ?? new Date(0).toISOString(),
    finishedAt: iso(row.finishedAt),
    createdAt: iso(row.createdAt) ?? new Date(0).toISOString(),
    updatedAt: iso(row.updatedAt) ?? new Date(0).toISOString(),
  }));
  const currencyCodes = new Set([
    ...accounts.map((row) => row.currency),
    ...transactions.map((row) => row.currency),
    ...positions.map((row) => row.currency),
  ]);
  const byCurrency = [...currencyCodes].sort().map((code) => ({
    currency: code,
    accounts: accounts.filter((row) => row.currency === code),
    balances: balances.filter((row) => row.currency === code),
    transactions: transactions.filter((row) => row.currency === code),
    positions: positions.filter((row) => row.currency === code),
    activities: activities.filter((row) => row.currency === code),
  }));
  const sourceKeys = new Set(
    accounts.map((row) => `${row.source}\0${row.sourceVariant ?? ""}`),
  );
  const sources = [...sourceKeys].map((key) => {
    const [source, sourceVariant = ""] = key.split("\0");
    const sourceAccounts = accounts.filter(
      (row) =>
        row.source === source && (row.sourceVariant ?? "") === sourceVariant,
    );
    const sourceTransactions = transactions.filter(
      (row) =>
        row.source === source && (row.sourceVariant ?? "") === sourceVariant,
    );
    const observed = sourceAccounts.flatMap((row) =>
      row.observedAt ? [row.observedAt] : [],
    );
    const imported = imports
      .filter(
        (row) =>
          row.source === source && (row.sourceVariant ?? "") === sourceVariant,
      )
      .flatMap((row) => (row.finishedAt ? [row.finishedAt] : []));
    return {
      source,
      sourceVariant: sourceVariant || null,
      accountCount: sourceAccounts.length,
      transactionCount: sourceTransactions.length,
      lastObservedAt: observed.sort().at(-1) ?? null,
      lastImportedAt: imported.sort().at(-1) ?? null,
    };
  });
  return {
    accounts,
    balances,
    transactions,
    categories,
    positions,
    activities,
    history,
    returnRates,
    imports,
    byCurrency,
    sources,
    conversion: {
      currency:
        typeof (raw.conversion as Record<string, unknown> | undefined)
          ?.currency === "string"
          ? String((raw.conversion as Record<string, unknown>).currency)
          : currency,
      asOf: iso((raw.conversion as Record<string, unknown> | undefined)?.asOf),
      providers: Array.isArray(
        (raw.conversion as Record<string, unknown> | undefined)?.providers,
      )
        ? (
            (raw.conversion as Record<string, unknown>).providers as unknown[]
          ).filter(
            (provider): provider is string => typeof provider === "string",
          )
        : [],
      stale:
        (raw.conversion as Record<string, unknown> | undefined)?.stale === true,
    },
  };
}

async function findFinanceAccount(
  accountId: string,
): Promise<FinanceAccountRecord> {
  const dashboard = await fetchFinanceDashboard("USD");
  const account = dashboard.accounts.find((row) => row.id === accountId);
  if (!account) throw new Error("Finance account not found");
  return account;
}
