import type { CalendarEvent } from "@/types/workspace";
import type {
  Account,
  Category,
  FinanceData,
  HealthData,
  LifeData,
  Macro,
  TimeBlock,
  Todo,
  Transaction,
} from "./model";
import { LOCAL_FOCUS_SESSION_ID_PREFIX } from "./model";

export function formatCurrency(value: number, currency = "USD") {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  });
}

export function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: "short",
    day: "numeric",
  });
}

export function byTime(a: TimeBlock, b: TimeBlock) {
  return getBlockStart(a) - getBlockStart(b);
}

export function getBlockStart(block: TimeBlock) {
  const value = block.startAt ?? block.dueAt ?? block.createdAt;
  return Date.parse(value);
}

export function getBlockEnd(block: TimeBlock) {
  return Date.parse(
    block.endAt ?? block.startAt ?? block.dueAt ?? block.createdAt,
  );
}
export function todayBlocks(life: LifeData, now = new Date()) {
  const key = datePart(now.toISOString());
  return life.timeBlocks
    .filter((block) => datePart(block.startAt ?? block.dueAt ?? "") === key)
    .sort(byTime);
}

function isOpenTodo(block: LifeData["timeBlocks"][number]): block is Todo {
  return block.type === "todo" && !block.completedAt;
}

export function openTodos(life: LifeData) {
  return life.timeBlocks.filter(isOpenTodo).sort(byTime);
}

export function sessionMinutes(life: LifeData) {
  return life.timeBlocks
    .filter((block) => block.type === "session" && block.startAt && block.endAt)
    .reduce(
      (total, block) =>
        total + Math.max(0, getBlockEnd(block) - getBlockStart(block)) / 60000,
      0,
    );
}

export function macroTotals(health: HealthData): Required<Macro> {
  return health.meals.reduce(
    (total, meal) => ({
      calories: total.calories + (meal.macro?.calories ?? 0),
      protein: total.protein + (meal.macro?.protein ?? 0),
      carbs: total.carbs + (meal.macro?.carbs ?? 0),
      fat: total.fat + (meal.macro?.fat ?? 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function muscleCoverage(health: HealthData) {
  const counts = new Map<string, number>();
  for (const workout of health.workouts) {
    for (const exercise of workout.exercises) {
      for (const muscle of exercise.muscleGroups) {
        counts.set(muscle, (counts.get(muscle) ?? 0) + exercise.sets.length);
      }
    }
  }
  return Array.from(counts.entries())
    .map(([muscle, sets]) => ({ muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

export function netWorth(finance: FinanceData) {
  return finance.accounts.reduce(
    (total, account) => total + (account.balance ?? 0),
    0,
  );
}

export function categoryTotals(finance: FinanceData) {
  const categoryById = new Map(
    finance.categories.map((category) => [category.id, category]),
  );
  const totals = new Map<string, { category: Category; total: number }>();
  for (const transaction of finance.transactions) {
    const category = transaction.categoryId
      ? categoryById.get(transaction.categoryId)
      : undefined;
    if (!category || category.group !== "spending") continue;
    const current = totals.get(category.id) ?? { category, total: 0 };
    current.total += Math.abs(Math.min(0, transaction.amount));
    totals.set(category.id, current);
  }
  return Array.from(totals.values()).sort((a, b) => b.total - a.total);
}

export function monthlyCashflow(finance: FinanceData) {
  return finance.transactions.reduce(
    (summary, transaction) => ({
      income: summary.income + Math.max(0, transaction.amount),
      spending: summary.spending + Math.abs(Math.min(0, transaction.amount)),
      net: summary.net + transaction.amount,
    }),
    { income: 0, spending: 0, net: 0 },
  );
}

export function accountName(finance: FinanceData, transaction: Transaction) {
  const account = transaction.accountId
    ? finance.accounts.find(
        (candidate) => candidate.id === transaction.accountId,
      )
    : undefined;
  return account?.name ?? "unassigned";
}

function datePart(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function minutesSinceMidnight(value: string) {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function firstTagName(life: LifeData, block: TimeBlock) {
  const tag = life.tags.find((candidate) =>
    block.tagIds.includes(candidate.id),
  );
  return tag?.name ?? null;
}

export function timeBlocksToCalendarEvents(life: LifeData): CalendarEvent[] {
  return life.timeBlocks.map((block) => {
    const anchor = block.startAt ?? block.dueAt ?? block.createdAt;
    const isTodo = block.type === "todo";
    const isAllDay = block.allDay || isTodo || !block.startAt;
    const startMinute = isAllDay
      ? 0
      : minutesSinceMidnight(block.startAt ?? anchor);
    const endMinute = isAllDay
      ? 1440
      : block.endAt
        ? minutesSinceMidnight(block.endAt)
        : Math.min(1440, startMinute + 60);

    const taskId =
      block.type === "session"
        ? block.todoIds[0]
        : block.type === "todo"
          ? block.id
          : undefined;
    const hasSyntheticSessionId =
      block.type === "session" && taskId
        ? block.id === `session-${taskId}`
        : false;
    return {
      id: block.id,
      summary: block.title,
      startMinute,
      endMinute: Math.max(startMinute + 1, endMinute),
      type:
        block.type === "todo"
          ? "taskDeadline"
          : block.type === "session"
            ? taskId
              ? "plannedTask"
              : "focusTime"
            : "default",
      dayIndex: new Date(anchor).getDay(),
      date: datePart(anchor),
      allDay: isAllDay,
      taskId,
      sessionId:
        block.type === "session" &&
        !block.id.startsWith(LOCAL_FOCUS_SESSION_ID_PREFIX) &&
        !hasSyntheticSessionId
          ? block.id
          : undefined,
      tag: firstTagName(life, block),
      source: "time-block",
      readOnly:
        block.type === "session" &&
        !!taskId &&
        (block.id.startsWith(LOCAL_FOCUS_SESSION_ID_PREFIX) ||
          hasSyntheticSessionId),
    } satisfies CalendarEvent;
  });
}

export function accountBalance(account: Account) {
  return account.balance === undefined
    ? "unknown"
    : formatCurrency(account.balance, account.currency);
}
