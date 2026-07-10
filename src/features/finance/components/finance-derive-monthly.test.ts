import { describe, expect, it } from "vitest";

import type { FinanceData } from "@/lib/life-intelligence/model";
import type { FinanceCategory, FinanceTransaction } from "./finance-derive";
import { monthlySeries } from "./finance-derive";

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

// The `months` window is the only knob callers have to trade a bounded chart for
// the full history; `null` must widen it without reordering or dropping buckets.
describe("monthlySeries month windowing", () => {
  // Eight distinct posted months so the six-bucket default actually truncates.
  const eightMonths = finance({
    categories: [category({ id: "food", name: "Food", group: "spending" })],
    transactions: [
      "2025-05-10",
      "2025-06-10",
      "2025-07-10",
      "2025-08-10",
      "2025-09-10",
      "2025-10-10",
      "2025-11-10",
      "2025-12-10",
    ].map((time, index) =>
      transaction({
        id: `m${index}`,
        currency: "USD",
        amount: (index + 1) * 100,
        time,
        categoryId: "food",
      }),
    ),
  });

  it("returns every available month oldest-first when months is null", () => {
    const all = monthlySeries(eightMonths, "USD", null);
    expect(all.map((point) => point.month)).toEqual([
      "2025-05",
      "2025-06",
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
    ]);
    // The oldest bucket carries its own posted income, not a neighbour's.
    expect(all[0]).toEqual({
      month: "2025-05",
      income: 100,
      spending: 0,
      net: 100,
    });
  });

  it("caps to the six most recent months by default, dropping the oldest", () => {
    // The two earliest months (May, June) that `null` surfaces are exactly the
    // ones the default window drops.
    expect(
      monthlySeries(eightMonths, "USD").map((point) => point.month),
    ).toEqual([
      "2025-07",
      "2025-08",
      "2025-09",
      "2025-10",
      "2025-11",
      "2025-12",
    ]);
  });
});
