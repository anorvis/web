import { describe, expect, it } from "vitest";

import type { Currency, FxRates } from "@/features/finance/types/finance";
import { convertAmount, formatConverted } from "./currency";

// A deterministic formatter so assertions don't depend on the runner's `Intl`
// locale data — we only care about which currency/amount the converter chose.
const plain = (value: number, currency: Currency) => `${value} ${currency}`;

describe("convertAmount", () => {
  it("returns the identity amount exactly when from === to, even with no rates", () => {
    expect(convertAmount(123.45, "USD", "USD", {})).toEqual({
      available: true,
      amount: 123.45,
    });
    expect(convertAmount(-980.5, "CAD", "CAD", {})).toEqual({
      available: true,
      amount: -980.5,
    });
    expect(convertAmount(0.12345678, "BTC", "BTC", {})).toEqual({
      available: true,
      amount: 0.12345678,
    });
  });

  it("never applies a rate to an identity conversion (passes the input through untouched)", () => {
    // A bogus USD->USD rate must be ignored: identity is short-circuited so the
    // input amount can never be scaled by a self-referential rate.
    const rates: FxRates = { USD: { USD: 2 } };
    expect(convertAmount(100, "USD", "USD", rates)).toEqual({
      available: true,
      amount: 100,
    });
  });

  it("converts using a finite positive cross-currency rate", () => {
    const rates: FxRates = { USD: { CAD: 1.35 } };
    expect(convertAmount(100, "USD", "CAD", rates)).toEqual({
      available: true,
      amount: 135,
    });
  });

  it("reports unavailable when no rate exists for the pair (never silently 1:1)", () => {
    // The critical safety invariant: a missing rate must NOT return the input
    // amount as though it were already in the target currency.
    expect(convertAmount(100, "USD", "CAD", {})).toEqual({ available: false });
    expect(convertAmount(100, "USD", "CAD", { USD: {} })).toEqual({
      available: false,
    });
    expect(convertAmount(100, "USD", "CAD", { CAD: { USD: 0.74 } })).toEqual({
      available: false,
    });
  });

  it("rejects non-finite or non-positive rates instead of fabricating a total", () => {
    const cases: number[] = [0, -1.35, Number.NaN, Infinity, -Infinity];
    for (const rate of cases) {
      expect(convertAmount(100, "USD", "CAD", { USD: { CAD: rate } })).toEqual({
        available: false,
      });
    }
  });
});

describe("formatConverted", () => {
  it("formats in the target currency when a rate is available", () => {
    const rates: FxRates = { USD: { CAD: 1.5 } };
    expect(formatConverted(100, "USD", "CAD", rates, plain)).toBe("150 CAD");
  });

  it("shows the original amount and currency with an explicit marker when no rate exists", () => {
    expect(formatConverted(100, "USD", "CAD", {}, plain)).toBe(
      "100 USD (no CAD rate)",
    );
  });

  it("shows an identity amount in its own currency without a marker", () => {
    expect(formatConverted(100, "USD", "USD", {}, plain)).toBe("100 USD");
  });
});
