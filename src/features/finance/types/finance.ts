export type Currency = "CAD" | "USD" | "BTC";

export type BankFormat =
  | "chase_cc"
  | "chase_checking"
  | "td_canada"
  | "wealthsimple";

export type Transaction = {
  id: string;
  date: string; // ISO 8601
  description: string;
  amount: number; // signed: positive = inflow, negative = outflow
  category: string; // Plaid PFC primary category
  account: string;
  source: BankFormat | "manual";
  originalCurrency: Currency;
};

export type ColumnMapping = {
  date: number;
  description: number;
  amount: number;
  category?: number;
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
  equity: number;
};

export type FxRates = Record<string, Record<string, number>>;
