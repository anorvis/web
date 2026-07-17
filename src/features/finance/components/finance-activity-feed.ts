import type { FinanceActivityRecord } from "@/features/finance/api/finance";
import {
  formatCurrencyAmount,
  formatTransactionDate,
} from "@/features/finance/components/finance-derive";
import type { FinanceData } from "@/lib/life-intelligence/model";

export const ACTIVITY_FEED_PAGE_SIZE = 9;

const quantityFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 6,
});
const outflowTypes = new Set(["fee", "spend", "withdrawal"]);
const inflowTypes = new Set([
  "contribution",
  "deposit",
  "dividend",
  "interest",
]);

export type ActivityFeedFilter = "all" | "income" | "spending" | "stocks";

export type ActivityFeedItem = {
  id: string;
  time: string;
  type: string;
  description: string;
  context: string;
  value: string;
  tone?: string;
  badgeTone?: string;
  direction: "inflow" | "outflow" | "neutral";
  kind: "money" | "stock";
};

export function financeActivityFeed(
  finance: FinanceData,
  activities: FinanceActivityRecord[],
): ActivityFeedItem[] {
  const accountsById = new Map(
    finance.accounts.map((account) => [account.id, account]),
  );
  const categoriesById = new Map(
    finance.categories.map((category) => [category.id, category]),
  );
  const activityFingerprints = new Set(
    activities
      .map((activity) => activity.fingerprint)
      .filter((fingerprint): fingerprint is string => Boolean(fingerprint)),
  );
  const accountContext = (accountId: string | undefined, fallback: string) => {
    const account = accountId ? accountsById.get(accountId) : undefined;
    if (!account) return fallback;
    const details = [
      account.name,
      account.institution,
      account.mask ? `••••${account.mask}` : null,
    ].filter(Boolean);
    return details.join(" · ");
  };
  const transactions: ActivityFeedItem[] = finance.transactions
    .filter(
      (transaction) =>
        !transaction.fingerprint ||
        !activityFingerprints.has(transaction.fingerprint),
    )
    .map((transaction) => {
      const category = transaction.categoryId
        ? categoriesById.get(transaction.categoryId)
        : undefined;
      const account = accountContext(transaction.accountId, "unassigned");
      const type =
        category?.group ?? (transaction.amount < 0 ? "spend" : "income");
      return {
        id: `transaction-${transaction.id}`,
        time: transaction.time ?? "",
        type,
        description: transaction.title,
        context: `${formatTransactionDate(transaction.time)} · ${account}`,
        value: formatCurrencyAmount(transaction.amount, transaction.currency),
        tone: transaction.amount < 0 ? "text-red-300" : "text-emerald-300",
        badgeTone: badgeTone(type),
        direction: transaction.amount < 0 ? "outflow" : "inflow",
        kind: "money",
      };
    });
  const providerActivities: ActivityFeedItem[] = activities.map((activity) => {
    const account = accountContext(
      activity.accountId ?? undefined,
      "investment account",
    );
    const activityAccount = activity.accountId
      ? accountsById.get(activity.accountId)
      : undefined;
    const normalizedType = activity.type.toLowerCase().replace(/[_-]+/g, " ");
    const rawType =
      normalizedType === "staking reward" ? "staking" : normalizedType;
    const isStaking = rawType === "staking";
    const isStockTrade =
      Boolean(activity.symbol) && (rawType === "buy" || rawType === "sell");
    const type = isStockTrade ? `stock ${rawType}` : rawType;
    const isCardSpend =
      rawType === "spend" &&
      (activityAccount?.type === "checking" ||
        activityAccount?.type === "savings") &&
      !activity.symbol &&
      (activity.quantity === null || activity.quantity === 0) &&
      (activity.price === null || activity.price === 0);
    const cardSpendDescription =
      activity.description && activity.description.toLowerCase() !== "spend"
        ? activity.description
        : activity.amount !== null && activity.amount < 0
          ? "Card refund"
          : "Card purchase";
    const contextParts = [
      formatTransactionDate(activity.occurredAt),
      account,
      activity.settledAt && activity.settledAt !== activity.occurredAt
        ? `settled ${formatTransactionDate(activity.settledAt)}`
        : null,
    ].filter(Boolean);
    const displayAmount =
      isCardSpend && activity.amount !== null
        ? activity.amount < 0
          ? Math.abs(activity.amount)
          : -Math.abs(activity.amount)
        : normalizedActivityAmount(rawType, activity.amount);
    const tradeAmount = isStockTrade
      ? (activity.amount ??
        (activity.quantity !== null && activity.price !== null
          ? activity.quantity * activity.price
          : null))
      : null;
    const cashImpact =
      tradeAmount === null
        ? null
        : rawType === "buy"
          ? -Math.abs(tradeAmount)
          : Math.abs(tradeAmount);
    return {
      id: `activity-${activity.id}`,
      time: activity.occurredAt,
      type: isCardSpend
        ? activity.amount !== null && activity.amount < 0
          ? "refund"
          : "spend"
        : type,
      description: isCardSpend
        ? cardSpendDescription
        : isStockTrade && activity.symbol
          ? `${activity.symbol} · ${activity.quantity === null ? "—" : quantityFormatter.format(Math.abs(activity.quantity))} shares @ ${activity.price === null ? "—" : formatCurrencyAmount(activity.price, activity.currency)}`
          : isStaking
            ? activity.symbol
              ? `${activity.symbol} · staking`
              : "staking"
            : (activity.description ?? activity.symbol ?? activity.type),
      context: contextParts.join(" · "),
      value:
        cashImpact !== null
          ? signedCurrencyAmount(cashImpact, activity.currency)
          : displayAmount !== null
            ? formatCurrencyAmount(displayAmount, activity.currency)
            : activity.quantity !== null && activity.symbol
              ? `${quantityFormatter.format(activity.quantity)} ${activity.symbol}`
              : "—",
      tone: isStockTrade
        ? rawType === "buy"
          ? "text-red-300"
          : "text-emerald-300"
        : displayAmount !== null && displayAmount < 0
          ? "text-red-300"
          : displayAmount !== null
            ? "text-emerald-300"
            : undefined,
      badgeTone: badgeTone(
        isCardSpend && activity.amount !== null && activity.amount < 0
          ? "income"
          : type,
      ),
      direction:
        cashImpact !== null
          ? cashImpact < 0
            ? "outflow"
            : "inflow"
          : displayAmount === null
            ? "neutral"
            : displayAmount < 0
              ? "outflow"
              : "inflow",
      kind: isStockTrade ? "stock" : "money",
    };
  });
  return [...transactions, ...providerActivities].sort((left, right) =>
    right.time.localeCompare(left.time),
  );
}

export function filterFinanceActivityFeed(
  items: ActivityFeedItem[],
  query: string,
  filter: ActivityFeedFilter,
): ActivityFeedItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    if (filter === "stocks" && item.kind !== "stock") return false;
    if (filter === "income" && item.direction !== "inflow") return false;
    if (filter === "spending" && item.direction !== "outflow") return false;
    if (!normalizedQuery) return true;
    return [item.type, item.description, item.context, item.value]
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
}

function signedCurrencyAmount(value: number, currency: string): string {
  const formatted = formatCurrencyAmount(Math.abs(value), currency);
  return `${value < 0 ? "-" : "+"}${formatted}`;
}

function badgeTone(type: string): string | undefined {
  if (
    type === "spend" ||
    type === "spending" ||
    type === "fee" ||
    type === "withdrawal"
  ) {
    return "border-red-400/40 bg-red-400/10 text-red-300";
  }
  if (
    type === "income" ||
    type === "contribution" ||
    type === "deposit" ||
    type === "dividend" ||
    type === "interest"
  ) {
    return "border-emerald-400/40 bg-emerald-400/10 text-emerald-300";
  }
  if (type === "stock buy" || type === "investing") {
    return "border-blue-400/40 bg-blue-400/10 text-blue-300";
  }
  if (type === "stock sell" || type === "debt") {
    return "border-amber-400/40 bg-amber-400/10 text-amber-300";
  }
  if (type === "split" || type === "transfers") {
    return "border-violet-400/40 bg-violet-400/10 text-violet-300";
  }
  return undefined;
}

function normalizedActivityAmount(
  type: string,
  amount: number | null,
): number | null {
  if (amount === null) return null;
  if (outflowTypes.has(type)) return -Math.abs(amount);
  if (inflowTypes.has(type)) return Math.abs(amount);
  return amount;
}
