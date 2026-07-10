export type Currency = "CAD" | "USD" | "BTC";

export type BankFormat =
  | "chase_cc"
  | "chase_checking"
  | "td_canada"
  | "wealthsimple";

export type Account = {
  id: string;
  name: string;
  type: "checking" | "savings" | "credit" | "investment" | "crypto" | "loan";
  currency: string;
  balance?: number;
  updatedAt: string;
};

export type Category = {
  id: string;
  name: string;
  group: "income" | "spending" | "transfers" | "debt" | "investing" | "other";
  excludeFromSpending?: boolean;
  color?: string;
};

export type Transaction = {
  id: string;
  importFingerprint?: string;
  date: string; // ISO 8601
  description: string;
  amount: number; // signed: positive = inflow, negative = outflow
  category: string; // Plaid PFC primary category
  account: string;
  source: BankFormat | "manual";
  originalCurrency: Currency;

  // Canonical plan.md fields. Existing CSV import code still uses the legacy
  // presentation fields above while anorvis-os moves toward record IDs.
  title?: string;
  currency?: string;
  time?: string;
  accountId?: string;
  categoryId?: string;
  status?: "pending" | "posted";
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type Position = {
  id: string;
  accountId: string;
  symbol: string;
  name?: string;
  quantity: number;
  marketValue?: number;
  averageCost?: number;
  currency: string;
  updatedAt: string;
};

export type FinanceData = {
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  positions: Position[];
};

export type ColumnMapping = {
  date: number;
  description: number;
  amount: number;
  category?: number;
  account?: number;
  currency?: number;
  notes?: number;
};

export type ScorePillar = {
  key: "cashflow" | "liquidity" | "debtLoad" | "savingsMomentum" | "stability";
  label: string;
  score: number | null;
  weight: number;
  detail: string;
  trend: "up" | "down" | "stable" | null;
};

export type StabilityScore = {
  overall: number;
  pillars: ScorePillar[];
  nudge: string;
};

export type MonthlySummary = {
  month: string; // YYYY-MM
  income: number;
  expenses: number;
  net: number;
  savingsRate: number;
};

export type RecurringExpense = {
  merchant: string;
  monthlyCost: number;
  cadence: "weekly" | "biweekly" | "monthly" | "quarterly";
  lastDate: string;
  amount: number;
};

export type AlpacaPosition = {
  symbol: string;
  qty: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPc: number;
};

export type AlpacaPortfolio = {
  equity: number;
  cash: number;
  positions: AlpacaPosition[];
};

export type PortfolioHistoryPoint = {
  date: string;
  netWorth?: number;
  equity: number;
};

export type FxRates = Record<string, Record<string, number>>;
