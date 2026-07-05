"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useCallback, useRef, useState } from "react";
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

type CsvImportProps = {
  onImport: (transactions: Transaction[], balance: number | null) => void;
};

export function CsvImport({ onImport }: CsvImportProps) {
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [manualState, setManualState] = useState<{
    csvText: string;
    headers: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const csvText = e.target?.result as string;
        if (!csvText) return;

        const result: DetectResult = detectBankFormat(csvText);
        if (result.detected) {
          const accountName = file.name.replace(/\.csv$/i, "");
          const transactions = parseCSV(csvText, result.format, accountName);
          const balance = extractBalance(csvText, result.format);
          setStatus(`${result.label} — ${transactions.length} transactions`);
          setManualState(null);
          onImport(transactions, balance);
        } else {
          const headers = getCSVHeaders(csvText);
          setManualState({ csvText, headers });
          setStatus("format not recognized — map columns manually");
        }
      };
      reader.readAsText(file);
    },
    [onImport],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border border-dashed px-4 py-6 text-center cursor-pointer transition-colors ${
          dragging
            ? "border-foreground bg-foreground/5"
            : "border-border hover:border-foreground/50"
        }`}
      >
        <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
          drop csv or click to upload
        </p>
        <p className="text-[0.5rem] text-muted-foreground/50 mt-1">
          chase cc · chase checking · td canada trust · wealthsimple
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {status && (
        <p className="text-[0.6rem] text-muted-foreground">{status}</p>
      )}

      {manualState && (
        <ManualMapping
          headers={manualState.headers}
          onMap={(mapping) => {
            const accountName = "manual import";
            const transactions = parseCSVManual(
              manualState.csvText,
              mapping,
              accountName,
            );
            setStatus(`manual mapping — ${transactions.length} transactions`);
            setManualState(null);
            onImport(transactions, null);
          }}
        />
      )}
    </div>
  );
}

function ManualMapping({
  headers,
  onMap,
}: {
  headers: string[];
  onMap: (mapping: ColumnMapping) => void;
}) {
  const [date, setDate] = useState(0);
  const [description, setDescription] = useState(1);
  const [amount, setAmount] = useState(2);

  const selectClass = `${workspacePageStyles.inlineInput} w-full`;

  return (
    <div className="space-y-2 border border-border p-3">
      <p className="text-[0.6rem] uppercase tracking-[0.3em] text-muted-foreground">
        map columns
      </p>
      {[
        { label: "date", value: date, set: setDate },
        { label: "description", value: description, set: setDescription },
        { label: "amount", value: amount, set: setAmount },
      ].map(({ label, value, set }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground w-20 shrink-0">
            {label}
          </span>
          <select
            value={value}
            onChange={(e) => set(Number(e.target.value))}
            className={selectClass}
          >
            {headers.map((h, i) => (
              <option key={`col-${i}-${h}`} value={i}>
                {h || `column ${i + 1}`}
              </option>
            ))}
          </select>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onMap({ date, description, amount })}
        className={workspacePageStyles.outlineButton}
      >
        apply mapping
      </button>
    </div>
  );
}
