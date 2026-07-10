import type { Currency, FxRates } from "@/features/finance/types/finance";

export type ConvertedAmount =
  | { available: true; amount: number }
  | { available: false };

/**
 * Converts `amount` from one currency to another using `rates`.
 *
 * Identity conversions (from === to) are always available and returned exactly.
 * A cross-currency conversion is available only when `rates` supplies a finite,
 * positive rate for the pair; otherwise the result is `{ available: false }` so
 * callers never silently treat the input amount as if it were already in the
 * target currency.
 */
export function convertAmount(
  amount: number,
  from: Currency,
  to: Currency,
  rates: FxRates,
): ConvertedAmount {
  if (from === to) return { available: true, amount };
  const rate = rates[from]?.[to];
  if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
    return { available: false };
  }
  return { available: true, amount: amount * rate };
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

/**
 * Formats `amount` for display in `to`, converting from `from` when a rate is
 * available. When no cross-currency rate exists the ORIGINAL amount is shown in
 * its own currency with an explicit marker, so a missing rate never renders a
 * fabricated total in the target currency.
 */
export function formatConverted(
  amount: number,
  from: Currency,
  to: Currency,
  rates: FxRates,
  format: (value: number, currency: Currency) => string = formatAmount,
): string {
  const result = convertAmount(amount, from, to, rates);
  if (result.available) return format(result.amount, to);
  return `${format(amount, from)} (no ${to} rate)`;
}
