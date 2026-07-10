import { describe, expect, it } from "vitest";

import { financeFromImportedTransactions } from "@/lib/life-intelligence/adapters";
import type { FinanceData } from "@/lib/life-intelligence/model";
import type {
  FinanceAccount,
  FinanceCategory,
  FinanceTransaction,
} from "./finance-derive";
import {
  balanceBreakdown,
  cashflow,
  monthlySeries,
  netWorthSeries,
  spendingByCategory,
} from "./finance-derive";

// --- Fixtures ---

const TS = "2026-01-01T00:00:00.000Z";

function account(overrides: Partial<FinanceAccount> = {}): FinanceAccount {
  return {
    id: "acct",
    name: "Account",
    type: "checking",
    currency: "USD",
    balance: 0,
    updatedAt: TS,
    ...overrides,
  };
}

function category(overrides: Partial<FinanceCategory> = {}): FinanceCategory {
  return {
    id: "cat",
    name: "Category",
    group: "spending",
    ...overrides,
  };
}

function transaction(
  overrides: Partial<FinanceTransaction> = {},
): FinanceTransaction {
  return {
    id: "tx",
    title: "Txn",
    amount: 0,
    currency: "USD",
    time: "2026-01-15",
    createdAt: TS,
    updatedAt: TS,
    ...overrides,
  };
}

function finance(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    accounts: [],
    categories: [],
    transactions: [],
    positions: [],
    ...overrides,
  };
}

// The imported-transaction shape mirrors the private type in adapters.ts; typing
// the factory keeps `originalCurrency` narrowed to the accepted union.
type ImportedTx = {
  id: string;
  importFingerprint?: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
  originalCurrency: "CAD" | "USD" | "BTC";
};

function importedTx(overrides: Partial<ImportedTx> = {}): ImportedTx {
  return {
    id: "imp",
    date: "2026-01-15",
    description: "row",
    amount: -10,
    category: "groceries",
    account: "Checking",
    originalCurrency: "USD",
    ...overrides,
  };
}

describe("balanceBreakdown", () => {
  it("tracks each currency independently and never sums across currencies", () => {
    const data = finance({
      accounts: [
        account({ id: "a1", currency: "USD", balance: 1000 }),
        account({ id: "a2", currency: "CAD", balance: 2000 }),
      ],
    });

    const { assets, net, currencies } = balanceBreakdown(data);

    expect(assets.get("USD")).toBe(1000);
    expect(assets.get("CAD")).toBe(2000);
    expect(assets.size).toBe(2);
    // Per-currency net, with no merged/converted grand total.
    expect(net.get("USD")).toBe(1000);
    expect(net.get("CAD")).toBe(2000);
    expect(currencies).toEqual(["CAD", "USD"]);
  });

  it("subtracts liability balances as magnitudes within their own currency", () => {
    const data = finance({
      accounts: [
        account({
          id: "chk",
          type: "checking",
          currency: "USD",
          balance: 5000,
        }),
        // Credit balances are commonly stored negative; the magnitude is what
        // reduces net worth.
        account({ id: "cc", type: "credit", currency: "USD", balance: -1200 }),
        account({ id: "ln", type: "loan", currency: "USD", balance: 800 }),
      ],
    });

    const { assets, liabilities, net } = balanceBreakdown(data);

    expect(assets.get("USD")).toBe(5000);
    expect(liabilities.get("USD")).toBe(2000); // |−1200| + |800|
    expect(net.get("USD")).toBe(3000); // 5000 − 2000
  });

  it("keeps liabilities of different currencies separate", () => {
    const data = finance({
      accounts: [
        account({ id: "usd", type: "credit", currency: "USD", balance: -300 }),
        account({ id: "cad", type: "loan", currency: "CAD", balance: -700 }),
      ],
    });

    const { liabilities, net } = balanceBreakdown(data);

    expect(liabilities.get("USD")).toBe(300);
    expect(liabilities.get("CAD")).toBe(700);
    expect(net.get("USD")).toBe(-300);
    expect(net.get("CAD")).toBe(-700);
  });

  it("excludes accounts with an unknown balance but keeps explicit zero balances", () => {
    const data = finance({
      accounts: [
        account({ id: "known", currency: "USD", balance: 0 }),
        account({ id: "unknownUsd", currency: "USD", balance: undefined }),
        account({ id: "unknownCad", currency: "CAD", balance: undefined }),
      ],
    });

    const { assets, currencies } = balanceBreakdown(data);

    expect(assets.get("USD")).toBe(0); // zero is a known balance, not unknown
    // A currency present only via unknown-balance accounts never appears.
    expect(assets.has("CAD")).toBe(false);
    expect(currencies).toEqual(["USD"]);
  });
});

describe("netWorthSeries", () => {
  it("keeps a one-point backend-signed net worth value instead of substituting equity", () => {
    expect(
      netWorthSeries([
        {
          date: "2026-07-10",
          equity: 999,
          netWorth: -123.45,
        },
      ]),
    ).toEqual([
      {
        label: "07-10",
        netWorth: -123.45,
        equity: -123.45,
      },
    ]);
  });
});

describe("cashflow", () => {
  it("separates income and spending per currency without merging currencies", () => {
    const data = finance({
      categories: [category({ id: "food", name: "Food", group: "spending" })],
      transactions: [
        transaction({
          id: "t1",
          currency: "USD",
          amount: 3000,
          categoryId: "food",
        }),
        transaction({
          id: "t2",
          currency: "USD",
          amount: -200,
          categoryId: "food",
        }),
        transaction({
          id: "t3",
          currency: "CAD",
          amount: -50,
          categoryId: "food",
        }),
      ],
    });

    const { income, spending, net } = cashflow(data);

    expect(income.get("USD")).toBe(3000);
    expect(income.has("CAD")).toBe(false);
    expect(spending.get("USD")).toBe(200);
    expect(spending.get("CAD")).toBe(50);
    expect(net.get("USD")).toBe(2800);
    expect(net.get("CAD")).toBe(-50);
  });

  it("excludes transfer and investing money movement from both sides", () => {
    const data = finance({
      categories: [
        category({ id: "xfer", name: "Transfer", group: "transfers" }),
        category({ id: "inv", name: "Investing", group: "investing" }),
        category({
          id: "flagged",
          name: "Anything",
          group: "spending",
          excludeFromSpending: true,
        }),
        // Name-based fallback: canonical Plaid names slip through when the CSV
        // adapter files everything under the "spending" group.
        category({ id: "named", name: "internal transfer", group: "spending" }),
      ],
      transactions: [
        transaction({
          id: "t1",
          currency: "USD",
          amount: 900,
          categoryId: "inv",
        }),
        transaction({
          id: "t2",
          currency: "USD",
          amount: -500,
          categoryId: "xfer",
        }),
        transaction({
          id: "t3",
          currency: "USD",
          amount: -100,
          categoryId: "flagged",
        }),
        transaction({
          id: "t4",
          currency: "USD",
          amount: -70,
          categoryId: "named",
        }),
      ],
    });

    const { income, spending } = cashflow(data);

    expect(income.size).toBe(0);
    expect(spending.size).toBe(0);
  });

  it("counts debt-group outflows as spending (debt is not an internal transfer)", () => {
    const data = finance({
      categories: [
        category({ id: "debt", name: "loan payment", group: "debt" }),
      ],
      transactions: [
        transaction({
          id: "t1",
          currency: "USD",
          amount: -450,
          categoryId: "debt",
        }),
      ],
    });

    const { spending, net } = cashflow(data);

    expect(spending.get("USD")).toBe(450);
    expect(net.get("USD")).toBe(-450);
  });

  it("counts a promoted canonical card spend once in cashflow and category spending", () => {
    const data = finance({
      categories: [
        category({ id: "card-spend", name: "card spend", group: "spending" }),
      ],
      transactions: [
        transaction({
          id: "snaptrade-spend",
          currency: "CAD",
          amount: -42.5,
          categoryId: "card-spend",
        }),
      ],
      positions: [
        {
          id: "shop-position",
          accountId: "brokerage",
          symbol: "SHOP",
          name: "Shopify",
          quantity: 3,
          marketValue: 435.12,
          averageCost: 102.5,
          currency: "CAD",
          updatedAt: TS,
        },
      ],
    });

    const { income, spending, net } = cashflow(data);

    expect(income.has("CAD")).toBe(false);
    expect(spending.get("CAD")).toBe(42.5);
    expect(net.get("CAD")).toBe(-42.5);
    expect(spendingByCategory(data, "CAD")).toEqual([
      {
        id: "card-spend",
        label: "card spend",
        group: "spending",
        currency: "CAD",
        total: 42.5,
      },
    ]);
  });
});

describe("spendingByCategory", () => {
  it("groups outflows for one currency, ignoring income and other currencies, highest first", () => {
    const data = finance({
      categories: [
        category({ id: "food", name: "Food", group: "spending" }),
        category({ id: "rent", name: "Rent", group: "spending" }),
      ],
      transactions: [
        transaction({
          id: "t1",
          currency: "USD",
          amount: -100,
          categoryId: "food",
        }),
        transaction({
          id: "t2",
          currency: "USD",
          amount: -40,
          categoryId: "food",
        }),
        transaction({
          id: "t3",
          currency: "USD",
          amount: -900,
          categoryId: "rent",
        }),
        transaction({
          id: "t4",
          currency: "USD",
          amount: 500,
          categoryId: "food",
        }),
        transaction({
          id: "t5",
          currency: "CAD",
          amount: -300,
          categoryId: "food",
        }),
      ],
    });

    const result = spendingByCategory(data, "USD");

    expect(result.map((row) => [row.id, row.total])).toEqual([
      ["rent", 900],
      ["food", 140],
    ]);
  });

  it("excludes transfers and falls back to 'uncategorized' with the 'other' group", () => {
    const data = finance({
      categories: [
        category({ id: "xfer", name: "Transfer", group: "transfers" }),
        category({ id: "food", name: "Food", group: "spending" }),
      ],
      transactions: [
        transaction({
          id: "t1",
          currency: "USD",
          amount: -500,
          categoryId: "xfer",
        }),
        transaction({
          id: "t2",
          currency: "USD",
          amount: -60,
          categoryId: "food",
        }),
        transaction({
          id: "t3",
          currency: "USD",
          amount: -25,
          categoryId: undefined,
        }),
      ],
    });

    const result = spendingByCategory(data, "USD");

    expect(result.find((row) => row.id === "xfer")).toBeUndefined();
    expect(result.find((row) => row.id === "uncategorized")).toMatchObject({
      label: "uncategorized",
      group: "other",
      total: 25,
    });
  });

  it("surfaces debt-group spending as its own category with the debt group", () => {
    const data = finance({
      categories: [
        category({ id: "debt", name: "loan payment", group: "debt" }),
      ],
      transactions: [
        transaction({
          id: "t1",
          currency: "USD",
          amount: -450,
          categoryId: "debt",
        }),
      ],
    });

    expect(spendingByCategory(data, "USD")).toEqual([
      {
        id: "debt",
        label: "loan payment",
        group: "debt",
        currency: "USD",
        total: 450,
      },
    ]);
  });
});

// Posted-only metric policy: money math (cashflow, category spending, monthly
// series) counts only settled activity. Pending rows may still list elsewhere,
// but each derivation must skip status === "pending" while keeping "posted" and
// legacy undefined-status records. Pending amounts here are deliberately large
// and distinct so any leak moves a total.
describe("posted-only metric policy (excludes pending)", () => {
  it("cashflow ignores pending income and pending outflows, keeping posted and undefined-status", () => {
    const data = finance({
      categories: [category({ id: "food", name: "Food", group: "spending" })],
      transactions: [
        transaction({
          id: "posted-in",
          currency: "USD",
          amount: 1000,
          categoryId: "food",
          status: "posted",
        }),
        transaction({
          id: "legacy-in",
          currency: "USD",
          amount: 200,
          categoryId: "food",
        }),
        transaction({
          id: "posted-out",
          currency: "USD",
          amount: -300,
          categoryId: "food",
          status: "posted",
        }),
        transaction({
          id: "legacy-out",
          currency: "USD",
          amount: -50,
          categoryId: "food",
        }),
        transaction({
          id: "pending-in",
          currency: "USD",
          amount: 5000,
          categoryId: "food",
          status: "pending",
        }),
        transaction({
          id: "pending-out",
          currency: "USD",
          amount: -9000,
          categoryId: "food",
          status: "pending",
        }),
      ],
    });

    const { income, spending, net } = cashflow(data);

    // 1000 posted + 200 undefined; pending 5000 dropped.
    expect(income.get("USD")).toBe(1200);
    // 300 posted + 50 undefined; pending 9000 dropped.
    expect(spending.get("USD")).toBe(350);
    expect(net.get("USD")).toBe(850);
  });

  it("spendingByCategory drops pending outflows and never surfaces a pending-only category", () => {
    const data = finance({
      categories: [
        category({ id: "food", name: "Food", group: "spending" }),
        category({ id: "rent", name: "Rent", group: "spending" }),
      ],
      transactions: [
        transaction({
          id: "posted",
          currency: "USD",
          amount: -100,
          categoryId: "food",
          status: "posted",
        }),
        transaction({
          id: "legacy",
          currency: "USD",
          amount: -40,
          categoryId: "food",
        }),
        transaction({
          id: "pending-food",
          currency: "USD",
          amount: -900,
          categoryId: "food",
          status: "pending",
        }),
        // Rent has only pending spend, so it must not produce a row at all.
        transaction({
          id: "pending-rent",
          currency: "USD",
          amount: -700,
          categoryId: "rent",
          status: "pending",
        }),
      ],
    });

    // 100 posted + 40 undefined for food; pending 900 dropped and rent absent.
    expect(
      spendingByCategory(data, "USD").map((row) => [row.id, row.total]),
    ).toEqual([["food", 140]]);
  });

  it("monthlySeries excludes pending activity from both amounts and the bucket count", () => {
    const data = finance({
      categories: [category({ id: "food", name: "Food", group: "spending" })],
      transactions: [
        transaction({
          id: "posted-in",
          currency: "USD",
          amount: 1000,
          categoryId: "food",
          time: "2026-01-10",
          status: "posted",
        }),
        transaction({
          id: "legacy-out",
          currency: "USD",
          amount: -50,
          categoryId: "food",
          time: "2026-01-20",
        }),
        // Same-month pending income would inflate the January bucket if counted.
        transaction({
          id: "pending-in",
          currency: "USD",
          amount: 5000,
          categoryId: "food",
          time: "2026-01-15",
          status: "pending",
        }),
        // Later-month pending outflow would spawn a second bucket if counted.
        transaction({
          id: "pending-out",
          currency: "USD",
          amount: -800,
          categoryId: "food",
          time: "2026-02-05",
          status: "pending",
        }),
      ],
    });

    expect(monthlySeries(data, "USD")).toEqual([
      { month: "2026-01", income: 1000, spending: 50, net: 950 },
    ]);
  });
});

// CSV-to-canonical category semantics: imported category names map to canonical
// groups, and that mapping must survive into the read-only derive layer.
describe("financeFromImportedTransactions category groups", () => {
  it("maps imported category names to canonical groups and exclusion flags", () => {
    const data = financeFromImportedTransactions(
      [
        importedTx({ id: "a", category: "income", amount: 3000 }),
        importedTx({ id: "b", category: "transfer", amount: -500 }),
        importedTx({ id: "c", category: "loan payment", amount: -450 }),
        importedTx({ id: "d", category: "groceries", amount: -60 }),
      ],
      null,
    );

    const find = (id: string) => data.categories.find((cat) => cat.id === id);

    expect(find("csv-income")).toMatchObject({
      name: "income",
      group: "income",
      excludeFromSpending: false,
    });
    expect(find("csv-transfer")).toMatchObject({
      name: "transfer",
      group: "transfers",
      excludeFromSpending: true,
    });
    expect(find("csv-loan-payment")).toMatchObject({
      name: "loan payment",
      group: "debt",
      excludeFromSpending: false,
    });
    expect(find("csv-groceries")).toMatchObject({
      name: "groceries",
      group: "spending",
      excludeFromSpending: false,
    });
  });

  it("flows imported groups through the derive layer: transfer excluded, income kept, loan payment counted as debt", () => {
    const data = financeFromImportedTransactions(
      [
        importedTx({ id: "a", category: "income", amount: 3000 }),
        importedTx({ id: "b", category: "transfer", amount: -500 }),
        importedTx({ id: "c", category: "loan payment", amount: -450 }),
        importedTx({ id: "d", category: "groceries", amount: -60 }),
      ],
      null,
    );

    const { income, spending } = cashflow(data);
    expect(income.get("USD")).toBe(3000);
    // transfer (500) excluded; loan payment (450) + groceries (60) counted.
    expect(spending.get("USD")).toBe(510);

    const byCategory = spendingByCategory(data, "USD");
    expect(byCategory.map((row) => [row.group, row.total])).toEqual([
      ["debt", 450],
      ["spending", 60],
    ]);
    expect(byCategory.find((row) => row.id === "csv-transfer")).toBeUndefined();
  });
});
