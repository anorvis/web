import { describe, expect, it } from "vitest";

import type { FinanceData } from "@/lib/life-intelligence/model";
import type { FinanceCategory, FinanceTransaction } from "./finance-derive";
import { incomeByCategory } from "./finance-derive";

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

describe("incomeByCategory", () => {
  it("groups posted positive USD income by category, excluding pending, negative, transfer/investing, and other currencies", () => {
    const data = finance({
      categories: [
        category({ id: "salary", name: "Salary", group: "income" }),
        category({ id: "side", name: "Side gig", group: "income" }),
        category({ id: "xfer", name: "Transfer", group: "transfers" }),
        category({ id: "inv", name: "Investing", group: "investing" }),
      ],
      transactions: [
        transaction({
          id: "t1",
          currency: "USD",
          amount: 5000,
          categoryId: "salary",
          status: "posted",
        }),
        transaction({
          id: "t2",
          currency: "USD",
          amount: 1500,
          categoryId: "salary",
          status: "posted",
        }),
        // Undefined status is treated as posted and must count.
        transaction({
          id: "t3",
          currency: "USD",
          amount: 400,
          categoryId: "side",
        }),
        // Pending income is not realized yet -> excluded.
        transaction({
          id: "t4",
          currency: "USD",
          amount: 9999,
          categoryId: "salary",
          status: "pending",
        }),
        // Outflow is not income -> excluded.
        transaction({
          id: "t5",
          currency: "USD",
          amount: -200,
          categoryId: "salary",
        }),
        // Internal movement never inflates income.
        transaction({
          id: "t6",
          currency: "USD",
          amount: 800,
          categoryId: "xfer",
        }),
        transaction({
          id: "t7",
          currency: "USD",
          amount: 700,
          categoryId: "inv",
        }),
        // A different currency must never merge into the USD total.
        transaction({
          id: "t8",
          currency: "CAD",
          amount: 3000,
          categoryId: "salary",
        }),
      ],
    });

    const result = incomeByCategory(data, "USD");

    expect(result.map((row) => [row.id, row.total])).toEqual([
      ["salary", 6500],
      ["side", 400],
    ]);
    expect(result[0]).toEqual({
      id: "salary",
      label: "Salary",
      group: "income",
      currency: "USD",
      total: 6500,
    });
  });

  it("files uncategorized positive income under an income-group fallback bucket", () => {
    const data = finance({
      transactions: [
        transaction({
          id: "t1",
          currency: "USD",
          amount: 250,
          categoryId: undefined,
        }),
      ],
    });

    expect(incomeByCategory(data, "USD")).toEqual([
      {
        id: "uncategorized-income",
        label: "uncategorized",
        group: "income",
        currency: "USD",
        total: 250,
      },
    ]);
  });
});
