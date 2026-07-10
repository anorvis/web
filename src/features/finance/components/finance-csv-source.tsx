"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useCallback, useState } from "react";
import type {
  CsvImportRequest,
  CsvImportSource,
  FinanceAccountRecord,
  FinanceImportRecord,
} from "@/features/finance/api/finance";
import { importFinanceCsv } from "@/features/finance/api/finance";
import { CsvImport } from "@/features/finance/components/csv-import";
import { CreateAccountForm } from "@/features/finance/components/finance-account-form";
import { PaginatedRecords } from "@/features/finance/components/finance-panels";
import { categorizeAll } from "@/features/finance/lib/categorize";
import type { Transaction } from "@/features/finance/types/finance";
import { formatDateTime } from "@/lib/life-intelligence/derive";

function countLabel(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function accountOptionLabel(account: FinanceAccountRecord): string {
  const suffix = account.mask ? ` ••••${account.mask}` : "";
  return `${account.name}${suffix} · ${account.type} · ${account.currency}`;
}

function isVisibleCsvTargetAccount(account: FinanceAccountRecord): boolean {
  return (
    account.source !== "csv" &&
    account.status !== "hidden" &&
    account.status !== "closed"
  );
}

export function FinanceCsvSource({
  accounts,
  onFileLoadedChange,
  onRefreshDashboard,
  onImportMessageChange,
}: {
  accounts: FinanceAccountRecord[];
  onFileLoadedChange: (loaded: boolean) => void;
  onRefreshDashboard: () => void;
  onImportMessageChange: (message: string | null) => void;
}) {
  const [selectedCsvAccountId, setSelectedCsvAccountId] = useState("");

  const csvAccounts = accounts.filter(isVisibleCsvTargetAccount);
  const selectedCsvAccount =
    csvAccounts.find((account) => account.id === selectedCsvAccountId) ?? null;
  const selectedCsvAccountLabel = selectedCsvAccount
    ? accountOptionLabel(selectedCsvAccount)
    : null;

  const handleCsvImport = useCallback(
    async (transactions: Transaction[], balance: number | null) => {
      if (!selectedCsvAccount) {
        throw new Error("select or create an account before importing");
      }
      const categorized = categorizeAll(transactions);
      const source: CsvImportSource = categorized[0]?.source ?? "manual";
      const importCurrency = categorized[0]?.originalCurrency;
      if (
        !importCurrency ||
        categorized.some(
          (transaction) =>
            transaction.originalCurrency !== importCurrency ||
            transaction.originalCurrency !== selectedCsvAccount.currency,
        )
      ) {
        throw new Error(
          `CSV currency must match selected account currency (${selectedCsvAccount.currency})`,
        );
      }
      const body: CsvImportRequest = {
        source,
        accountId: selectedCsvAccount.id,
        balance,
        transactions: categorized.map((transaction) => ({
          fingerprint: transaction.importFingerprint ?? transaction.id,
          date: transaction.date,
          description: transaction.description,
          amount: transaction.amount,
          category: transaction.category,
          currency: transaction.originalCurrency,
        })),
      };
      const result = await importFinanceCsv(body);
      onImportMessageChange(
        `imported into ${accountOptionLabel(selectedCsvAccount)} · ${countLabel(result.imported, "transaction")}`,
      );
      onRefreshDashboard();
      return result;
    },
    [onImportMessageChange, onRefreshDashboard, selectedCsvAccount],
  );

  return (
    <>
      <div className="space-y-4 border border-border p-4">
        <div>
          <p className={workspacePageStyles.cardLabel}>{"// import account"}</p>
          <p className={workspacePageStyles.cardBodyText}>
            Pick the real visible account that owns this statement, or create
            one before uploading.
          </p>
        </div>
        <label className="block space-y-2">
          <span className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
            existing account
          </span>
          <select
            value={selectedCsvAccountId}
            onChange={(event) => setSelectedCsvAccountId(event.target.value)}
            className={`w-full ${workspacePageStyles.inlineInput}`}
          >
            <option value="">select account…</option>
            {csvAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {accountOptionLabel(account)}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2 border-t border-border/60 pt-4">
          <p className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
            or create a new account
          </p>
          <CreateAccountForm
            onCreated={(account) => {
              setSelectedCsvAccountId(account.id);
              onRefreshDashboard();
            }}
            onMessage={onImportMessageChange}
          />
        </div>
        {selectedCsvAccountLabel ? (
          <p className="border-t border-border/60 pt-3 text-[0.62rem] leading-relaxed text-foreground">
            importing into · {selectedCsvAccountLabel}
          </p>
        ) : null}
      </div>

      <CsvImport
        onImport={handleCsvImport}
        selectedAccountLabel={selectedCsvAccountLabel}
        onFileLoadedChange={onFileLoadedChange}
      />
    </>
  );
}

export function FinanceCsvReceipt({
  imports,
  importMessage,
  undoingImportId,
  onUndoImport,
  fill = false,
}: {
  imports: FinanceImportRecord[];
  importMessage: string | null;
  undoingImportId: string | null;
  onUndoImport: (record: FinanceImportRecord) => void;
  fill?: boolean;
}) {
  if (imports.length === 0) return null;

  return (
    <div
      className={cn(
        "space-y-3 border border-border p-4 font-mono",
        fill && "flex min-h-0 flex-1 flex-col",
      )}
    >
      <p className={`${workspacePageStyles.cardLabel} shrink-0`}>
        {"// import receipt"}
      </p>
      <div className={cn("mt-2", fill && "flex min-h-0 flex-1 flex-col")}>
        <PaginatedRecords
          fill={fill}
          footerClassName="mt-auto shrink-0 pt-3"
          items={imports}
          pageSize={2}
          keyOf={(record) => record.id}
          empty={{
            title: "No imports yet.",
            body: "Completed CSV imports appear here.",
          }}
          renderRow={(record) => {
            const label = record.sourceVariant
              ? `${record.source} · ${record.sourceVariant}`
              : record.source;
            const undone = record.status === "undone";
            const canUndo =
              record.source === "csv" &&
              record.status === "completed" &&
              record.importedCount > 0;
            const busy = undoingImportId === record.id;
            return (
              <div className={workspacePageStyles.listRow}>
                <div className="min-w-0">
                  <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                    {label}
                  </p>
                  <p className="truncate text-[0.7rem] text-muted-foreground">
                    {record.status} ·{" "}
                    {formatDateTime(record.finishedAt ?? record.createdAt)}
                  </p>
                </div>
                <div className="flex max-w-[58%] flex-wrap items-center justify-end gap-2 text-right">
                  <span
                    className={
                      record.error
                        ? "text-xs leading-relaxed text-red-300"
                        : "text-xs leading-relaxed text-foreground"
                    }
                  >
                    {undone
                      ? "undone"
                      : `+${record.importedCount}${record.skippedCount > 0 ? ` · ${record.skippedCount} skipped` : ""}`}
                  </span>
                  {canUndo || undone ? (
                    <button
                      type="button"
                      className={workspacePageStyles.modalDangerButton}
                      disabled={!canUndo || busy}
                      onClick={() => onUndoImport(record)}
                      title={
                        undone
                          ? "Transactions already removed; account cleanup depends on legacy orphan safety checks."
                          : `Remove ${countLabel(record.importedCount, "transaction")} from this receipt.`
                      }
                    >
                      {busy ? "..." : undone ? "undone" : "remove transactions"}
                    </button>
                  ) : null}
                </div>
              </div>
            );
          }}
        />
      </div>
      {importMessage ? (
        <p className="mt-2 text-[0.62rem] leading-relaxed text-muted-foreground">
          {importMessage}
        </p>
      ) : null}
    </div>
  );
}
