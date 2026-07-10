"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  type DetectResult,
  detectBankFormat,
  extractBalance,
  getCSVHeaders,
  parseCSV,
  parseCSVManual,
} from "@/features/finance/lib/csv-parser";
import type {
  ColumnMapping,
  Transaction,
} from "@/features/finance/types/finance";

// The importer parses locally, then hands the parsed transactions to the parent
// which persists them through the canonical OS import route. The callback is
// async so the drop zone can reflect import progress and the imported/skipped
// counts anorvis-os reports back.
export type CsvImportSummary = {
  imported: number;
  skippedDuplicates: number;
};

type CsvImportProps = {
  onImport: (
    transactions: Transaction[],
    balance: number | null,
  ) => Promise<CsvImportSummary>;
  selectedAccountLabel: string | null;
  onFileLoadedChange?: (loaded: boolean) => void;
};

function fileLabelFromSource(sourceLabel: string) {
  return sourceLabel.split(":")[0]?.replace(/\.csv$/i, "") || "manual import";
}

export function CsvImport({
  onImport,
  selectedAccountLabel,
  onFileLoadedChange,
}: CsvImportProps) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [manualState, setManualState] = useState<{
    csvText: string;
    headers: string[];
    sourceLabel: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const accountSelected = Boolean(selectedAccountLabel);

  const runImport = useCallback(
    async (
      transactions: Transaction[],
      balance: number | null,
      label: string,
    ) => {
      if (transactions.length === 0) {
        setStatus(`${label} — no transactions found`);
        return;
      }
      setImporting(true);
      setStatus(`${label} — importing ${transactions.length} transactions…`);
      try {
        const result = await onImport(transactions, balance);
        const skipped = result.skippedDuplicates;
        setStatus(
          `${label} — imported ${result.imported}${
            skipped > 0
              ? `, skipped ${skipped} duplicate${skipped === 1 ? "" : "s"}`
              : ""
          }`,
        );
      } catch (error) {
        setStatus(
          `import failed — ${error instanceof Error ? error.message : "unknown error"}`,
        );
      } finally {
        setImporting(false);
      }
    },
    [onImport],
  );

  const processFile = useCallback(
    (file: File) => {
      if (!accountSelected) {
        setStatus("select or create an account before uploading");
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target?.result as string;
        if (!csvText) return;
        onFileLoadedChange?.(true);

        const result: DetectResult = detectBankFormat(csvText);
        if (result.detected) {
          const accountName =
            selectedAccountLabel ?? file.name.replace(/\.csv$/i, "");
          const transactions = parseCSV(csvText, result.format, accountName);
          const balance = extractBalance(csvText, result.format);
          setManualState(null);
          void runImport(transactions, balance, result.label);
        } else {
          const headers = getCSVHeaders(csvText);
          setManualState({
            csvText,
            headers,
            sourceLabel: `${file.name}:${file.size}:${file.lastModified}`,
          });
          setStatus("format not recognized — map columns manually");
        }
      };
      reader.readAsText(file);
    },
    [accountSelected, onFileLoadedChange, runImport, selectedAccountLabel],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (importing || !accountSelected) return;
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [accountSelected, processFile, importing],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!importing && accountSelected) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => {
          if (!importing && accountSelected) fileInputRef.current?.click();
        }}
        aria-disabled={!accountSelected || importing}
        className={`border border-dashed px-4 py-8 text-center transition-colors ${
          importing
            ? "cursor-wait border-border bg-background/30"
            : accountSelected
              ? dragging
                ? "cursor-pointer border-foreground bg-foreground/5"
                : "cursor-pointer border-border bg-background/40 hover:border-foreground/50"
              : "cursor-not-allowed border-border bg-background/20"
        }`}
      >
        <p
          className={`text-sm font-medium ${
            accountSelected ? "text-foreground" : "text-muted-foreground"
          }`}
        >
          {accountSelected
            ? "Drop CSV or click to upload"
            : "Select an account before upload"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {selectedAccountLabel
            ? `Importing into ${selectedAccountLabel}`
            : "Choose an existing account or create one above first."}
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={importing || !accountSelected}
          className="hidden"
        />
      </div>

      {status && (
        <p className="text-[0.6rem] text-muted-foreground">{status}</p>
      )}

      {manualState && (
        <ManualMapping
          csvText={manualState.csvText}
          accountName={fileLabelFromSource(manualState.sourceLabel)}
          headers={manualState.headers}
          onMap={(mapping) => {
            const transactions = parseCSVManual(
              manualState.csvText,
              mapping,
              fileLabelFromSource(manualState.sourceLabel),
            );
            setManualState(null);
            void runImport(transactions, null, "manual mapping");
          }}
        />
      )}
    </div>
  );
}

function ManualMapping({
  headers,
  csvText,
  accountName,
  onMap,
}: {
  headers: string[];
  csvText: string;
  accountName: string;
  onMap: (mapping: ColumnMapping) => void;
}) {
  const [date, setDate] = useState(0);
  const [description, setDescription] = useState(1);
  const [amount, setAmount] = useState(2);
  const [category, setCategory] = useState<number | undefined>();
  const [account, setAccount] = useState<number | undefined>();
  const [currency, setCurrency] = useState<number | undefined>();
  const [notes, setNotes] = useState<number | undefined>();

  const mapping = useMemo<ColumnMapping>(
    () => ({
      date,
      description,
      amount,
      ...(category != null ? { category } : {}),
      ...(account != null ? { account } : {}),
      ...(currency != null ? { currency } : {}),
      ...(notes != null ? { notes } : {}),
    }),
    [account, amount, category, currency, date, description, notes],
  );
  const previewRows = useMemo(
    () => parseCSVManual(csvText, mapping, accountName).slice(0, 5),
    [accountName, csvText, mapping],
  );
  const previewOptionalFields = [
    {
      key: "category",
      label: "category",
      enabled:
        category != null &&
        previewRows.some(
          (transaction) => transaction.category !== "uncategorized",
        ),
      value: (transaction: Transaction) => transaction.category,
    },
    {
      key: "account",
      label: "account",
      enabled:
        account != null &&
        previewRows.some((transaction) => transaction.account !== accountName),
      value: (transaction: Transaction) => transaction.account,
    },
    {
      key: "currency",
      label: "currency",
      enabled:
        currency != null &&
        previewRows.some((transaction) => transaction.currency != null),
      value: (transaction: Transaction) =>
        transaction.currency ?? transaction.originalCurrency,
    },
    {
      key: "notes",
      label: "notes",
      enabled:
        notes != null && previewRows.some((transaction) => transaction.notes),
      value: (transaction: Transaction) => transaction.notes ?? "",
    },
  ].filter((field) => field.enabled);

  const selectClass = `${workspacePageStyles.inlineInput} min-w-0 w-full truncate`;

  return (
    <div className="min-w-0 space-y-4 border border-border p-4">
      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
        map columns
      </p>
      <div className="grid gap-2">
        {[
          { label: "date", value: date, set: setDate },
          {
            label: "description",
            value: description,
            set: setDescription,
          },
          { label: "amount", value: amount, set: setAmount },
        ].map(({ label, value, set }) => (
          <label
            key={label}
            className="grid min-w-0 grid-cols-[minmax(5rem,8rem)_minmax(0,1fr)] items-center gap-2"
          >
            <span className="truncate text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </span>
            <select
              value={value}
              onChange={(event) => set(Number(event.target.value))}
              required
              className={selectClass}
            >
              {headers.map((h, i) => (
                <option key={`required-col-${label}-${i}-${h}`} value={i}>
                  {h || `column ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        ))}
        {[
          { label: "category", value: category, set: setCategory },
          { label: "account", value: account, set: setAccount },
          { label: "currency", value: currency, set: setCurrency },
          { label: "notes", value: notes, set: setNotes },
        ].map(({ label, value, set }) => (
          <label
            key={label}
            className="grid min-w-0 grid-cols-[minmax(5rem,8rem)_minmax(0,1fr)] items-center gap-2"
          >
            <span className="truncate text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
              {label}
            </span>
            <select
              value={value ?? ""}
              onChange={(event) => {
                const selected = event.target.value;
                set(selected === "" ? undefined : Number(selected));
              }}
              className={selectClass}
            >
              <option value="">not mapped</option>
              {headers.map((h, i) => (
                <option key={`optional-col-${label}-${i}-${h}`} value={i}>
                  {h || `column ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div className="min-w-0 space-y-1">
        <p className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground">
          preview
        </p>
        {previewRows.length > 0 ? (
          <div className="overflow-x-auto border border-border">
            <table className="min-w-full table-fixed text-left text-[0.65rem]">
              <thead className="bg-muted/30 text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground">
                <tr>
                  {[
                    "date",
                    "description",
                    "amount",
                    ...previewOptionalFields.map((field) => field.label),
                  ].map((label) => (
                    <th key={label} className="px-2 py-1 font-medium">
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((transaction) => (
                  <tr key={transaction.id} className="border-t border-border">
                    <td className="truncate px-2 py-1">{transaction.date}</td>
                    <td className="truncate px-2 py-1">
                      {transaction.description}
                    </td>
                    <td className="truncate px-2 py-1 tabular-nums">
                      {transaction.amount}
                    </td>
                    {previewOptionalFields.map((field) => (
                      <td key={field.key} className="truncate px-2 py-1">
                        {field.value(transaction)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="border border-border px-2 py-2 text-[0.65rem] text-muted-foreground">
            no valid rows with this mapping
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onMap(mapping)}
        className={workspacePageStyles.outlineButton}
      >
        apply mapping
      </button>
    </div>
  );
}
