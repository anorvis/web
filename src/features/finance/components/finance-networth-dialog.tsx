"use client";

import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { Check, Eye, EyeOff, Pencil, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Metric } from "@/components/life-intelligence/record-ui";
import {
  deleteFinanceAccount,
  type FinanceAccountReturnRateRecord,
  updateFinanceAccount,
} from "@/features/finance/api/finance";
import { CreateAccountForm } from "@/features/finance/components/finance-account-form";
import {
  type BalanceBreakdown,
  formatCurrencyAmount,
  isLiabilityAccount,
} from "@/features/finance/components/finance-derive";
import {
  EmptyState,
  FinanceDialog,
} from "@/features/finance/components/finance-panels";
import type { Account, FinanceData } from "@/lib/life-intelligence/model";

const ACCOUNT_TYPE_ORDER = [
  "checking",
  "savings",
  "investment",
  "crypto",
  "credit",
  "loan",
];

const accountIconButtonClass =
  "border border-border bg-transparent p-1 text-muted-foreground transition-colors hover:border-foreground hover:text-foreground disabled:cursor-wait disabled:opacity-50";

const returnTimeframeOrder = ["1D", "1W", "1M", "YTD", "1Y", "ALL"];
const returnPercentFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
  signDisplay: "exceptZero",
});

function formatReturnPercent(value: number): string {
  return `${returnPercentFormatter.format(value)}%`;
}

export function FinanceNetWorthDialog({
  open,
  onOpenChange,
  loading,
  loadError,
  finance,
  balances,
  returnRates,
  reportingCurrency,
  onRetry,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  loadError: boolean;
  finance: FinanceData;
  balances: BalanceBreakdown;
  returnRates: FinanceAccountReturnRateRecord[];
  reportingCurrency: string;
  onRetry: () => void;
  onChanged: () => void;
}) {
  const [accountMessage, setAccountMessage] = useState<string | null>(null);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBalance, setEditBalance] = useState("");

  const returnRatesByAccount = useMemo(() => {
    const rates = new Map<string, FinanceAccountReturnRateRecord[]>();
    for (const rate of returnRates) {
      const accountRates = rates.get(rate.accountId) ?? [];
      accountRates.push(rate);
      rates.set(rate.accountId, accountRates);
    }
    for (const accountRates of rates.values()) {
      accountRates.sort(
        (left, right) =>
          returnTimeframeOrder.indexOf(left.timeframe) -
          returnTimeframeOrder.indexOf(right.timeframe),
      );
    }
    return rates;
  }, [returnRates]);

  const visibleAccounts = useMemo(
    () => finance.accounts.filter((account) => account.status !== "hidden"),
    [finance.accounts],
  );
  const hiddenAccounts = useMemo(
    () =>
      finance.accounts
        .filter((account) => account.status === "hidden")
        .sort((left, right) => left.name.localeCompare(right.name)),
    [finance.accounts],
  );

  const accountGroups = useMemo(() => {
    const byType = new Map<string, Account[]>();
    for (const account of visibleAccounts) {
      const group = byType.get(account.type) ?? [];
      group.push(account);
      byType.set(account.type, group);
    }
    const order = [
      ...ACCOUNT_TYPE_ORDER,
      ...[...byType.keys()].filter(
        (type) => !ACCOUNT_TYPE_ORDER.includes(type),
      ),
    ];
    return order
      .filter((type) => byType.has(type))
      .map((type) => ({
        type,
        accounts: (byType.get(type) ?? []).sort((left, right) =>
          left.name.localeCompare(right.name),
        ),
      }));
  }, [visibleAccounts]);

  const changeAccountStatus = async (
    account: Account,
    status: "hidden" | "active",
  ) => {
    if (pendingAccountId) return;
    setPendingAccountId(account.id);
    setAccountMessage(null);
    try {
      await updateFinanceAccount(account.id, { status });
      onChanged();
    } catch (error) {
      setAccountMessage(
        `account update failed — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setPendingAccountId(null);
    }
  };

  const removeAccount = async (account: Account) => {
    if (pendingAccountId || account.source !== "manual") return;
    const confirmed = window.confirm(
      `Remove ${account.name}? This permanently deletes the account and its transactions.`,
    );
    if (!confirmed) return;
    setPendingAccountId(account.id);
    setAccountMessage(null);
    try {
      const result = await deleteFinanceAccount(account.id);
      setAccountMessage(
        `removed account · deleted ${result.deletedTransactions} transaction${result.deletedTransactions === 1 ? "" : "s"}`,
      );
      onChanged();
    } catch (error) {
      setAccountMessage(
        `account removal failed — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setPendingAccountId(null);
    }
  };

  const startEditing = (account: Account) => {
    if (pendingAccountId) return;
    setEditingAccountId(account.id);
    setEditName(account.name);
    setEditBalance(
      account.balance === undefined ? "" : String(account.balance),
    );
    setAccountMessage(null);
  };

  const saveAccountEdit = async (account: Account) => {
    if (pendingAccountId) return;
    const name = editName.trim();
    if (!name) {
      setAccountMessage("account name must not be empty");
      return;
    }
    const balanceText = editBalance.trim();
    const balance = balanceText.length > 0 ? Number(balanceText) : null;
    if (balance !== null && !Number.isFinite(balance)) {
      setAccountMessage("account balance must be a number");
      return;
    }
    // PATCH only what changed; re-sending an unchanged balance would re-stamp
    // today's account-history point for no reason.
    const patch: { name?: string; balance?: number | null } = {};
    if (name !== account.name) patch.name = name;
    const currentBalance = account.balance ?? null;
    if (balance !== currentBalance) patch.balance = balance;
    if (Object.keys(patch).length === 0) {
      setEditingAccountId(null);
      return;
    }
    setPendingAccountId(account.id);
    setAccountMessage(null);
    try {
      await updateFinanceAccount(account.id, patch);
      setEditingAccountId(null);
      onChanged();
    } catch (error) {
      setAccountMessage(
        `account update failed — ${error instanceof Error ? error.message : "unknown error"}`,
      );
    } finally {
      setPendingAccountId(null);
    }
  };

  const renderAccountRow = (account: Account) => {
    const hidden = account.status === "hidden";
    const pending = pendingAccountId === account.id;
    const canEdit = account.source === "manual";
    const editing = editingAccountId === account.id;
    const meta = [
      hidden ? "hidden" : isLiabilityAccount(account) ? "liability" : "asset",
      ...(account.mask ? [`••••${account.mask}`] : []),
      ...(returnRatesByAccount.get(account.id) ?? []).map(
        (rate) =>
          `${rate.timeframe} ${formatReturnPercent(rate.returnPercent)}`,
      ),
    ].join(" · ");
    if (editing) {
      return (
        <div
          key={account.id}
          className="flex items-center gap-2 border-b border-border/40 py-2 last:border-b-0"
        >
          <input
            className={`min-w-0 flex-1 ${workspacePageStyles.inlineInput}`}
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            aria-label={`account name for ${account.name}`}
            placeholder="account name"
          />
          <input
            className={`w-28 shrink-0 ${workspacePageStyles.inlineInput}`}
            value={editBalance}
            onChange={(event) => setEditBalance(event.target.value)}
            inputMode="decimal"
            aria-label={`balance for ${account.name}`}
            placeholder="balance"
          />
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={accountIconButtonClass}
              aria-label={`save ${account.name}`}
              title="save changes"
              disabled={pending || !editName.trim()}
              onClick={() => void saveAccountEdit(account)}
            >
              <Check
                className="size-3.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              className={accountIconButtonClass}
              aria-label={`cancel editing ${account.name}`}
              title="cancel"
              disabled={pending}
              onClick={() => setEditingAccountId(null)}
            >
              <X className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </div>
      );
    }
    return (
      <div
        key={account.id}
        className="group flex items-center gap-2 border-b border-border/40 py-2 last:border-b-0"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
            {account.name}
          </p>
          <p className="truncate text-[0.7rem] text-muted-foreground">{meta}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          {canEdit ? (
            <button
              type="button"
              className={accountIconButtonClass}
              aria-label={`edit ${account.name}`}
              title="edit name and balance"
              disabled={pending}
              onClick={() => startEditing(account)}
            >
              <Pencil
                className="size-3.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
          ) : null}
          <button
            type="button"
            className={accountIconButtonClass}
            aria-label={
              hidden ? `unhide ${account.name}` : `hide ${account.name}`
            }
            title={hidden ? "unhide account" : "hide account"}
            disabled={pending}
            onClick={() =>
              void changeAccountStatus(account, hidden ? "active" : "hidden")
            }
          >
            {hidden ? (
              <Eye className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <EyeOff
                className="size-3.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            )}
          </button>
          {canEdit ? (
            <button
              type="button"
              className={cn(
                accountIconButtonClass,
                "hover:border-red-300 hover:text-red-300",
              )}
              aria-label={`remove ${account.name}`}
              title="remove account and its transactions"
              disabled={pending}
              onClick={() => void removeAccount(account)}
            >
              <Trash2
                className="size-3.5"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </button>
          ) : null}
        </div>
        <p
          className={`max-w-[45%] shrink-0 text-right text-xs leading-relaxed ${
            isLiabilityAccount(account) ? "text-red-300" : "text-foreground"
          }`}
        >
          {account.balance === undefined
            ? "unknown"
            : formatCurrencyAmount(account.balance, account.currency)}
        </p>
      </div>
    );
  };

  return (
    <FinanceDialog
      className="h-auto max-h-[min(84vh,46rem)]"
      open={open}
      onOpenChange={onOpenChange}
      title="net worth & balances"
      description={`Tracked balances converted by anorvis-os into ${reportingCurrency}. Assets and liabilities remain separate.`}
    >
      {loading ? (
        <Skeleton className="h-40 rounded-none" />
      ) : loadError && finance.accounts.length === 0 ? (
        <EmptyState
          title="Balances unavailable."
          body="Refresh to retry, or import CSV files from Sources."
          action={
            <button
              type="button"
              className={workspacePageStyles.modalButton}
              onClick={onRetry}
            >
              retry
            </button>
          }
        />
      ) : (
        <div className="space-y-5">
          <section className="space-y-3 border border-border p-4">
            <div>
              <p className={workspacePageStyles.cardLabel}>
                {"// create account"}
              </p>
              <p className={workspacePageStyles.cardBodyText}>
                Add a manual account for anything SnapTrade cannot track, then
                target it from CSV upload to keep its records categorized
                correctly.
              </p>
            </div>
            <CreateAccountForm
              onCreated={() => {
                onChanged();
              }}
              onMessage={setAccountMessage}
            />
            {accountMessage ? (
              <p className="text-[0.62rem] leading-relaxed text-muted-foreground">
                {accountMessage}
              </p>
            ) : null}
          </section>

          {finance.accounts.length > 0 ? (
            <>
              {balances.currencies.length > 0 ? (
                <section className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
                  {balances.currencies.map((currency) => (
                    <Metric
                      key={currency}
                      label={`net worth · ${currency}`}
                      value={formatCurrencyAmount(
                        balances.net.get(currency) ?? 0,
                        currency,
                      )}
                      note={`assets ${formatCurrencyAmount(balances.assets.get(currency) ?? 0, currency)} · liabilities ${formatCurrencyAmount(balances.liabilities.get(currency) ?? 0, currency)}`}
                    />
                  ))}
                </section>
              ) : (
                <p className={workspacePageStyles.cardBodyText}>
                  No known account balances to total yet.
                </p>
              )}
              {accountGroups.map((group) => {
                // Groups are single-type, so the first account decides; keeps
                // the subtotal sign in lockstep with isLiabilityAccount rows.
                const [firstAccount] = group.accounts;
                const liabilityGroup =
                  firstAccount !== undefined &&
                  isLiabilityAccount(firstAccount);
                const totals = new Map<string, number>();
                for (const account of group.accounts) {
                  if (account.balance === undefined) continue;
                  const value = liabilityGroup
                    ? Math.abs(account.balance)
                    : account.balance;
                  totals.set(
                    account.currency,
                    (totals.get(account.currency) ?? 0) + value,
                  );
                }
                const subtotal = [...totals.entries()]
                  .sort(([left], [right]) => left.localeCompare(right))
                  .map(([currency, value]) =>
                    formatCurrencyAmount(value, currency),
                  )
                  .join(" · ");
                return (
                  <section
                    key={group.type}
                    className="border border-border/60 p-3"
                  >
                    <div className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-2">
                      <p className={workspacePageStyles.cardLabel}>
                        {group.type} ·{" "}
                        {`${group.accounts.length} account${group.accounts.length === 1 ? "" : "s"}`}
                      </p>
                      {subtotal ? (
                        <p
                          className={`text-[0.68rem] tabular-nums ${
                            liabilityGroup ? "text-red-300" : "text-foreground"
                          }`}
                        >
                          {liabilityGroup ? `−${subtotal}` : subtotal}
                        </p>
                      ) : null}
                    </div>
                    {group.accounts.map(renderAccountRow)}
                  </section>
                );
              })}
              {hiddenAccounts.length > 0 ? (
                <section className="border border-border/60 p-3">
                  <div className="border-b border-border/60 pb-2">
                    <p className={workspacePageStyles.cardLabel}>
                      hidden ·{" "}
                      {`${hiddenAccounts.length} account${hiddenAccounts.length === 1 ? "" : "s"}`}
                    </p>
                  </div>
                  {hiddenAccounts.map(renderAccountRow)}
                </section>
              ) : null}
            </>
          ) : (
            <EmptyState
              title="No balances yet."
              body="Create an account above, import a CSV, or connect SnapTrade from Sources."
            />
          )}
        </div>
      )}
    </FinanceDialog>
  );
}
