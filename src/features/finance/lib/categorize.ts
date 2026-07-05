import type {
  RecurringExpense,
  Transaction,
} from "@/features/finance/types/finance";

// --- Plaid PFC Primary Categories (16) ---

const CATEGORY_RULES: [string, RegExp][] = [
  ["income", /payroll|direct dep|salary|income|wage|dividend|interest earned/i],
  ["transfer", /transfer|xfer|zelle|venmo|paypal|e-?transfer|interac/i],
  [
    "rent & utilities",
    /rent|hydro|electric|gas bill|water bill|utility|internet|cable|phone bill|rogers|bell|telus|at&t|comcast|verizon/i,
  ],
  [
    "food & drink",
    /restaurant|uber eats|doordash|grubhub|mcdonald|starbucks|tim horton|subway|chipotle|pizza|sushi|cafe|coffee|dining/i,
  ],
  [
    "groceries",
    /grocery|superstore|walmart|costco|safeway|whole foods|trader joe|loblaws|metro|sobeys|no frills|freshco/i,
  ],
  [
    "transportation",
    /uber(?! eats)|lyft|gas station|shell|esso|petro|chevron|parking|transit|ttc|presto|metro pass/i,
  ],
  [
    "shopping",
    /amazon|ebay|best buy|target|ikea|home depot|canadian tire|shopify|apple\.com|etsy/i,
  ],
  [
    "entertainment",
    /netflix|spotify|disney|hulu|youtube|apple tv|hbo|twitch|steam|playstation|xbox|movie|cinema|theatre/i,
  ],
  [
    "health & wellness",
    /pharmacy|drug mart|walgreens|cvs|shoppers|doctor|dental|medical|gym|fitness|peloton/i,
  ],
  [
    "insurance",
    /insurance|allstate|state farm|geico|progressive|manulife|sun life|great-west/i,
  ],
  [
    "loan payment",
    /mortgage|student loan|auto loan|car payment|navient|sallie mae|nelnet|loan payment/i,
  ],
  [
    "subscriptions",
    /subscription|membership|annual fee|monthly fee|patreon|substack/i,
  ],
  [
    "travel",
    /airline|flight|hotel|airbnb|booking\.com|expedia|air canada|united|delta|marriott/i,
  ],
  ["education", /tuition|university|college|coursera|udemy|textbook|school/i],
  ["personal care", /salon|barber|spa|beauty|sephora|ulta/i],
  ["charitable", /donation|charity|gofundme|united way|red cross/i],
];

export function categorizeTransaction(description: string): string {
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(description)) return category;
  }
  return "other";
}

export function categorizeAll(transactions: Transaction[]): Transaction[] {
  return transactions.map((t) =>
    t.category !== "uncategorized"
      ? t
      : { ...t, category: categorizeTransaction(t.description) },
  );
}

// --- Debt detection (for DTI pillar) ---

const DEBT_KEYWORDS =
  /mortgage|student loan|auto loan|car payment|navient|sallie mae|nelnet|loan payment|car lease/i;

export function isDebtPayment(description: string): boolean {
  return DEBT_KEYWORDS.test(description);
}

// --- Recurring expense detection ---

function normalizeMerchant(description: string): string {
  return description
    .toLowerCase()
    .replace(/[#\d]+$/g, "") // strip trailing numbers/IDs
    .replace(/\s+/g, " ")
    .trim();
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function stddev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

type CadenceBucket = RecurringExpense["cadence"];

function detectCadence(medianDays: number): CadenceBucket | null {
  if (medianDays >= 5 && medianDays <= 9) return "weekly";
  if (medianDays >= 12 && medianDays <= 16) return "biweekly";
  if (medianDays >= 26 && medianDays <= 35) return "monthly";
  if (medianDays >= 85 && medianDays <= 100) return "quarterly";
  return null;
}

export function detectRecurring(
  transactions: Transaction[],
): RecurringExpense[] {
  // Only outflows
  const outflows = transactions.filter((t) => t.amount < 0);

  // Group by normalized merchant
  const groups = new Map<string, Transaction[]>();
  for (const t of outflows) {
    const key = normalizeMerchant(t.description);
    const list = groups.get(key) ?? [];
    list.push(t);
    groups.set(key, list);
  }

  const recurring: RecurringExpense[] = [];

  for (const [merchant, txns] of groups) {
    if (txns.length < 3) continue;

    // Sort by date
    const sorted = [...txns].sort((a, b) => a.date.localeCompare(b.date));

    // Compute intervals in days
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const daysDiff =
        (new Date(sorted[i].date).getTime() -
          new Date(sorted[i - 1].date).getTime()) /
        (1000 * 60 * 60 * 24);
      intervals.push(daysDiff);
    }

    const medianInterval = median(intervals);
    const cadence = detectCadence(medianInterval);
    if (!cadence) continue;

    // Amount consistency: CV < 10%
    const amounts = sorted.map((t) => Math.abs(t.amount));
    const meanAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (meanAmt === 0) continue;
    const cv = stddev(amounts) / meanAmt;
    if (cv >= 0.1) continue;

    recurring.push({
      merchant,
      monthlyCost: Math.round(meanAmt * (30 / medianInterval) * 100) / 100,
      cadence,
      lastDate: sorted[sorted.length - 1].date,
      amount: Math.round(meanAmt * 100) / 100,
    });
  }

  return recurring.sort((a, b) => b.monthlyCost - a.monthlyCost);
}
