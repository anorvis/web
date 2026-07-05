import type { Currency, FxRates } from "@/features/finance/types/finance";

export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rates: FxRates,
): number {
  if (from === to) return amount;
  return amount * (rates[from]?.[to] ?? 1);
}

export function formatAmount(amount: number, currency: Currency): string {
  if (currency === "BTC") return `₿${amount.toFixed(6)}`;
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export function formatAmountSigned(amount: number, currency: Currency): string {
  if (currency === "BTC") {
    const sign = amount >= 0 ? "+" : "";
    return `${sign}₿${Math.abs(amount).toFixed(6)}`;
  }
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${Math.abs(amount).toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export const DEFAULT_RATES: FxRates = {
  USD: { USD: 1, CAD: 1, BTC: 1 },
  CAD: { CAD: 1, USD: 1, BTC: 1 },
  BTC: { BTC: 1, USD: 1, CAD: 1 },
};
