"use client";

import { Schema } from "effect";
import {
  createContext,
  type ReactNode,
  use,
  useCallback,
  useState,
} from "react";
import { categorizeAll } from "@/features/finance/lib/categorize";
import type { Transaction } from "@/features/finance/types/finance";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { decodeUnknownResult } from "@/lib/effect/schema";

const SESSION_KEY = "anorvis_finance_tx";

type SessionCache = {
  transactions: Transaction[];
  liquidBalance: number | null;
};

const SessionCacheSchema = Schema.parseJson(
  Schema.Struct({
    transactions: Schema.Array(Schema.Unknown),
    liquidBalance: Schema.Union(Schema.Number, Schema.Null),
  }),
);

function loadSessionCache(): SessionCache | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const decoded = decodeUnknownResult(SessionCacheSchema, raw);
    return decoded.ok
      ? {
          transactions: decoded.value.transactions as Transaction[],
          liquidBalance: decoded.value.liquidBalance,
        }
      : null;
  } catch {
    return null;
  }
}

function saveSessionCache(cache: SessionCache) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(cache));
  } catch {
    // quota exceeded — ignore
  }
}

function txFingerprint(t: Transaction): string {
  return (
    t.importFingerprint ?? `${t.date}|${t.description}|${t.amount}|${t.account}`
  );
}

type FinanceContextValue = {
  transactions: Transaction[];
  liquidBalance: number | null;
  importTransactions: (txs: Transaction[], balance: number | null) => void;
  recategorize: (txId: string, newCategory: string) => void;
  clearAll: () => void;
};

const FinanceContext = createContext<FinanceContextValue | null>(null);

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [liquidBalance, setLiquidBalance] = useState<number | null>(null);

  useMountEffect(() => {
    const cached = loadSessionCache();
    if (cached && cached.transactions.length > 0) {
      setTransactions(cached.transactions);
      setLiquidBalance(cached.liquidBalance);
    }
  });

  const importTransactions = useCallback(
    (newTransactions: Transaction[], balance: number | null) => {
      const categorized = categorizeAll(newTransactions);
      setTransactions((prev) => {
        const existing = new Set(prev.map(txFingerprint));
        const deduped = categorized.filter(
          (t) => !existing.has(txFingerprint(t)),
        );
        const next = [...prev, ...deduped];
        const nextBalance =
          balance != null ? (liquidBalance ?? 0) + balance : liquidBalance;
        saveSessionCache({ transactions: next, liquidBalance: nextBalance });
        return next;
      });
      if (balance != null) {
        setLiquidBalance((prev) => (prev ?? 0) + balance);
      }
    },
    [liquidBalance],
  );

  const recategorize = useCallback(
    (txId: string, newCategory: string) => {
      setTransactions((prev) => {
        const next = prev.map((t) =>
          t.id === txId ? { ...t, category: newCategory } : t,
        );
        saveSessionCache({ transactions: next, liquidBalance });
        return next;
      });
    },
    [liquidBalance],
  );

  const clearAll = useCallback(() => {
    setTransactions([]);
    setLiquidBalance(null);
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // ignore
    }
  }, []);

  return (
    <FinanceContext.Provider
      value={{
        transactions,
        liquidBalance,
        importTransactions,
        recategorize,
        clearAll,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
}

export function useFinanceData() {
  const ctx = use(FinanceContext);
  if (!ctx)
    throw new Error("useFinanceData must be used inside FinanceProvider");
  return ctx;
}
