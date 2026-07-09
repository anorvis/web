import type {
  CalendarEvent,
  LifePriorityTask,
  LifeSnapshot,
} from "@/types/workspace";
import type {
  Account,
  Event,
  FinanceData,
  HealthData,
  LifeData,
  Meal,
  Position,
  Session,
  Todo,
  Transaction,
  Workout,
} from "./model";

type NativeHealthDashboard = {
  macroProfile: unknown | null;
  recentMeals: Array<{
    id: string;
    name: string;
    loggedAt: string;
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
    notes: string | null;
  }>;
  recentWorkouts: Array<{
    id: string;
    title: string;
    startedAt: string;
    durationSeconds: number;
    exercises: Array<{
      title: string;
      sets: Array<{ reps: number | null; weightKg: number | null }>;
    }>;
  }>;
};

type AlpacaPortfolio = {
  equity: number;
  positions: Array<{ symbol: string; qty: number; marketValue: number }>;
};

type ImportedTransaction = {
  id: string;
  importFingerprint?: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  account: string;
  originalCurrency: "CAD" | "USD" | "BTC";
};

function nowIso() {
  return new Date().toISOString();
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function isoFromCalendarEvent(event: CalendarEvent, minute: number) {
  const date = new Date(`${event.date}T00:00:00`);
  date.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
  return date.toISOString();
}

function priorityFromTask(task: LifePriorityTask): Todo["priority"] {
  if (task.priority === "urgent" || task.priority === "high") return "high";
  if (task.priority === "low") return "low";
  return "medium";
}

export function lifeFromSources(input: {
  snapshot?: LifeSnapshot | null;
  calendarEvents?: CalendarEvent[] | null;
}): LifeData {
  const snapshot = input.snapshot;
  const calendarEvents =
    input.calendarEvents ?? snapshot?.weekCalendarEvents ?? [];
  const createdAt = nowIso();
  const tagNames = Array.from(
    new Set(
      [
        ...calendarEvents.map((event) => event.tag ?? event.source ?? null),
        ...(snapshot?.queue.map((task) => task.source) ?? []),
        "google calendar",
        "task",
        "focus",
      ].filter((value): value is string => !!value),
    ),
  );
  const tags = tagNames.map((name, index) => ({
    id: name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    name,
    color: ["#60a5fa", "#34d399", "#f59e0b", "#f472b6", "#a78bfa"][index % 5],
  }));
  const tagId = (name?: string | null) =>
    name ? tags.find((tag) => tag.name === name)?.id : undefined;

  const events: Array<Event | Todo | Session> = calendarEvents.map((event) => {
    const sourceTag = tagId(event.tag ?? event.source ?? "google calendar");
    const base = {
      id: event.id,
      title: event.summary,
      tagIds: sourceTag ? [sourceTag] : [],
      startAt: event.allDay
        ? undefined
        : isoFromCalendarEvent(event, event.startMinute),
      endAt: event.allDay
        ? undefined
        : isoFromCalendarEvent(event, event.endMinute),
      allDay: event.allDay,
      timezone: snapshot?.timezoneLabel,
      createdAt,
      updatedAt: createdAt,
    };

    if (event.type === "plannedTask") {
      return {
        ...base,
        type: "session",
        todoIds: event.taskId ? [event.taskId] : [],
        mode: "focus",
      };
    }

    if (event.type === "taskDeadline") {
      return {
        ...base,
        type: "todo",
        dueAt: isoFromCalendarEvent(event, 12 * 60),
        priority: "medium",
      };
    }

    return {
      ...base,
      type: "event",
      location: event.location ?? undefined,
      notes: event.description ?? undefined,
    };
  });

  const existingTodoIds = new Set(
    events.filter((block) => block.type === "todo").map((block) => block.id),
  );
  const todos: Todo[] =
    snapshot?.queue
      .filter((task) => !existingTodoIds.has(task.id))
      .map((task) => {
        const sourceTag = tagId(task.source);
        return {
          id: task.id,
          type: "todo",
          title: task.title,
          notes: task.notes ?? undefined,
          tagIds: sourceTag ? [sourceTag] : [],
          dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : undefined,
          priority: priorityFromTask(task),
          createdAt,
          updatedAt: createdAt,
        };
      }) ?? [];

  const sessions: Session[] =
    snapshot?.queue.flatMap((task) => {
      if (!task.scheduledStart || !task.scheduledEnd) return [];
      const sourceTag = tagId(task.source);
      const focusTag = tagId("focus");
      return [
        {
          id: `session-${task.id}`,
          type: "session",
          title: task.title,
          notes: task.prepSummary ?? undefined,
          tagIds: [sourceTag, focusTag].filter((id): id is string => !!id),
          startAt: task.scheduledStart,
          endAt: task.scheduledEnd,
          timezone: snapshot.timezoneLabel,
          createdAt,
          updatedAt: createdAt,
          todoIds: [task.id],
          mode: "focus",
        },
      ];
    }) ?? [];

  return { tags, timeBlocks: [...events, ...todos, ...sessions] };
}

export function healthFromDashboard(
  dashboard?: NativeHealthDashboard | null,
): HealthData {
  if (!dashboard) return { workouts: [], meals: [] };
  const createdAt = nowIso();
  const workouts: Workout[] = dashboard.recentWorkouts.map((workout) => ({
    id: workout.id,
    title: workout.title,
    startAt: workout.startedAt,
    endAt: new Date(
      Date.parse(workout.startedAt) + workout.durationSeconds * 1000,
    ).toISOString(),
    exercises: workout.exercises.map((exercise) => ({
      title: exercise.title,
      muscleGroups: [],
      sets: exercise.sets.map((set) => ({
        reps: set.reps ?? undefined,
        weightKg: set.weightKg ?? undefined,
      })),
    })),
    createdAt,
    updatedAt: createdAt,
  }));
  const meals: Meal[] = dashboard.recentMeals.map((meal) => ({
    id: meal.id,
    title: meal.name,
    time: meal.loggedAt,
    notes: meal.notes ?? undefined,
    macro: {
      calories: meal.calories,
      protein: meal.proteinGrams,
      carbs: meal.carbsGrams,
      fat: meal.fatGrams,
    },
    createdAt,
    updatedAt: createdAt,
  }));
  return { workouts, meals };
}

export function financeFromPortfolio(
  portfolio?: AlpacaPortfolio | null,
): FinanceData {
  if (!portfolio)
    return {
      accounts: [],
      categories: defaultCategories(),
      transactions: [],
      positions: [],
    };
  const updatedAt = nowIso();
  const accounts: Account[] = [
    {
      id: "portfolio",
      name: "portfolio",
      type: "investment",
      currency: "USD",
      balance: portfolio.equity,
      updatedAt,
    },
  ];
  const positions: Position[] = portfolio.positions.map((position) => ({
    id: `position-${position.symbol}`,
    accountId: "portfolio",
    symbol: position.symbol,
    quantity: position.qty,
    marketValue: position.marketValue,
    currency: "USD",
    updatedAt,
  }));
  return {
    accounts,
    categories: defaultCategories(),
    transactions: [],
    positions,
  };
}

export function financeFromImportedTransactions(
  transactions: ImportedTransaction[],
  balance: number | null,
): FinanceData {
  const createdAt = nowIso();
  const accountId = `csv-${slug(transactions[0]?.account ?? "import")}`;
  const accounts: Account[] = [
    {
      id: accountId,
      name: transactions[0]?.account ?? "csv import",
      type: "checking",
      currency: transactions[0]?.originalCurrency ?? "USD",
      balance: balance ?? undefined,
      updatedAt: createdAt,
    },
  ];
  const categories = defaultCategories();
  const importedCategories = Array.from(
    new Set(transactions.map((tx) => tx.category)),
  ).map((name) => ({
    id: `csv-${slug(name)}`,
    name,
    group: "spending" as const,
  }));
  const allCategories = [...categories, ...importedCategories];
  const modelTransactions: Transaction[] = transactions.map((tx) => ({
    id: tx.id,
    importFingerprint: tx.importFingerprint,
    title: tx.description,
    amount: tx.amount,
    currency: tx.originalCurrency,
    time: tx.date,
    accountId,
    categoryId: importedCategories.find(
      (category) => category.name === tx.category,
    )?.id,
    status: "posted",
    createdAt,
    updatedAt: createdAt,
  }));
  return {
    accounts,
    categories: allCategories,
    transactions: modelTransactions,
    positions: [],
  };
}

function defaultCategories() {
  return [
    {
      id: "income",
      name: "income",
      group: "income" as const,
      color: "#34d399",
    },
    {
      id: "spending",
      name: "spending",
      group: "spending" as const,
      color: "#fb7185",
    },
    {
      id: "investing",
      name: "investing",
      group: "investing" as const,
      color: "#a78bfa",
    },
  ];
}
