import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cashflow, spendingByCategory } from "../components/finance-derive";

import type {
  CsvImportRequest,
  CsvImportResult,
  FinanceDashboard,
  FinanceImportUndoResult,
} from "./finance";
import {
  createFinanceAccount,
  deleteFinanceAccount,
  fetchFinanceDashboard,
  financeDataFromDashboard,
  importFinanceCsv,
  linkFinanceAccounts,
  undoFinanceImport,
  unlinkFinanceAccount,
  updateFinanceAccount,
} from "./finance";

// The finance source clients speak to the canonical OS routes through the
// global `fetch`. We stub `fetch` so the tests are hermetic (no network) and can
// inspect the exact request that leaves the web — the source/account provenance
// a request must carry, the route it targets, and how a failure surfaces.
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const TS = "2026-07-09T12:00:00.000Z";

function dashboardFixture(
  overrides: Partial<FinanceDashboard> = {},
): FinanceDashboard {
  return {
    accounts: [],
    balances: [],
    transactions: [],
    categories: [],
    positions: [],
    activities: [],
    history: [],
    returnRates: [],
    imports: [],
    sources: [],
    conversion: {
      currency: "CAD",
      asOf: "2026-07-09",
      providers: ["Frankfurter / ECB"],
      stale: false,
    },
    byCurrency: [],
    ...overrides,
  };
}

// The request the client actually put on the wire (route, verb, parsed body).
function sentRequest() {
  const call = fetchMock.mock.calls.at(-1);
  if (!call) throw new Error("fetch was never called");
  const [path, init] = call as [string, RequestInit | undefined];
  const rawBody = init?.body;
  return {
    path,
    method: init?.method ?? "GET",
    body:
      typeof rawBody === "string"
        ? (JSON.parse(rawBody) as Record<string, unknown>)
        : undefined,
  };
}

describe("importFinanceCsv request contract", () => {
  it("posts the selected account id and row provenance to the canonical CSV import route", async () => {
    const result: CsvImportResult = {
      imported: 2,
      skippedDuplicates: 1,
      skippedCrossSource: 1,
      accountId: "acct-td",
      importId: "imp-1",
      status: "ok",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(result));

    const body: CsvImportRequest = {
      source: "td_canada",
      accountId: "acct-td",
      balance: 1234.56,
      transactions: [
        {
          fingerprint: "fp-1",
          date: "2026-01-05",
          description: "COFFEE",
          amount: -4.25,
          category: "groceries",
          currency: "CAD",
        },
        {
          fingerprint: "fp-2",
          date: "2026-01-06",
          description: "PAYCHECK",
          amount: 2000,
          category: "income",
          currency: "CAD",
        },
      ],
    };

    const returned = await importFinanceCsv(body);

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/imports/csv");
    expect(sent.method).toBe("POST");
    // Account ownership is explicit: the browser sends the selected canonical
    // account id rather than filename-derived account fallback metadata.
    expect(sent.body).toMatchObject({
      source: "td_canada",
      accountId: "acct-td",
      balance: 1234.56,
    });
    expect(sent.body).not.toHaveProperty("accountName");
    expect(sent.body).not.toHaveProperty("accountType");
    expect(sent.body).not.toHaveProperty("accountCurrency");
    expect(sent.body).not.toHaveProperty("institution");
    expect(sent.body).not.toHaveProperty("mask");
    // Per-row provenance (dedupe fingerprint + original currency) survives too.
    expect(sent.body?.transactions).toEqual(body.transactions);
    // The canonical result is surfaced to the caller unchanged.
    expect(returned).toEqual(result);
  });

  it("posts an account-id-only CSV request without legacy account fallback fields", async () => {
    const result: CsvImportResult = {
      imported: 0,
      skippedDuplicates: 0,
      skippedCrossSource: 0,
      accountId: "acct-manual",
      importId: "imp-empty",
      status: "ok",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(result));

    const body: CsvImportRequest = {
      source: "manual",
      accountId: "acct-manual",
      transactions: [],
    };

    const returned = await importFinanceCsv(body);

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/imports/csv");
    expect(sent.method).toBe("POST");
    expect(sent.body).toEqual({
      source: "manual",
      accountId: "acct-manual",
      transactions: [],
    });
    expect(returned).toEqual(result);
  });

  it("surfaces the OS failure instead of returning a fake success when the import route errors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: "import route unavailable" }, 500),
    );

    const body: CsvImportRequest = {
      source: "manual",
      accountId: "acct-manual",
      transactions: [],
    };

    await expect(importFinanceCsv(body)).rejects.toMatchObject({
      _tag: "ApiError",
      status: 500,
      path: "/api/finance/imports/csv",
      message: "import route unavailable",
    });
    const sent = sentRequest();
    expect(sent.body).not.toHaveProperty("institution");
    expect(sent.body).not.toHaveProperty("mask");
  });
});

describe("createFinanceAccount request contract", () => {
  it("posts the new account fields and returns the canonical account created by the OS", async () => {
    const result = {
      ok: true as const,
      account: {
        id: "acct-new",
        source: "csv",
        sourceId: null,
        sourceVariant: "manual",
        name: "CSV Checking",
        type: "checking",
        currency: "CAD",
        balance: 123.45,
        institution: null,
        mask: null,
        status: "open",
        importId: null,
        observedAt: TS,
        createdAt: TS,
        updatedAt: TS,
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(result, 201));

    const returned = await createFinanceAccount({
      name: "CSV Checking",
      type: "checking",
      currency: "CAD",
      balance: 123.45,
    });

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/accounts");
    expect(sent.method).toBe("POST");
    expect(sent.body).toEqual({
      name: "CSV Checking",
      type: "checking",
      currency: "CAD",
      balance: 123.45,
    });
    expect(returned).toEqual(result);
  });
});

describe("finance account lifecycle request contract", () => {
  it("patches account name and balance by encoded id and returns the canonical account", async () => {
    const result = {
      ok: true as const,
      account: {
        id: "acct/manual 1",
        source: "manual",
        sourceId: null,
        sourceVariant: null,
        name: "Cash Jar",
        type: "checking",
        currency: "CAD",
        balance: 125.5,
        institution: null,
        mask: null,
        status: "active",
        importId: null,
        observedAt: TS,
        createdAt: TS,
        updatedAt: TS,
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(result));

    const returned = await updateFinanceAccount("acct/manual 1", {
      name: "Cash Jar",
      balance: 125.5,
    });

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/accounts/acct%2Fmanual%201");
    expect(sent.method).toBe("PATCH");
    expect(sent.body).toEqual({ name: "Cash Jar", balance: 125.5 });
    expect(returned).toEqual(result);
  });

  it("patches account status by encoded id and returns the canonical account", async () => {
    const result = {
      ok: true as const,
      account: {
        id: "acct/manual 1",
        source: "manual",
        sourceId: null,
        sourceVariant: null,
        name: "Manual",
        type: "checking",
        currency: "CAD",
        balance: 10,
        institution: null,
        mask: null,
        status: "hidden",
        importId: null,
        observedAt: TS,
        createdAt: TS,
        updatedAt: TS,
      },
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(result));

    const returned = await updateFinanceAccount("acct/manual 1", {
      status: "hidden",
    });

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/accounts/acct%2Fmanual%201");
    expect(sent.method).toBe("PATCH");
    expect(sent.body).toEqual({ status: "hidden" });
    expect(returned).toEqual(result);
  });

  it("deletes a manual account by encoded id and returns the deletion count", async () => {
    const result = {
      ok: true as const,
      accountId: "acct/manual 1",
      deletedTransactions: 3,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(result));

    const returned = await deleteFinanceAccount("acct/manual 1");

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/accounts/acct%2Fmanual%201");
    expect(sent.method).toBe("DELETE");
    expect(sent.body).toBeUndefined();
    expect(returned).toEqual(result);
  });
});

describe("undoFinanceImport request contract", () => {
  it("deletes the fully encoded receipt route without a body and returns the typed OS deletion result", async () => {
    const result: FinanceImportUndoResult = {
      ok: true,
      importId: "csv/import?source=csv&currency=CAD",
      deletedTransactions: 4,
      deletedAccountId: "acct-placeholder",
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(result));

    const returned = await undoFinanceImport(
      "csv/import?source=csv&currency=CAD",
    );

    const sent = sentRequest();
    expect(sent.path).toBe(
      "/api/finance/imports/csv%2Fimport%3Fsource%3Dcsv%26currency%3DCAD",
    );
    expect(sent.method).toBe("DELETE");
    expect(sent.body).toBeUndefined();
    expect(returned).toEqual(result);
  });
});

describe("finance account link request contract", () => {
  it("posts an explicit canonical-to-duplicate account link and returns the reconciliation counts", async () => {
    const result = {
      linked: true as const,
      canonicalAccountId: "acct-snaptrade",
      duplicateAccountId: "acct-csv",
      transactionsMerged: 1,
      transactionsRekeyed: 2,
    };
    fetchMock.mockResolvedValueOnce(jsonResponse(result, 201));

    const returned = await linkFinanceAccounts({
      canonicalAccountId: "acct-snaptrade",
      duplicateAccountId: "acct-csv",
    });

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/accounts/links");
    expect(sent.method).toBe("POST");
    expect(sent.body).toEqual({
      canonicalAccountId: "acct-snaptrade",
      duplicateAccountId: "acct-csv",
    });
    expect(returned).toEqual(result);
  });

  it("unlinks the duplicate account by encoded id with a DELETE", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ unlinked: true, accountId: "csv/account 1" }),
    );

    const returned = await unlinkFinanceAccount("csv/account 1");

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/accounts/links/csv%2Faccount%201");
    expect(sent.method).toBe("DELETE");
    expect(sent.body).toBeUndefined();
    expect(returned).toEqual({ unlinked: true, accountId: "csv/account 1" });
  });
});

describe("fetchFinanceDashboard request contract", () => {
  it("reads the canonical dashboard route and returns per-currency groups without merging them", async () => {
    const dashboard = dashboardFixture({
      byCurrency: [
        {
          currency: "USD",
          accounts: [],
          balances: [],
          transactions: [],
          positions: [],
          activities: [],
        },
        {
          currency: "CAD",
          accounts: [],
          balances: [],
          transactions: [],
          positions: [],
          activities: [],
        },
      ],
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(dashboard));

    const returned = await fetchFinanceDashboard("CAD");

    const sent = sentRequest();
    expect(sent.path).toBe("/api/finance/dashboard?currency=CAD");
    expect(sent.method).toBe("GET");
    // Both currency groups reach the caller distinct — never collapsed into one.
    expect(returned.byCurrency.map((group) => group.currency)).toEqual([
      "USD",
      "CAD",
    ]);
    expect(returned).toEqual(dashboard);
  });

  it("adapts promoted card spends as canonical transactions while brokerage activity stays outside derive totals", () => {
    const dashboard = dashboardFixture({
      accounts: [
        {
          id: "acct-checking",
          source: "snaptrade",
          sourceId: "snap-checking-1",
          sourceVariant: "wealthsimple",
          name: "Wealthsimple Cash",
          type: "checking",
          currency: "CAD",
          balance: 742.13,
          institution: "Wealthsimple",
          mask: "4321",
          status: "open",
          importId: null,
          observedAt: TS,
          createdAt: TS,
          updatedAt: TS,
        },
        {
          id: "acct-brokerage",
          source: "snaptrade",
          sourceId: "snap-brokerage-1",
          sourceVariant: "wealthsimple",
          name: "Wealthsimple RRSP",
          type: "investment",
          currency: "CAD",
          balance: 15_250.75,
          institution: "Wealthsimple",
          mask: "9012",
          status: "open",
          importId: null,
          observedAt: TS,
          createdAt: TS,
          updatedAt: TS,
        },
      ],
      categories: [
        {
          id: "cat-card-spend",
          name: "card spend",
          group: "spending",
          excludeFromSpending: false,
          color: null,
        },
      ],
      transactions: [
        {
          id: "txn-card-spend",
          accountId: "acct-checking",
          source: "snaptrade",
          sourceVariant: "wealthsimple",
          description: "Coffee shop",
          amount: -42.5,
          currency: "CAD",
          postedAt: "2026-07-08",
          categoryId: "cat-card-spend",
          categoryName: "card spend",
          categoryGroup: "spending",
          status: "posted",
        },
      ],
      activities: [
        {
          id: "act-buy",
          accountId: "acct-brokerage",
          source: "snaptrade",
          sourceVariant: "wealthsimple",
          type: "BUY",
          description: "Bought Shopify",
          amount: -435.12,
          currency: "CAD",
          symbol: "SHOP",
          quantity: 3,
          price: 145.04,
          occurredAt: "2026-07-06T15:30:00.000Z",
          settledAt: "2026-07-08T00:00:00.000Z",
          status: "settled",
        },
      ],
    });

    const adapted = financeDataFromDashboard(dashboard);
    const { income, spending, net } = cashflow(adapted);

    expect(dashboard.activities.map((activity) => activity.id)).toEqual([
      "act-buy",
    ]);
    expect(adapted.transactions.map((transaction) => transaction.id)).toEqual([
      "txn-card-spend",
    ]);
    expect(income.has("CAD")).toBe(false);
    expect(spending.get("CAD")).toBe(42.5);
    expect(net.get("CAD")).toBe(-42.5);
    expect(spendingByCategory(adapted, "CAD")).toEqual([
      {
        id: "cat-card-spend",
        label: "card spend",
        group: "spending",
        currency: "CAD",
        total: 42.5,
      },
    ]);
  });

  it("uses account balance first and falls back only to same-account same-currency canonical cash", () => {
    const adapted = financeDataFromDashboard(
      dashboardFixture({
        accounts: [
          {
            id: "acct-asset",
            source: "csv",
            sourceId: null,
            sourceVariant: "manual",
            name: "Asset",
            type: "checking",
            currency: "CAD",
            balance: null,
            institution: null,
            mask: null,
            status: "open",
            importId: null,
            observedAt: TS,
            createdAt: TS,
            updatedAt: TS,
          },
          {
            id: "acct-explicit",
            source: "csv",
            sourceId: null,
            sourceVariant: "manual",
            name: "Explicit",
            type: "checking",
            currency: "CAD",
            balance: 10,
            institution: null,
            mask: null,
            status: "open",
            importId: null,
            observedAt: TS,
            createdAt: TS,
            updatedAt: TS,
          },
          {
            id: "acct-credit",
            source: "csv",
            sourceId: null,
            sourceVariant: "manual",
            name: "Card",
            type: "credit",
            currency: "CAD",
            balance: null,
            institution: null,
            mask: null,
            status: "open",
            importId: null,
            observedAt: TS,
            createdAt: TS,
            updatedAt: TS,
          },
          {
            id: "acct-no-match",
            source: "csv",
            sourceId: null,
            sourceVariant: "manual",
            name: "No matching balance",
            type: "checking",
            currency: "CAD",
            balance: null,
            institution: null,
            mask: null,
            status: "open",
            importId: null,
            observedAt: TS,
            createdAt: TS,
            updatedAt: TS,
          },
        ],
        balances: [
          {
            id: "bal-asset",
            accountId: "acct-asset",
            currency: "CAD",
            cash: 100,
            buyingPower: null,
            observedAt: TS,
            source: "csv",
            sourceVariant: "manual",
            importId: null,
            updatedAt: TS,
          },
          {
            id: "bal-other-currency",
            accountId: "acct-asset",
            currency: "USD",
            cash: 999,
            buyingPower: null,
            observedAt: TS,
            source: "csv",
            sourceVariant: "manual",
            importId: null,
            updatedAt: TS,
          },
          {
            id: "bal-explicit",
            accountId: "acct-explicit",
            currency: "CAD",
            cash: 500,
            buyingPower: null,
            observedAt: TS,
            source: "csv",
            sourceVariant: "manual",
            importId: null,
            updatedAt: TS,
          },
          {
            id: "bal-credit",
            accountId: "acct-credit",
            currency: "CAD",
            cash: -25,
            buyingPower: null,
            observedAt: TS,
            source: "csv",
            sourceVariant: "manual",
            importId: null,
            updatedAt: TS,
          },
          {
            id: "bal-no-match-currency",
            accountId: "acct-no-match",
            currency: "USD",
            cash: 888,
            buyingPower: null,
            observedAt: TS,
            source: "csv",
            sourceVariant: "manual",
            importId: null,
            updatedAt: TS,
          },
          {
            id: "bal-no-match-account",
            accountId: "acct-unrelated",
            currency: "CAD",
            cash: 777,
            buyingPower: null,
            observedAt: TS,
            source: "csv",
            sourceVariant: "manual",
            importId: null,
            updatedAt: TS,
          },
        ],
      }),
    );

    expect(
      adapted.accounts.map((account) => ({
        id: account.id,
        balance: account.balance,
        source: account.source,
        status: account.status,
      })),
    ).toEqual([
      { id: "acct-asset", balance: 100, source: "csv", status: "open" },
      { id: "acct-explicit", balance: 10, source: "csv", status: "open" },
      { id: "acct-credit", balance: -25, source: "csv", status: "open" },
      {
        id: "acct-no-match",
        balance: undefined,
        source: "csv",
        status: "open",
      },
    ]);
  });

  it("keeps SnapTrade return rates and activities on the dashboard contract while adapting only canonical transactions", async () => {
    const dashboard = dashboardFixture({
      accounts: [
        {
          id: "acct-ws",
          source: "snaptrade",
          sourceId: "snap-account-1",
          sourceVariant: "wealthsimple",
          name: "Wealthsimple RRSP",
          type: "investment",
          currency: "CAD",
          balance: 15_250.75,
          institution: "Wealthsimple",
          mask: "9012",
          status: "open",
          importId: null,
          observedAt: TS,
          createdAt: TS,
          updatedAt: TS,
        },
      ],
      categories: [
        {
          id: "cat-dividend",
          name: "dividend",
          group: "income",
          excludeFromSpending: false,
          color: null,
        },
      ],
      transactions: [
        {
          id: "txn-dividend",
          accountId: "acct-ws",
          source: "snaptrade",
          sourceVariant: "wealthsimple",
          description: "Cash dividend",
          amount: 12.34,
          currency: "CAD",
          postedAt: "2026-07-07",
          categoryId: "cat-dividend",
          categoryName: "dividend",
          categoryGroup: "income",
          status: "posted",
        },
      ],
      positions: [
        {
          id: "pos-shop",
          accountId: "acct-ws",
          source: "snaptrade",
          sourceVariant: "wealthsimple",
          symbol: "SHOP",
          name: "Shopify",
          quantity: 3,
          marketValue: 435.12,
          averageCost: 102.5,
          currency: "CAD",
          observedAt: TS,
          updatedAt: TS,
        },
      ],
      activities: [
        {
          id: "act-buy",
          accountId: "acct-ws",
          source: "snaptrade",
          sourceVariant: "wealthsimple",
          type: "BUY",
          description: "Bought Shopify",
          amount: -435.12,
          currency: "CAD",
          symbol: "SHOP",
          quantity: 3,
          price: 145.04,
          occurredAt: "2026-07-06T15:30:00.000Z",
          settledAt: "2026-07-08T00:00:00.000Z",
          status: "settled",
        },
      ],
      history: [
        {
          accountId: "acct-ws",
          date: "2026-07-06",
          equity: 15_000,
          cash: 1_250,
          currency: "CAD",
          source: "snaptrade",
        },
        {
          accountId: "acct-ws",
          date: "2026-07-07",
          equity: 15_250.75,
          cash: 1_262.34,
          currency: "CAD",
          source: "snaptrade",
        },
      ],
      returnRates: [
        {
          accountId: "acct-ws",
          source: "snaptrade",
          sourceVariant: "wealthsimple",
          timeframe: "1Y",
          returnPercent: 8.91,
          asOf: "2026-07-07",
          observedAt: TS,
          updatedAt: TS,
        },
      ],
    });
    fetchMock.mockResolvedValueOnce(jsonResponse(dashboard));

    const returned = await fetchFinanceDashboard("CAD");
    const adapted = financeDataFromDashboard(returned);

    expect(returned.history).toEqual([
      {
        accountId: "acct-ws",
        date: "2026-07-06",
        equity: 15_000,
        cash: 1_250,
        currency: "CAD",
        source: "snaptrade",
      },
      {
        accountId: "acct-ws",
        date: "2026-07-07",
        equity: 15_250.75,
        cash: 1_262.34,
        currency: "CAD",
        source: "snaptrade",
      },
    ]);
    expect(returned.returnRates).toEqual([
      {
        accountId: "acct-ws",
        source: "snaptrade",
        sourceVariant: "wealthsimple",
        timeframe: "1Y",
        returnPercent: 8.91,
        asOf: "2026-07-07",
        observedAt: TS,
        updatedAt: TS,
      },
    ]);
    expect(returned.activities).toEqual([
      {
        id: "act-buy",
        accountId: "acct-ws",
        source: "snaptrade",
        sourceVariant: "wealthsimple",
        type: "BUY",
        description: "Bought Shopify",
        amount: -435.12,
        currency: "CAD",
        symbol: "SHOP",
        quantity: 3,
        price: 145.04,
        occurredAt: "2026-07-06T15:30:00.000Z",
        settledAt: "2026-07-08T00:00:00.000Z",
        status: "settled",
      },
    ]);
    expect(adapted.positions).toEqual([
      {
        id: "pos-shop",
        accountId: "acct-ws",
        symbol: "SHOP",
        name: "Shopify",
        quantity: 3,
        marketValue: 435.12,
        averageCost: 102.5,
        currency: "CAD",
        updatedAt: TS,
      },
    ]);
    expect(adapted.transactions).toEqual([
      {
        id: "txn-dividend",
        title: "Cash dividend",
        amount: 12.34,
        currency: "CAD",
        time: "2026-07-07",
        accountId: "acct-ws",
        categoryId: "cat-dividend",
        status: "posted",
        createdAt: "2026-07-07",
        updatedAt: "2026-07-07",
      },
    ]);
  });
});
