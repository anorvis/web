import { describe, expect, it } from "vitest";

import { formatCurrencyGroups, orderCurrencies } from "./finance-derive";

// Preferred-currency is a display concern only: it reorders which currency
// leads, but never converts, sums, adds, or drops a currency. These pin the
// invariants that keep multi-currency balances honest.
describe("orderCurrencies preferred ordering", () => {
  it("floats the preferred currency first while keeping every other code in its original order", () => {
    const currencies = ["USD", "EUR", "CAD"];
    const ordered = orderCurrencies(currencies, "EUR");
    // Preferred leads, and no currency is added or dropped.
    expect(ordered).toEqual(["EUR", "USD", "CAD"]);
    // Same multiset in, same multiset out — ordering never mutates membership.
    expect([...ordered].sort()).toEqual([...currencies].sort());
  });

  it("leaves the list untouched when the preferred code is not present (never injects it)", () => {
    const currencies = ["USD", "CAD"];
    expect(orderCurrencies(currencies, "EUR")).toEqual(["USD", "CAD"]);
  });

  it("leaves the list untouched when no preferred currency is supplied", () => {
    const currencies = ["CAD", "USD"];
    expect(orderCurrencies(currencies, null)).toEqual(["CAD", "USD"]);
    expect(orderCurrencies(currencies, undefined)).toEqual(["CAD", "USD"]);
  });
});

describe("formatCurrencyGroups multi-currency display", () => {
  it("renders each currency side by side and never sums or converts across currencies", () => {
    const groups = new Map<string, number>([
      ["USD", 100],
      ["EUR", 50],
    ]);
    const rendered = formatCurrencyGroups(groups, null);
    // Two independent segments — a single collapsed value would mean summing.
    const segments = rendered.split(" / ");
    expect(segments).toHaveLength(2);
    // Both raw per-currency amounts survive verbatim.
    expect(rendered).toContain("USD");
    expect(rendered).toContain("100.00");
    expect(rendered).toContain("EUR");
    expect(rendered).toContain("50.00");
    // The summed total (150) must never appear.
    expect(rendered).not.toContain("150");
  });

  it("floats the preferred currency ahead of the otherwise-alphabetical order", () => {
    const groups = new Map<string, number>([
      ["CAD", 10],
      ["USD", 20],
    ]);
    // Without a preference, alphabetical order leads with CAD.
    const alphabetical = formatCurrencyGroups(groups, null);
    expect(alphabetical.indexOf("CAD")).toBeLessThan(
      alphabetical.indexOf("USD"),
    );
    // Preferring USD floats it first even though CAD sorts earlier.
    const preferred = formatCurrencyGroups(groups, "USD");
    expect(preferred.indexOf("USD")).toBeLessThan(preferred.indexOf("CAD"));
    // Still both currencies, still no summing.
    expect(preferred.split(" / ")).toHaveLength(2);
  });

  it("renders an empty group as zero in the preferred currency rather than defaulting away from it", () => {
    const empty = new Map<string, number>();
    const rendered = formatCurrencyGroups(empty, "EUR");
    // The preferred currency drives the empty display — never a USD fallback.
    expect(rendered).toContain("EUR");
    expect(rendered).not.toContain("USD");
    expect(rendered).toContain("0.00");
  });
});
