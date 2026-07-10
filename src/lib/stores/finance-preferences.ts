import { create } from "zustand";

export type PreferredCurrency = "CAD" | "USD" | "BTC";

/**
 * Currencies offered by the nav preference. Limited to the currencies Finance
 * currently supports; this is a display/navigation preference only and never a
 * promise that values are converted between them.
 */
export const preferredCurrencies: PreferredCurrency[] = ["CAD", "USD", "BTC"];

const currencyStorageKey = "anorvis.finance.currency";

function isPreferredCurrency(value: string | null): value is PreferredCurrency {
  return value === "CAD" || value === "USD" || value === "BTC";
}

function readPreferredCurrency(): PreferredCurrency {
  if (typeof window === "undefined") return "CAD";
  const stored = window.localStorage.getItem(currencyStorageKey);
  return isPreferredCurrency(stored) ? stored : "CAD";
}

type FinancePreferences = {
  preferredCurrency: PreferredCurrency;
  hydratePreferredCurrency: () => void;
  setPreferredCurrency: (preferredCurrency: PreferredCurrency) => void;
};

export const useFinancePreferences = create<FinancePreferences>((set) => ({
  preferredCurrency: "CAD",
  hydratePreferredCurrency: () =>
    set({ preferredCurrency: readPreferredCurrency() }),
  setPreferredCurrency: (preferredCurrency) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(currencyStorageKey, preferredCurrency);
    }
    set({ preferredCurrency });
  },
}));
