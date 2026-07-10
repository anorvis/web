import { describe, expect, it } from "vitest";

import type { FinanceData } from "@/lib/life-intelligence/model";
import type { FinanceAccount } from "./finance-derive";
import { balanceBreakdown, investmentValue } from "./finance-derive";

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

function finance(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    accounts: [],
    categories: [],
    transactions: [],
    positions: [],
    ...overrides,
  };
}

describe("hidden account exclusion", () => {
  it("excludes hidden accounts from net worth totals", () => {
    const data = finance({
      accounts: [
        account({ id: "visible", currency: "USD", balance: 1000 }),
        account({
          id: "hidden",
          currency: "USD",
          balance: 5000,
          status: "hidden",
        }),
      ],
    });

    const { assets, net } = balanceBreakdown(data);

    expect(assets.get("USD")).toBe(1000);
    expect(net.get("USD")).toBe(1000);
  });

  it("excludes positions held by hidden accounts from investment value", () => {
    const data = finance({
      accounts: [
        account({ id: "visible", type: "investment", status: "active" }),
        account({ id: "hidden", type: "investment", status: "hidden" }),
      ],
      positions: [
        {
          id: "pos-visible",
          accountId: "visible",
          symbol: "VTI",
          quantity: 1,
          marketValue: 100,
          currency: "USD",
          updatedAt: TS,
        },
        {
          id: "pos-hidden",
          accountId: "hidden",
          symbol: "HIDE",
          quantity: 1,
          marketValue: 900,
          currency: "USD",
          updatedAt: TS,
        },
      ],
    });

    expect(investmentValue(data).get("USD")).toBe(100);
  });
});
