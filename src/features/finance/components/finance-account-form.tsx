"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useState } from "react";
import type {
  CsvImportAccountType,
  FinanceAccountRecord,
} from "@/features/finance/api/finance";
import { createFinanceAccount } from "@/features/finance/api/finance";
import {
  preferredCurrencies,
  useFinancePreferences,
} from "@/lib/stores/finance-preferences";

const ACCOUNT_TYPES: CsvImportAccountType[] = [
  "checking",
  "savings",
  "credit",
  "investment",
  "crypto",
  "loan",
];

/**
 * Self-contained manual account creation: name on its own row, then
 * type/currency/balance/submit. Creates a real `source="manual"` account, so
 * CSV imports and net worth can target institutions SnapTrade does not cover.
 */
export function CreateAccountForm({
  onCreated,
  onMessage,
}: {
  onCreated: (account: FinanceAccountRecord) => void;
  onMessage: (message: string | null) => void;
}) {
  const preferredCurrency = useFinancePreferences(
    (state) => state.preferredCurrency,
  );
  const [name, setName] = useState("");
  const [type, setType] = useState<CsvImportAccountType>("checking");
  const [currency, setCurrency] = useState<string>(preferredCurrency);
  const [balance, setBalance] = useState("");
  const [creating, setCreating] = useState(false);

  const create = async () => {
    const trimmedName = name.trim();
    const trimmedCurrency = currency.trim().toUpperCase();
    if (!trimmedName || !trimmedCurrency || creating) return;
    const parsedBalance = balance.trim().length > 0 ? Number(balance) : null;
    if (parsedBalance !== null && !Number.isFinite(parsedBalance)) {
      onMessage("account balance must be a number");
      return;
    }
    setCreating(true);
    onMessage(null);
    try {
      const result = await createFinanceAccount({
        name: trimmedName,
        type,
        currency: trimmedCurrency,
        ...(parsedBalance !== null ? { balance: parsedBalance } : {}),
      });
      setName("");
      setBalance("");
      setCurrency(trimmedCurrency);
      onCreated(result.account);
    } catch (error) {
      onMessage(
        `account creation failed — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-3">
      <input
        className={`w-full ${workspacePageStyles.inlineInput}`}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="new account name"
        aria-label="new account name"
      />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem_minmax(0,1fr)_auto]">
        <select
          className={workspacePageStyles.inlineInput}
          value={type}
          onChange={(event) =>
            setType(event.target.value as CsvImportAccountType)
          }
          aria-label="new account type"
        >
          {ACCOUNT_TYPES.map((accountType) => (
            <option key={accountType} value={accountType}>
              {accountType}
            </option>
          ))}
        </select>
        <select
          className={workspacePageStyles.inlineInput}
          value={currency}
          onChange={(event) => setCurrency(event.target.value)}
          aria-label="new account currency"
        >
          {preferredCurrencies.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <input
          className={workspacePageStyles.inlineInput}
          value={balance}
          onChange={(event) => setBalance(event.target.value)}
          inputMode="decimal"
          placeholder="opening balance (optional)"
          aria-label="new account balance"
        />
        <button
          type="button"
          className={workspacePageStyles.modalButton}
          disabled={creating || !name.trim() || !currency.trim()}
          onClick={() => void create()}
        >
          {creating ? "..." : "create"}
        </button>
      </div>
    </div>
  );
}
