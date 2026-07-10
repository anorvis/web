import { describe, expect, it } from "vitest";

import type { FinanceActivityRecord } from "@/features/finance/api/finance";
import type {
  Account,
  Category,
  FinanceData,
  Transaction,
} from "@/lib/life-intelligence/model";
import {
  ACTIVITY_FEED_PAGE_SIZE,
  filterFinanceActivityFeed,
  financeActivityFeed,
} from "./finance-activity-feed";

const TS = "2026-07-10T12:00:00.000Z";
const USD_NBSP = "USD\u00A0";

function account(overrides: Partial<Account> = {}): Account {
  return {
    balance: 0,
    currency: "USD",
    id: "brokerage",
    name: "Brokerage",
    type: "investment",
    updatedAt: TS,
    ...overrides,
  };
}

function category(overrides: Partial<Category> = {}): Category {
  return {
    group: "spending",
    id: "spending",
    name: "Spending",
    ...overrides,
  };
}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    accountId: "checking",
    amount: -1,
    categoryId: "spending",
    createdAt: TS,
    currency: "USD",
    id: "tx",
    time: "2026-07-10",
    title: "Card purchase",
    updatedAt: TS,
    ...overrides,
  };
}

function finance(overrides: Partial<FinanceData> = {}): FinanceData {
  return {
    accounts: [
      account({
        id: "checking",
        name: "Checking",
        type: "checking",
      }),
      account(),
    ],
    categories: [
      category({ id: "income", name: "Income", group: "income" }),
      category(),
    ],
    positions: [],
    transactions: [],
    ...overrides,
  };
}

function activity(
  overrides: Partial<FinanceActivityRecord> = {},
): FinanceActivityRecord {
  return {
    accountId: "brokerage",
    amount: 1,
    currency: "USD",
    description: "Brokerage activity",
    id: "activity",
    occurredAt: "2026-07-10T12:00:00.000Z",
    price: null,
    quantity: null,
    settledAt: null,
    source: "snaptrade",
    sourceVariant: null,
    status: "settled",
    symbol: null,
    type: "spend",
    ...overrides,
  };
}

describe("financeActivityFeed", () => {
  it("merges canonical transactions with SnapTrade activity in newest-first order and exposes one overflow row beyond the page", () => {
    const feed = financeActivityFeed(
      finance({
        transactions: [
          transaction({
            amount: 1000,
            categoryId: "income",
            id: "paycheck",
            time: "2026-07-10",
            title: "Paycheck",
          }),
          transaction({
            amount: -42.42,
            id: "grocery-run",
            time: "2026-07-09",
            title: "Grocery run",
          }),
        ],
      }),
      [
        activity({
          description: "Brokerage debit",
          id: "brokerage-debit",
          occurredAt: "2026-07-08T12:00:00.000Z",
          type: "spend",
        }),
        activity({
          description: "Custody fee",
          id: "custody-fee",
          occurredAt: "2026-07-07T12:00:00.000Z",
          type: "fee",
        }),
        activity({
          description: "Quarterly dividend",
          id: "dividend",
          occurredAt: "2026-07-06T12:00:00.000Z",
          type: "dividend",
        }),
        activity({
          amount: null,
          description: null,
          id: "stock-split",
          occurredAt: "2026-07-05T12:00:00.000Z",
          quantity: 1.234,
          symbol: "VOO",
          type: "split",
        }),
        activity({
          description: "Old deposit",
          id: "old-deposit",
          occurredAt: "2026-07-04T12:00:00.000Z",
          type: "deposit",
        }),
        activity({
          description: "Interest credit",
          id: "interest-credit",
          occurredAt: "2026-07-03T12:00:00.000Z",
          type: "interest",
        }),
        activity({
          description: "Contribution",
          id: "contribution",
          occurredAt: "2026-07-02T12:00:00.000Z",
          type: "contribution",
        }),
        activity({
          description: "Very old withdrawal",
          id: "very-old-withdrawal",
          occurredAt: "2026-07-01T12:00:00.000Z",
          type: "withdrawal",
        }),
      ],
    );

    expect(ACTIVITY_FEED_PAGE_SIZE).toBe(9);
    expect(feed).toHaveLength(ACTIVITY_FEED_PAGE_SIZE + 1);
    expect(feed.map((item) => item.description)).toEqual([
      "Paycheck",
      "Grocery run",
      "Brokerage debit",
      "Custody fee",
      "Quarterly dividend",
      "VOO",
      "Old deposit",
      "Interest credit",
      "Contribution",
      "Very old withdrawal",
    ]);
    expect(feed.map((item) => item.type)).toEqual([
      "income",
      "spending",
      "spend",
      "fee",
      "dividend",
      "split",
      "deposit",
      "interest",
      "contribution",
      "withdrawal",
    ]);
    expect(feed[0].context).toContain("Checking");
    expect(feed[1].context).toContain("Checking");
    expect(feed[2].context).toContain("Brokerage");
    expect(feed[5].context).toContain("Brokerage");
    expect(feed.slice(0, ACTIVITY_FEED_PAGE_SIZE).at(-1)?.description).toBe(
      "Contribution",
    );
    expect(feed[ACTIVITY_FEED_PAGE_SIZE]?.description).toBe(
      "Very old withdrawal",
    );
  });

  it("formats visible money to two decimals and preserves fractional quantities without trailing zeros", () => {
    const feed = financeActivityFeed(
      finance({
        transactions: [
          transaction({
            amount: -42.426,
            id: "rounded-transaction",
            title: "Rounded transaction",
          }),
        ],
      }),
      [
        activity({
          amount: 1.239,
          description: "Rounded fee",
          id: "rounded-fee",
          type: "fee",
        }),
        activity({
          amount: null,
          description: null,
          id: "rounded-quantity",
          quantity: 1.234,
          symbol: "VOO",
          type: "split",
        }),
      ],
    );
    const valuesByDescription: Record<string, string> = Object.fromEntries(
      feed.map((item) => [item.description, item.value]),
    );

    expect(valuesByDescription["Rounded transaction"]).toBe(
      `-${USD_NBSP}42.43`,
    );
    expect(valuesByDescription["Rounded fee"]).toBe(`-${USD_NBSP}1.24`);
    expect(valuesByDescription.VOO).toBe("1.234 VOO");
  });

  it("normalizes every canonical SnapTrade inflow and outflow type before formatting", () => {
    const cases = [
      {
        type: "spend",
        amount: 12.3,
        value: `-${USD_NBSP}12.30`,
        tone: "text-red-300",
        badgeTone: "border-red-400/40 bg-red-400/10 text-red-300",
      },
      {
        type: "withdrawal",
        amount: -50,
        value: `-${USD_NBSP}50.00`,
        tone: "text-red-300",
        badgeTone: "border-red-400/40 bg-red-400/10 text-red-300",
      },
      {
        type: "fee",
        amount: 1.239,
        value: `-${USD_NBSP}1.24`,
        tone: "text-red-300",
        badgeTone: "border-red-400/40 bg-red-400/10 text-red-300",
      },
      {
        type: "contribution",
        amount: -100,
        value: `${USD_NBSP}100.00`,
        tone: "text-emerald-300",
        badgeTone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      },
      {
        type: "deposit",
        amount: 20,
        value: `${USD_NBSP}20.00`,
        tone: "text-emerald-300",
        badgeTone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      },
      {
        type: "dividend",
        amount: -2.345,
        value: `${USD_NBSP}2.35`,
        tone: "text-emerald-300",
        badgeTone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      },
      {
        type: "interest",
        amount: 0.1,
        value: `${USD_NBSP}0.10`,
        tone: "text-emerald-300",
        badgeTone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      },
    ];

    const feed = financeActivityFeed(
      finance(),
      cases.map(({ amount, type }) =>
        activity({
          amount,
          description: `${type} activity`,
          id: `${type}-activity`,
          type,
        }),
      ),
    );
    const itemsByDescription: Record<string, (typeof feed)[number]> =
      Object.fromEntries(feed.map((item) => [item.description, item]));

    for (const { badgeTone, tone, type, value } of cases) {
      expect(itemsByDescription[`${type} activity`]).toMatchObject({
        badgeTone,
        tone,
        value,
      });
    }
  });

  it("maps generic checking and savings SPEND activity to card cash movement without relabeling security-shaped rows", () => {
    const feed = financeActivityFeed(
      finance({
        accounts: [
          account({
            id: "checking",
            institution: "Local Bank",
            mask: "1234",
            name: "Everyday Checking",
            type: "checking",
          }),
          account({
            id: "savings",
            institution: "Local Bank",
            mask: "9876",
            name: "High Yield Savings",
            type: "savings",
          }),
          account(),
        ],
      }),
      [
        activity({
          accountId: "checking",
          amount: 12.34,
          description: "SPEND",
          id: "card-purchase",
          occurredAt: "2026-07-10T12:00:00.000Z",
          price: 0,
          quantity: 0,
          type: "SPEND",
        }),
        activity({
          accountId: "savings",
          amount: -4.56,
          description: "spend",
          id: "card-refund",
          occurredAt: "2026-07-09T12:00:00.000Z",
          price: 0,
          quantity: 0,
          type: "SPEND",
        }),
        activity({
          accountId: "checking",
          amount: 7.89,
          description: "Neighborhood pharmacy",
          id: "named-purchase",
          occurredAt: "2026-07-08T12:00:00.000Z",
          price: 0,
          quantity: 0,
          type: "SPEND",
        }),
        activity({
          accountId: "checking",
          amount: 100,
          description: "Treasury fill",
          id: "security-shaped",
          occurredAt: "2026-07-07T12:00:00.000Z",
          price: 50,
          quantity: 2,
          symbol: "CASH.TO",
          type: "SPEND",
        }),
      ],
    );
    const itemsById = Object.fromEntries(feed.map((item) => [item.id, item]));

    expect(itemsById["activity-card-purchase"]).toMatchObject({
      badgeTone: "border-red-400/40 bg-red-400/10 text-red-300",
      context: expect.stringContaining(
        "Everyday Checking · Local Bank · ••••1234",
      ),
      description: "Card purchase",
      direction: "outflow",
      tone: "text-red-300",
      type: "spend",
      value: `-${USD_NBSP}12.34`,
    });
    expect(itemsById["activity-card-refund"]).toMatchObject({
      badgeTone: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
      context: expect.stringContaining(
        "High Yield Savings · Local Bank · ••••9876",
      ),
      description: "Card refund",
      direction: "inflow",
      tone: "text-emerald-300",
      type: "refund",
      value: `${USD_NBSP}4.56`,
    });
    expect(itemsById["activity-named-purchase"]).toMatchObject({
      context: expect.stringContaining(
        "Everyday Checking · Local Bank · ••••1234",
      ),
      description: "Neighborhood pharmacy",
      direction: "outflow",
      type: "spend",
      value: `-${USD_NBSP}7.89`,
    });
    expect(itemsById["activity-security-shaped"]).toMatchObject({
      description: "Treasury fill",
      direction: "outflow",
      kind: "money",
      type: "spend",
      value: `-${USD_NBSP}100.00`,
    });
  });

  it("formats stock trades as cash impacts while keeping buy and sell badges distinct", () => {
    const feed = financeActivityFeed(finance(), [
      activity({
        amount: 435.12,
        description: "Market buy",
        id: "buy-shop",
        price: 124.32,
        quantity: 3.5,
        symbol: "SHOP",
        type: "BUY",
      }),
      activity({
        amount: -290.08,
        description: "Market sell",
        id: "sell-voo",
        occurredAt: "2026-07-09T12:00:00.000Z",
        price: 128.92,
        quantity: 2.25,
        symbol: "VOO",
        type: "SELL",
      }),
    ]);

    expect(feed).toEqual([
      expect.objectContaining({
        badgeTone: "border-blue-400/40 bg-blue-400/10 text-blue-300",
        description: `SHOP · 3.5 shares @ ${USD_NBSP}124.32`,
        direction: "outflow",
        kind: "stock",
        tone: "text-red-300",
        type: "stock buy",
        value: `-${USD_NBSP}435.12`,
      }),
      expect.objectContaining({
        badgeTone: "border-amber-400/40 bg-amber-400/10 text-amber-300",
        description: `VOO · 2.25 shares @ ${USD_NBSP}128.92`,
        direction: "inflow",
        kind: "stock",
        tone: "text-emerald-300",
        type: "stock sell",
        value: `+${USD_NBSP}290.08`,
      }),
    ]);
  });

  it("normalizes staking reward variants to staking type and description labels", () => {
    const feed = financeActivityFeed(finance(), [
      activity({
        amount: 1.23,
        description: "STAKING_REWARD",
        id: "staking-underscore",
        occurredAt: "2026-07-10T12:00:00.000Z",
        symbol: "ETH",
        type: "STAKING_REWARD",
      }),
      activity({
        amount: 2.34,
        description: "staking-reward",
        id: "staking-hyphen",
        occurredAt: "2026-07-09T12:00:00.000Z",
        type: "staking-reward",
      }),
      activity({
        amount: 3.45,
        description: "staking reward",
        id: "staking-spaced",
        occurredAt: "2026-07-08T12:00:00.000Z",
        type: "staking reward",
      }),
    ]);

    expect(
      Object.fromEntries(
        feed.map((item) => [
          item.id,
          { description: item.description, type: item.type },
        ]),
      ),
    ).toEqual({
      "activity-staking-underscore": {
        description: "ETH · staking",
        type: "staking",
      },
      "activity-staking-hyphen": {
        description: "staking",
        type: "staking",
      },
      "activity-staking-spaced": {
        description: "staking",
        type: "staking",
      },
    });
  });

  it("filters the pure activity feed by query, cash direction, and stock kind", () => {
    const feed = financeActivityFeed(
      finance({
        transactions: [
          transaction({
            amount: 1000,
            categoryId: "income",
            id: "paycheck",
            time: "2026-07-12",
            title: "Paycheck",
          }),
          transaction({
            amount: -12.34,
            id: "coffee",
            time: "2026-07-11",
            title: "Coffee shop",
          }),
        ],
      }),
      [
        activity({
          amount: 100,
          description: "Market buy",
          id: "buy-shop",
          occurredAt: "2026-07-10T12:00:00.000Z",
          price: 66.67,
          quantity: 1.5,
          symbol: "SHOP",
          type: "BUY",
        }),
        activity({
          amount: 80,
          description: "Market sell",
          id: "sell-voo",
          occurredAt: "2026-07-09T12:00:00.000Z",
          price: 40,
          quantity: 2,
          symbol: "VOO",
          type: "SELL",
        }),
        activity({
          amount: 4.56,
          description: "Staking payout",
          id: "staking-reward",
          occurredAt: "2026-07-08T12:00:00.000Z",
          type: "staking_reward",
        }),
      ],
    );

    const cases = [
      {
        name: "query matches descriptions when all directions are allowed",
        query: "coffee",
        filter: "all",
        expected: ["transaction-coffee"],
      },
      {
        name: "spending includes outflow transactions and stock buys",
        query: "",
        filter: "spending",
        expected: ["transaction-coffee", "activity-buy-shop"],
      },
      {
        name: "income includes inflow transactions, stock sells, and positive staking rewards",
        query: "",
        filter: "income",
        expected: [
          "transaction-paycheck",
          "activity-sell-voo",
          "activity-staking-reward",
        ],
      },
      {
        name: "stocks include stock buys and sells but exclude money activity",
        query: "",
        filter: "stocks",
        expected: ["activity-buy-shop", "activity-sell-voo"],
      },
      {
        name: "query composes with the stock-only filter",
        query: "voo",
        filter: "stocks",
        expected: ["activity-sell-voo"],
      },
    ] as const;

    for (const { expected, filter, name, query } of cases) {
      expect(
        filterFinanceActivityFeed(feed, query, filter).map((item) => item.id),
        name,
      ).toEqual(expected);
    }
  });
});
