import { describe, expect, it, vi } from "vitest";

import type { FinanceData } from "@/lib/life-intelligence/model";
import type { FinanceCategory, FinanceTransaction } from "./finance-derive";
import {
  cashflow,
  cashflowTransactions,
  currentMonthKey,
  incomeByCategory,
  spendingByCategory,
} from "./finance-derive";

// --- Fixtures ---

const TS = "2026-01-01T00:00:00.000Z";

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

describe("currentMonthKey", () => {
  it("returns the local calendar month as YYYY-MM", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2026, 6, 10, 12, 30));

      expect(currentMonthKey()).toBe("2026-07");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("month-scoped finance totals", () => {
  it("scopes cashflow, spending, and income category totals to one transaction month when requested", () => {
    const data = finance({
      categories: [
        category({ id: "salary", name: "Salary", group: "income" }),
        category({ id: "food", name: "Food", group: "spending" }),
        category({ id: "rent", name: "Rent", group: "spending" }),
      ],
      transactions: [
        transaction({
          id: "jan-income",
          amount: 100,
          categoryId: "salary",
          time: "2026-01-05",
        }),
        transaction({
          id: "jan-food",
          amount: -20,
          categoryId: "food",
          time: "2026-01-06",
        }),
        transaction({
          id: "feb-income",
          amount: 300,
          categoryId: "salary",
          time: "2026-02-05",
        }),
        transaction({
          id: "feb-rent",
          amount: -70,
          categoryId: "rent",
          time: "2026-02-01",
        }),
        transaction({
          id: "feb-food",
          amount: -30,
          categoryId: "food",
          time: "2026-02-06",
        }),
        transaction({
          id: "missing-time-income",
          amount: 999,
          categoryId: "salary",
          time: undefined,
        }),
        transaction({
          id: "invalid-time-food",
          amount: -888,
          categoryId: "food",
          time: "not-a-date",
        }),
      ],
    });

    const february = cashflow(data, "2026-02");

    expect(february.income.get("USD")).toBe(300);
    expect(february.spending.get("USD")).toBe(100);
    expect(february.net.get("USD")).toBe(200);
    expect(spendingByCategory(data, "USD", "2026-02")).toEqual([
      {
        id: "rent",
        label: "Rent",
        group: "spending",
        currency: "USD",
        total: 70,
      },
      {
        id: "food",
        label: "Food",
        group: "spending",
        currency: "USD",
        total: 30,
      },
    ]);
    expect(incomeByCategory(data, "USD", "2026-02")).toEqual([
      {
        id: "salary",
        label: "Salary",
        group: "income",
        currency: "USD",
        total: 300,
      },
    ]);

    const allTime = cashflow(data);

    expect(allTime.income.get("USD")).toBe(1399);
    expect(allTime.spending.get("USD")).toBe(1008);
    expect(allTime.net.get("USD")).toBe(391);
    expect(spendingByCategory(data, "USD")).toEqual([
      {
        id: "food",
        label: "Food",
        group: "spending",
        currency: "USD",
        total: 938,
      },
      {
        id: "rent",
        label: "Rent",
        group: "spending",
        currency: "USD",
        total: 70,
      },
    ]);
    expect(incomeByCategory(data, "USD")).toEqual([
      {
        id: "salary",
        label: "Salary",
        group: "income",
        currency: "USD",
        total: 1399,
      },
    ]);
  });
});

describe("cashflowTransactions", () => {
  it("drops pending rows while keeping posted and undefined-status cashflow rows newest-first", () => {
    const data = finance({
      categories: [
        category({ id: "spend", name: "Spending", group: "spending" }),
        category({ id: "transfer", name: "Transfer", group: "transfers" }),
      ],
      transactions: [
        transaction({
          id: "pending-card",
          amount: -999,
          categoryId: "spend",
          status: "pending",
          time: "2026-07-11",
        }),
        transaction({
          id: "posted-card",
          amount: -20,
          categoryId: "spend",
          status: "posted",
          time: "2026-07-10",
        }),
        transaction({
          id: "undefined-status-income",
          amount: 100,
          categoryId: "spend",
          time: "2026-07-09",
        }),
        transaction({
          id: "posted-transfer",
          amount: -50,
          categoryId: "transfer",
          status: "posted",
          time: "2026-07-12",
        }),
        transaction({
          id: "posted-cad",
          amount: -30,
          categoryId: "spend",
          currency: "CAD",
          status: "posted",
          time: "2026-07-13",
        }),
      ],
    });

    const result = cashflowTransactions(data, "USD");

    expect(result.map((transaction) => transaction.id)).toEqual([
      "posted-card",
      "undefined-status-income",
    ]);
    expect(result.map((transaction) => transaction.status)).toEqual([
      "posted",
      undefined,
    ]);
  });
});
