import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";

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

vi.mock("@/lib/convex-client", () => ({
  convexClient: {
    action: vi.fn(),
    mutation: vi.fn(),
    query: vi.fn(),
  },
}));

const actionMock = vi.mocked(convexClient.action);
const mutationMock = vi.mocked(convexClient.mutation);

const TS = "2026-07-09T12:00:00.000Z";

beforeEach(() => {
  actionMock.mockReset();
  mutationMock.mockReset();
  vi.mocked(convexClient.query).mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

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
      asOf: "2026-07-09T00:00:00.000Z",
      providers: ["Frankfurter / ECB"],
      stale: false,
    },
    byCurrency: [],
    ...overrides,
  };
}

function convexAccount(overrides: Record<string, unknown> = {}) {
  return {
    _id: "acct-manual",
    source: "manual",
    sourceId: null,
    sourceVariant: null,
    name: "Manual",
    type: "checking",
    currency: "CAD",
    balance: "123.45",
    institution: null,
    mask: null,
    status: "active",
    importJobId: null,
    observedAt: TS,
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

function convexDashboard(overrides: Record<string, unknown> = {}) {
  return {
    accounts: [],
    balances: [],
    transactions: [],
    categories: [],
    positions: [],
    activities: [],
    valueHistory: [],
    returnRates: [],
    imports: [],
    conversion: {
      currency: "CAD",
      asOf: "2026-07-09T00:00:00.000Z",
      providers: ["Frankfurter / ECB"],
      stale: false,
    },
    ...overrides,
  };
}

describe("importFinanceCsv Convex contract", () => {
  it("calls the CSV import action with selected account provenance and row numbers", async () => {
    const result: CsvImportResult = {
      imported: 2,
      skippedDuplicates: 1,
      skippedCrossSource: 1,
      accountId: "acct-td",
      importId: "imp-1",
      status: "ok",
    };
    actionMock.mockResolvedValueOnce(result as never);

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

    await expect(importFinanceCsv(body)).resolves.toEqual(result);
    expect(actionMock).toHaveBeenCalledTimes(1);
    expect(actionMock).toHaveBeenCalledWith(convexApi.financeImport.importCsv, {
      source: "td_canada",
      accountId: "acct-td",
      balance: 1234.56,
      transactions: [
        { ...body.transactions[0], rowNumber: 1 },
        { ...body.transactions[1], rowNumber: 2 },
      ],
    });
  });

  it("sends an account-id-only CSV import without legacy account fallback fields", async () => {
    const result: CsvImportResult = {
      imported: 0,
      skippedDuplicates: 0,
      skippedCrossSource: 0,
      accountId: "acct-manual",
      importId: "imp-empty",
      status: "ok",
    };
    actionMock.mockResolvedValueOnce(result as never);

    await expect(
      importFinanceCsv({
        source: "manual",
        accountId: "acct-manual",
        transactions: [],
      }),
    ).resolves.toEqual(result);
    expect(actionMock).toHaveBeenCalledWith(convexApi.financeImport.importCsv, {
      source: "manual",
      accountId: "acct-manual",
      transactions: [],
    });
    expect(actionMock.mock.calls[0]?.[1]).not.toHaveProperty("accountName");
    expect(actionMock.mock.calls[0]?.[1]).not.toHaveProperty("accountType");
    expect(actionMock.mock.calls[0]?.[1]).not.toHaveProperty("accountCurrency");
    expect(actionMock.mock.calls[0]?.[1]).not.toHaveProperty("institution");
    expect(actionMock.mock.calls[0]?.[1]).not.toHaveProperty("mask");
  });

  it("surfaces Convex import failures", async () => {
    const error = new Error("import route unavailable");
    actionMock.mockRejectedValueOnce(error as never);

    await expect(
      importFinanceCsv({
        source: "manual",
        accountId: "acct-manual",
        transactions: [],
      }),
    ).rejects.toThrow("import route unavailable");
    expect(actionMock).toHaveBeenCalledWith(convexApi.financeImport.importCsv, {
      source: "manual",
      accountId: "acct-manual",
      transactions: [],
    });
  });
});

describe("finance account lifecycle Convex contract", () => {
  it("creates an account through saveAccount and adapts the created dashboard row", async () => {
    mutationMock.mockResolvedValueOnce("acct-new" as never);
    actionMock.mockResolvedValueOnce(
      convexDashboard({
        accounts: [
          convexAccount({
            _id: "acct-new",
            source: "csv",
            sourceVariant: "manual",
            name: "CSV Checking",
            type: "checking",
            currency: "CAD",
            balance: "123.45",
            status: "open",
          }),
        ],
      }) as never,
    );

    const returned = await createFinanceAccount({
      name: "CSV Checking",
      type: "checking",
      currency: "CAD",
      balance: 123.45,
    });

    expect(mutationMock).toHaveBeenCalledWith(convexApi.finance.saveAccount, {
      name: "CSV Checking",
      type: "checking",
      currency: "CAD",
      balance: "123.45",
    });
    expect(actionMock).toHaveBeenCalledWith(
      convexApi.financeDashboard.dashboard,
      { currency: "CAD" },
    );
    expect(returned).toMatchObject({
      ok: true,
      account: {
        id: "acct-new",
        name: "CSV Checking",
        balance: 123.45,
        currency: "CAD",
      },
    });
  });

  it("updates account fields using the current dashboard row and returns the refreshed account", async () => {
    actionMock
      .mockResolvedValueOnce(
        convexDashboard({
          accounts: [
            convexAccount({
              _id: "acct/manual 1",
              name: "Manual",
              balance: "10",
            }),
          ],
        }) as never,
      )
      .mockResolvedValueOnce(
        convexDashboard({
          accounts: [
            convexAccount({
              _id: "acct/manual 1",
              name: "Cash Jar",
              balance: "125.5",
            }),
          ],
        }) as never,
      );
    mutationMock.mockResolvedValueOnce("acct/manual 1" as never);

    const returned = await updateFinanceAccount("acct/manual 1", {
      name: "Cash Jar",
      balance: 125.5,
    });

    expect(actionMock).toHaveBeenNthCalledWith(
      1,
      convexApi.financeDashboard.dashboard,
      { currency: "USD" },
    );
    expect(mutationMock).toHaveBeenCalledWith(convexApi.finance.saveAccount, {
      id: "acct/manual 1",
      name: "Cash Jar",
      type: "checking",
      currency: "CAD",
      balance: "125.5",
      clearBalance: undefined,
      status: "active",
    });
    expect(actionMock).toHaveBeenNthCalledWith(
      2,
      convexApi.financeDashboard.dashboard,
      { currency: "USD" },
    );
    expect(returned.account).toMatchObject({
      id: "acct/manual 1",
      name: "Cash Jar",
      balance: 125.5,
    });
  });

  it("clears balance and updates status through saveAccount metadata", async () => {
    actionMock
      .mockResolvedValueOnce(
        convexDashboard({
          accounts: [
            convexAccount({
              _id: "acct/manual 1",
              balance: "10",
              status: "active",
            }),
          ],
        }) as never,
      )
      .mockResolvedValueOnce(
        convexDashboard({
          accounts: [
            convexAccount({
              _id: "acct/manual 1",
              balance: null,
              status: "hidden",
            }),
          ],
        }) as never,
      );
    mutationMock.mockResolvedValueOnce("acct/manual 1" as never);

    const returned = await updateFinanceAccount("acct/manual 1", {
      balance: null,
      status: "hidden",
    });

    expect(mutationMock).toHaveBeenCalledWith(convexApi.finance.saveAccount, {
      id: "acct/manual 1",
      name: "Manual",
      type: "checking",
      currency: "CAD",
      balance: undefined,
      clearBalance: true,
      status: "hidden",
    });
    expect(returned.account).toMatchObject({
      id: "acct/manual 1",
      balance: null,
      status: "hidden",
    });
  });

  it("deletes a manual account through removeAccount", async () => {
    const result = {
      ok: true as const,
      accountId: "acct/manual 1",
      deletedTransactions: 3,
    };
    mutationMock.mockResolvedValueOnce(result as never);

    await expect(deleteFinanceAccount("acct/manual 1")).resolves.toEqual(
      result,
    );
    expect(mutationMock).toHaveBeenCalledWith(convexApi.finance.removeAccount, {
      accountId: "acct/manual 1",
    });
  });
});

describe("finance import undo and account linking Convex contract", () => {
  it("undoes a CSV import by import id", async () => {
    const result: FinanceImportUndoResult = {
      ok: true,
      importId: "csv/import?source=csv&currency=CAD",
      deletedTransactions: 4,
      deletedAccountId: "acct-placeholder",
    };
    mutationMock.mockResolvedValueOnce(result as never);

    await expect(
      undoFinanceImport("csv/import?source=csv&currency=CAD"),
    ).resolves.toEqual(result);
    expect(mutationMock).toHaveBeenCalledWith(
      convexApi.financeImport.undoImport,
      {
        importId: "csv/import?source=csv&currency=CAD",
      },
    );
  });

  it("links canonical and duplicate accounts with Convex argument names", async () => {
    const result = {
      linked: true as const,
      canonicalAccountId: "acct-snaptrade",
      duplicateAccountId: "acct-csv",
      transactionsMerged: 1,
      transactionsRekeyed: 2,
    };
    mutationMock.mockResolvedValueOnce(result as never);

    await expect(
      linkFinanceAccounts({
        canonicalAccountId: "acct-snaptrade",
        duplicateAccountId: "acct-csv",
      }),
    ).resolves.toEqual(result);
    expect(mutationMock).toHaveBeenCalledWith(convexApi.finance.linkAccount, {
      canonicalAccountId: "acct-snaptrade",
      accountId: "acct-csv",
    });
  });

  it("unlinks the duplicate account and adapts the return shape", async () => {
    mutationMock.mockResolvedValueOnce(undefined as never);

    await expect(unlinkFinanceAccount("csv/account 1")).resolves.toEqual({
      unlinked: true,
      accountId: "csv/account 1",
    });
    expect(mutationMock).toHaveBeenCalledWith(convexApi.finance.unlinkAccount, {
      accountId: "csv/account 1",
    });
  });
});

describe("fetchFinanceDashboard Convex contract", () => {
  it("calls the dashboard action and derives currency groups plus conversion metadata", async () => {
    actionMock.mockResolvedValueOnce(
      convexDashboard({
        accounts: [
          convexAccount({ _id: "acct-usd", currency: "USD", balance: "10" }),
          convexAccount({ _id: "acct-cad", currency: "CAD", balance: "20" }),
        ],
        transactions: [
          {
            _id: "txn-usd",
            accountId: "acct-usd",
            source: "manual",
            description: "USD",
            amount: "-1",
            currency: "USD",
            postedAt: TS,
            status: "posted",
          },
          {
            _id: "txn-cad",
            accountId: "acct-cad",
            source: "manual",
            description: "CAD",
            amount: "-2",
            currency: "CAD",
            postedAt: TS,
            status: "posted",
          },
        ],
        conversion: {
          currency: "CAD",
          asOf: "2026-07-09T00:00:00.000Z",
          providers: ["Frankfurter / ECB", "Manual override"],
          stale: true,
        },
      }) as never,
    );

    const returned = await fetchFinanceDashboard("CAD");

    expect(actionMock).toHaveBeenCalledWith(
      convexApi.financeDashboard.dashboard,
      { currency: "CAD" },
    );
    expect(returned.byCurrency.map((group) => group.currency)).toEqual([
      "CAD",
      "USD",
    ]);
    expect(
      returned.byCurrency
        .find((group) => group.currency === "USD")
        ?.accounts.map((account) => account.id),
    ).toEqual(["acct-usd"]);
    expect(returned.conversion).toEqual({
      currency: "CAD",
      asOf: "2026-07-09T00:00:00.000Z",
      providers: ["Frankfurter / ECB", "Manual override"],
      stale: true,
    });
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
        ],
      }),
    );

    expect(
      adapted.accounts.map(({ id, balance, source, status }) => ({
        id,
        balance,
        source,
        status,
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
    actionMock.mockResolvedValueOnce(
      convexDashboard({
        accounts: [
          convexAccount({
            _id: "acct-ws",
            source: "snaptrade",
            sourceId: "snap-account-1",
            sourceVariant: "wealthsimple",
            name: "Wealthsimple RRSP",
            type: "investment",
            balance: "15250.75",
            institution: "Wealthsimple",
            mask: "9012",
            status: "open",
          }),
        ],
        categories: [
          {
            _id: "cat-dividend",
            name: "dividend",
            group: "income",
            excludeFromSpending: false,
            color: null,
          },
        ],
        transactions: [
          {
            _id: "txn-dividend",
            accountId: "acct-ws",
            source: "snaptrade",
            sourceVariant: "wealthsimple",
            description: "Cash dividend",
            amount: "12.34",
            currency: "CAD",
            postedAt: "2026-07-07T00:00:00.000Z",
            categoryId: "cat-dividend",
            status: "posted",
          },
        ],
        positions: [
          {
            _id: "pos-shop",
            accountId: "acct-ws",
            source: "snaptrade",
            sourceVariant: "wealthsimple",
            symbol: "SHOP",
            name: "Shopify",
            quantity: "3",
            marketValue: "435.12",
            averageCost: "102.5",
            currency: "CAD",
            observedAt: TS,
            updatedAt: TS,
          },
        ],
        activities: [
          {
            _id: "act-buy",
            accountId: "acct-ws",
            source: "snaptrade",
            sourceVariant: "wealthsimple",
            type: "BUY",
            description: "Bought Shopify",
            amount: "-435.12",
            currency: "CAD",
            symbol: "SHOP",
            quantity: "3",
            price: "145.04",
            occurredAt: "2026-07-06T15:30:00.000Z",
            settledAt: "2026-07-08T00:00:00.000Z",
            status: "settled",
          },
        ],
        valueHistory: [
          {
            accountId: "acct-ws",
            date: "2026-07-06",
            equity: "15000",
            cash: "1250",
            currency: "CAD",
            source: "snaptrade",
          },
          {
            accountId: "acct-ws",
            date: "2026-07-07",
            equity: "15250.75",
            cash: "1262.34",
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
            returnPercent: "8.91",
            asOf: "2026-07-07",
            observedAt: TS,
            updatedAt: TS,
          },
        ],
      }) as never,
    );

    const returned = await fetchFinanceDashboard("CAD");
    const adapted = financeDataFromDashboard(returned);

    expect(returned.history).toEqual([
      {
        accountId: "acct-ws",
        date: "2026-07-06",
        equity: 15000,
        cash: 1250,
        currency: "CAD",
        source: "snaptrade",
      },
      {
        accountId: "acct-ws",
        date: "2026-07-07",
        equity: 15250.75,
        cash: 1262.34,
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
    expect(returned.activities).toHaveLength(1);
    expect(returned.activities[0]).toMatchObject({
      id: "act-buy",
      type: "BUY",
      amount: -435.12,
    });
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
        time: "2026-07-07T00:00:00.000Z",
        accountId: "acct-ws",
        categoryId: "cat-dividend",
        status: "posted",
        createdAt: "2026-07-07T00:00:00.000Z",
        updatedAt: "2026-07-07T00:00:00.000Z",
      },
    ]);
  });
});
