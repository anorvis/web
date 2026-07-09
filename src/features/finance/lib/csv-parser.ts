import Papa from "papaparse";
import type {
  BankFormat,
  ColumnMapping,
  Currency,
  Transaction,
} from "@/features/finance/types/finance";

// --- Bank profile definitions ---

type MappedRow = {
  date: string;
  description: string;
  amount: number;
  currency?: Currency;
};

type BankProfile = {
  key: BankFormat;
  label: string;
  defaultCurrency: Currency;
  detect: (headers: string[], colCount: number) => boolean;
  map: (row: string[]) => MappedRow | null;
  hasBalance: boolean;
  balanceCol?: number;
};

function parseDate(raw: string): string {
  // MM/DD/YYYY → YYYY-MM-DD
  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    return `${slashMatch[3]}-${slashMatch[1].padStart(2, "0")}-${slashMatch[2].padStart(2, "0")}`;
  }
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  // Fallback: try Date constructor
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return raw;
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(index), 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

function stableTransactionId(
  source: BankFormat | "manual",
  accountName: string,
  fingerprint: string,
  occurrence: number,
): string {
  return `csv-${source}-${stableHash(accountName)}-${stableHash(fingerprint)}-${occurrence}`;
}

function transactionDedupeKey(
  source: BankFormat | "manual",
  accountName: string,
  fingerprint: string,
  occurrence: number,
): string {
  return `csv-${source}-${stableHash(accountName)}-${stableHash(fingerprint)}-${occurrence}`;
}

function nextOccurrence(counts: Map<string, number>, fingerprint: string) {
  const next = (counts.get(fingerprint) ?? 0) + 1;
  counts.set(fingerprint, next);
  return next;
}

const BANK_PROFILES: BankProfile[] = [
  {
    key: "chase_cc",
    label: "Chase Credit Card",
    defaultCurrency: "USD",
    detect: (headers) =>
      headers.some((h) => h.toLowerCase().includes("post date")) &&
      !headers.some((h) => h.toLowerCase().includes("balance")),
    map: (row) => {
      // Chase CC: Transaction Date, Post Date, Description, Category, Type, Amount
      const amount = Number.parseFloat(row[5]);
      if (Number.isNaN(amount)) return null;
      return {
        date: parseDate(row[1]),
        description: row[2]?.trim() ?? "",
        amount: -amount, // Chase CC: positive = charge, negate for outflow
      };
    },
    hasBalance: false,
  },
  {
    key: "chase_checking",
    label: "Chase Checking",
    defaultCurrency: "USD",
    detect: (headers) =>
      headers.some((h) => h.toLowerCase().includes("balance")) &&
      headers.some((h) => h.toLowerCase().includes("type")),
    map: (row) => {
      // Details, Posting Date, Description, Amount, Type, Balance, Check or Slip #
      const amount = Number.parseFloat(row[3]);
      if (Number.isNaN(amount)) return null;
      return {
        date: parseDate(row[1]),
        description: row[2]?.trim() ?? "",
        amount, // Already signed correctly
      };
    },
    hasBalance: true,
    balanceCol: 5,
  },
  {
    key: "td_canada",
    label: "TD Canada Trust",
    defaultCurrency: "CAD",
    detect: (headers, colCount) => {
      // TD has no header row — 5 columns: Date, Description, Debit, Credit, Balance
      // Detect by: no header match + 5 columns + first col looks like a date
      if (colCount !== 5) return false;
      const lowers = headers.map((h) => h.toLowerCase());
      return !lowers.some(
        (h) =>
          h.includes("post") ||
          h.includes("type") ||
          h.includes("transaction type"),
      );
    },
    map: (row) => {
      // Date, Description, Debit, Credit, Balance
      const debit = Number.parseFloat(row[2]) || 0;
      const credit = Number.parseFloat(row[3]) || 0;
      const amount = credit > 0 ? credit : -debit;
      if (debit === 0 && credit === 0) return null;
      return {
        date: parseDate(row[0]),
        description: row[1]?.trim() ?? "",
        amount,
      };
    },
    hasBalance: true,
    balanceCol: 4,
  },
  {
    key: "wealthsimple",
    label: "Wealthsimple Activities",
    defaultCurrency: "CAD",
    detect: (headers) =>
      headers.some((h) => h.toLowerCase().includes("transaction type")),
    map: (row) => {
      // Date, Transaction Type, Description, Amount, Currency, Account, ...
      const amount = Number.parseFloat(row[3]);
      if (Number.isNaN(amount)) return null;
      const txType = row[1]?.toLowerCase() ?? "";
      const signed =
        txType.includes("credit") || txType.includes("dividend")
          ? Math.abs(amount)
          : -Math.abs(amount);
      const csvCurrency = row[4]?.trim().toUpperCase();
      return {
        date: parseDate(row[0]),
        description: row[2]?.trim() ?? "",
        amount: signed,
        currency:
          csvCurrency === "CAD" || csvCurrency === "USD"
            ? csvCurrency
            : undefined,
      };
    },
    hasBalance: false,
  },
];

// --- Auto-detect ---

export type DetectResult =
  | { detected: true; format: BankFormat; label: string }
  | { detected: false };

export function detectBankFormat(csvText: string): DetectResult {
  const preview = Papa.parse<string[]>(csvText, {
    header: false,
    preview: 5,
    skipEmptyLines: true,
  });
  if (preview.data.length === 0) return { detected: false };

  const firstRow = preview.data[0];
  const colCount = firstRow.length;

  for (const profile of BANK_PROFILES) {
    if (profile.detect(firstRow, colCount)) {
      return { detected: true, format: profile.key, label: profile.label };
    }
  }

  return { detected: false };
}

// --- Parse with known format ---

export function parseCSV(
  csvText: string,
  format: BankFormat,
  accountName: string,
): Transaction[] {
  const profile = BANK_PROFILES.find((p) => p.key === format);
  if (!profile) return [];

  const skipHeader = format !== "td_canada";
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const rows = skipHeader ? parsed.data.slice(1) : parsed.data;
  const transactions: Transaction[] = [];
  const occurrenceCounts = new Map<string, number>();

  for (const row of rows) {
    const mapped = profile.map(row);
    if (!mapped) continue;
    const currency = mapped.currency ?? profile.defaultCurrency;
    const fingerprint = [
      mapped.date,
      mapped.description,
      mapped.amount,
      currency,
    ].join("|");
    transactions.push({
      id: stableTransactionId(
        format,
        accountName,
        fingerprint,
        nextOccurrence(occurrenceCounts, fingerprint),
      ),
      importFingerprint: transactionDedupeKey(
        format,
        accountName,
        fingerprint,
        occurrenceCounts.get(fingerprint) ?? 1,
      ),
      date: mapped.date,
      description: mapped.description,
      amount: mapped.amount,
      category: "uncategorized",
      account: accountName,
      source: format,
      originalCurrency: mapped.currency ?? profile.defaultCurrency,
    });
  }

  return transactions;
}

// --- Parse with manual column mapping ---

export function parseCSVManual(
  csvText: string,
  mapping: ColumnMapping,
  accountName: string,
): Transaction[] {
  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  // Skip first row (assumed header)
  const rows = parsed.data.slice(1);
  const transactions: Transaction[] = [];

  const occurrenceCounts = new Map<string, number>();

  for (const row of rows) {
    const amount = Number.parseFloat(row[mapping.amount]);
    if (Number.isNaN(amount)) continue;
    const description = row[mapping.description]?.trim() ?? "";
    const category =
      mapping.category != null
        ? (row[mapping.category]?.trim() ?? "uncategorized")
        : "uncategorized";
    const date = parseDate(row[mapping.date]);
    const fingerprint = [date, description, amount, category, "USD"].join("|");
    transactions.push({
      id: stableTransactionId(
        "manual",
        accountName,
        fingerprint,
        nextOccurrence(occurrenceCounts, fingerprint),
      ),
      importFingerprint: transactionDedupeKey(
        "manual",
        accountName,
        fingerprint,
        occurrenceCounts.get(fingerprint) ?? 1,
      ),
      date,
      description,
      amount,
      category,
      account: accountName,
      source: "manual",
      originalCurrency: "USD",
    });
  }

  return transactions;
}

// --- Get CSV headers for manual mapping UI ---

export function getCSVHeaders(csvText: string): string[] {
  const preview = Papa.parse<string[]>(csvText, {
    header: false,
    preview: 1,
    skipEmptyLines: true,
  });
  return preview.data[0] ?? [];
}

// --- Extract balance from last row (for liquidity) ---

export function extractBalance(
  csvText: string,
  format: BankFormat,
): number | null {
  const profile = BANK_PROFILES.find((p) => p.key === format);
  if (!profile?.hasBalance || profile.balanceCol == null) return null;

  const parsed = Papa.parse<string[]>(csvText, {
    header: false,
    skipEmptyLines: true,
  });

  const rows = format !== "td_canada" ? parsed.data.slice(1) : parsed.data;
  const lastRow = rows[rows.length - 1];
  if (!lastRow) return null;

  const balance = Number.parseFloat(lastRow[profile.balanceCol]);
  return Number.isNaN(balance) ? null : balance;
}
