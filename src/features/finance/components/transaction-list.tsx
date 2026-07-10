"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMemo, useState } from "react";
import { transactionCategories } from "@/features/finance/config";
import { formatConverted } from "@/features/finance/lib/currency";
import type {
  Currency,
  FxRates,
  Transaction,
} from "@/features/finance/types/finance";

type TransactionListProps = {
  transactions: Transaction[];
  currency: Currency;
  rates: FxRates;
  onRecategorize: (txId: string, newCategory: string) => void;
};

function fmt(amount: number, currency: Currency): string {
  if (currency === "BTC") return `₿${amount.toFixed(6)}`;
  const sign = amount >= 0 ? "+" : "";
  return `${sign}${amount.toLocaleString("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function TransactionList({
  transactions,
  currency,
  rates,
  onRecategorize,
}: TransactionListProps) {
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let result = transactions;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((t) => t.description.toLowerCase().includes(q));
    }
    if (filterCategory) {
      result = result.filter((t) => t.category === filterCategory);
    }
    return result.sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, search, filterCategory]);

  const display = (t: Transaction) =>
    formatConverted(t.amount, t.originalCurrency, currency, rates, fmt);

  if (transactions.length === 0) {
    return (
      <p className="text-[0.65rem] text-muted-foreground">
        upload a csv to see transactions
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          placeholder="search merchant..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${workspacePageStyles.inlineInput} flex-1`}
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className={workspacePageStyles.inlineInput}
        >
          <option value="">all categories</option>
          {transactionCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      <p className="text-[0.5rem] text-muted-foreground/50">
        {filtered.length} of {transactions.length} transactions
      </p>

      <div className={`${workspacePageStyles.list} max-h-80 overflow-y-auto`}>
        {filtered.slice(0, 100).map((t) => (
          <div key={t.id} className={workspacePageStyles.listRow}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[0.5rem] text-muted-foreground/50 shrink-0">
                  {t.date}
                </span>
                <span className="text-[0.65rem] text-foreground truncate">
                  {t.description}
                </span>
              </div>
              {editingId === t.id ? (
                <select
                  value={t.category}
                  onChange={(e) => {
                    onRecategorize(t.id, e.target.value);
                    setEditingId(null);
                  }}
                  onBlur={() => setEditingId(null)}
                  className={`${workspacePageStyles.inlineInput} mt-1`}
                  autoFocus
                >
                  {transactionCategories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingId(t.id)}
                  className="text-[0.5rem] text-muted-foreground/50 hover:text-foreground"
                >
                  {t.category}
                </button>
              )}
            </div>
            <span
              className={`text-[0.65rem] shrink-0 ${
                t.amount >= 0 ? "text-green-500" : "text-foreground"
              }`}
            >
              {display(t)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
