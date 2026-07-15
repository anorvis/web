import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";
import {
  cachedLifeRead,
  clearAfterLifeMutation,
  clearLifeReadCache,
} from "@/lib/life-intelligence/life-read-cache";
import type {
  CalendarEvent,
  LifePriorityTask,
  LifeSnapshot,
} from "@/types/workspace";

export type LifeTag = {
  id: string;
  name: string;
  color: string | null;
  hidden: boolean;
  system: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateEventInput = {
  summary: string;
  startAt: string;
  endAt: string;
  location?: string;
  description?: string;
  tag?: string;
};

export type UpdateEventInput = { id: string } & CreateEventInput;
export type MoveTaskSessionInput = {
  id: string;
  startAt: string;
  endAt: string;
};

type RawTag = {
  _id: string;
  name: string;
  color?: string;
  systemKey?: string;
  hidden: boolean;
  createdAt: number;
  updatedAt: number;
};

type RawTask = {
  _id: string;
  title: string;
  notes?: string;
  status: "open" | "in_progress" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  dueAt?: number;
  source: string;
  durationMinutes?: number;
  links: string[];
  multiSession: boolean;
  completedAt?: number;
};

type RawSession = {
  _id: string;
  taskId: string;
  startAt: number;
  endAt: number;
};

type RawEvent = {
  _id: string;
  summary: string;
  schedule:
    | { kind: "timed"; startAt: number; endAt: number; timezone?: string }
    | { kind: "all_day"; startDate: string; endDateExclusive: string };
  startDay: string;
  endDay: string;
  location?: string;
  description?: string;
  tag?: string;
  source: string;
  provider?: string;
  calendarId?: string;
  readOnly: boolean;
};

type RawWorkout = {
  _id: string;
  title: string;
  startedAt: number;
  durationSeconds: number;
  source: string;
};

type RawSnapshot = {
  tasks: RawTask[];
  sessions: RawSession[];
  events: RawEvent[];
  tags: RawTag[];
  workouts: RawWorkout[];
};

function day(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const date = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function addDays(value: Date, amount: number): Date {
  const result = new Date(value);
  result.setDate(result.getDate() + amount);
  return result;
}

function minutes(value: number): number {
  const date = new Date(value);
  return date.getHours() * 60 + date.getMinutes();
}

function mapTag(tag: RawTag): LifeTag {
  return {
    id: tag._id,
    name: tag.name,
    color: tag.color ?? null,
    hidden: tag.hidden,
    system: tag.systemKey !== undefined,
    createdAt: new Date(tag.createdAt).toISOString(),
    updatedAt: new Date(tag.updatedAt).toISOString(),
  };
}

function mapEvent(event: RawEvent, tags: RawTag[]): CalendarEvent {
  const tag = tags.find((candidate) => candidate.name === event.tag);
  if (event.schedule.kind === "all_day") {
    return {
      id: event._id,
      summary: event.summary,
      startMinute: 0,
      endMinute: 1440,
      type: "default",
      dayIndex: new Date(`${event.schedule.startDate}T12:00:00`).getDay(),
      date: event.schedule.startDate,
      allDay: true,
      tag: event.tag ?? null,
      tagColor: tag?.color ?? null,
      location: event.location,
      description: event.description,
      source: event.provider === "google" ? "google-calendar" : "local",
      calendarId: event.calendarId ?? null,
      readOnly: event.readOnly,
    };
  }
  const start = new Date(event.schedule.startAt);
  return {
    id: event._id,
    summary: event.summary,
    startMinute: minutes(event.schedule.startAt),
    endMinute: Math.max(
      minutes(event.schedule.endAt),
      minutes(event.schedule.startAt) + 1,
    ),
    type: "default",
    dayIndex: start.getDay(),
    date: day(start),
    tag: event.tag ?? null,
    tagColor: tag?.color ?? null,
    location: event.location,
    description: event.description,
    source: event.provider === "google" ? "google-calendar" : "local",
    calendarId: event.calendarId ?? null,
    readOnly: event.readOnly,
  };
}

export function workoutEvents(
  // Exported for tests: this is the exact projection fetchCalendarEvents and
  // buildLifeSnapshot feed into the calendar.
  workouts: RawWorkout[],
  tags: RawTag[],
): CalendarEvent[] {
  // The Hevy tag row is integration-owned; resolve its actual display name by
  // systemKey (a name collision can mint e.g. "Hevy (integration)").
  const hevy = tags.find((tag) => tag.systemKey === "hevy");
  return workouts.map((workout) => {
    const start = new Date(workout.startedAt);
    const end = new Date(
      workout.startedAt + Math.max(workout.durationSeconds, 1) * 1000,
    );
    const startMinute = minutes(workout.startedAt);
    const fromHevy = workout.source === "hevy";
    return {
      id: `workout:${workout._id}`,
      summary: workout.title,
      startMinute,
      endMinute: Math.max(
        startMinute + 1,
        end.getHours() * 60 + end.getMinutes(),
      ),
      type: "default" as const,
      dayIndex: start.getDay(),
      date: day(start),
      tag: fromHevy ? (hevy?.name ?? "Hevy") : "health",
      tagColor: fromHevy ? (hevy?.color ?? null) : null,
      source: fromHevy ? "hevy" : "health",
      calendarId: fromHevy ? "hevy" : "health",
      readOnly: true,
    };
  });
}

function taskLabel(
  dueAt: number | undefined,
  now: number,
): LifePriorityTask["label"] {
  if (dueAt === undefined) return "no date";
  if (dueAt < now) return "overdue";
  if (dueAt <= now + 24 * 60 * 60 * 1000) return "due soon";
  if (dueAt <= now + 7 * 24 * 60 * 60 * 1000) return "upcoming";
  return "scheduled";
}

function mapTask(task: RawTask, now: number): LifePriorityTask {
  const label = taskLabel(task.dueAt, now);
  const priority = task.priority === "medium" ? "normal" : task.priority;
  const weight = { urgent: 40, high: 30, normal: 20, low: 10 }[
    priority ?? "normal"
  ];
  return {
    id: task._id,
    title: task.title,
    source: task.source,
    dueAt: task.dueAt ?? null,
    dueContext: task.dueAt
      ? new Date(task.dueAt).toLocaleString()
      : "no due date",
    label,
    score: weight + (label === "overdue" ? 50 : label === "due soon" ? 30 : 0),
    notes: task.notes ?? null,
    links: task.links,
    durationMinutes: task.durationMinutes,
    priority,
    multiSession: task.multiSession,
  };
}

function taskEvents(snapshot: RawSnapshot): CalendarEvent[] {
  const tasks = new Map(snapshot.tasks.map((task) => [task._id, task]));
  const sessions = snapshot.sessions.flatMap((session) => {
    const task = tasks.get(session.taskId);
    if (!task) return [];
    const start = new Date(session.startAt);
    return [
      {
        id: `session:${session._id}`,
        summary: task.title,
        startMinute: minutes(session.startAt),
        endMinute: Math.max(
          minutes(session.endAt),
          minutes(session.startAt) + 1,
        ),
        type: "plannedTask" as const,
        dayIndex: start.getDay(),
        date: day(start),
        taskId: task._id,
        sessionId: session._id,
        source: "task" as const,
      },
    ];
  });
  const deadlines = snapshot.tasks.flatMap((task) => {
    if (
      task.dueAt === undefined ||
      task.status === "completed" ||
      task.status === "cancelled"
    )
      return [];
    const due = new Date(task.dueAt);
    return [
      {
        id: `deadline:${task._id}`,
        summary: task.title,
        startMinute: minutes(task.dueAt),
        endMinute: Math.min(1440, minutes(task.dueAt) + 30),
        type: "taskDeadline" as const,
        dayIndex: due.getDay(),
        date: day(due),
        taskId: task._id,
        source: "task" as const,
      },
    ];
  });
  return [...sessions, ...deadlines];
}

async function rawSnapshot(start: Date, end: Date): Promise<RawSnapshot> {
  return convexClient.query(convexApi.life.snapshot, {
    startDay: day(start),
    endDay: day(end),
    startAt: start.valueOf(),
    endAt: end.valueOf(),
  }) as Promise<RawSnapshot>;
}

async function buildLifeSnapshot(): Promise<LifeSnapshot> {
  const now = new Date();
  const weekStart = addDays(
    new Date(now.getFullYear(), now.getMonth(), now.getDate()),
    -now.getDay(),
  );
  const weekEnd = addDays(weekStart, 7);
  const [snapshot, providers] = await Promise.all([
    rawSnapshot(weekStart, weekEnd),
    convexClient.query(convexApi.integrations.list, {}) as Promise<
      Array<{ provider: string; status: string }>
    >,
  ]);
  const providerStatus = (provider: string) =>
    (providers.find((item) => item.provider === provider)?.status ??
      "available") as "connected" | "available" | "unavailable";
  const calendar = snapshot.events.map((event) =>
    mapEvent(event, snapshot.tags),
  );
  const taskCalendar = taskEvents(snapshot);
  const workoutCalendar = workoutEvents(snapshot.workouts, snapshot.tags);
  const weekCalendarEvents = [
    ...calendar,
    ...workoutCalendar,
    ...taskCalendar,
  ].sort(
    (a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute,
  );
  const today = day(now);
  const todayCalendarEvents = weekCalendarEvents.filter(
    (event) => event.date === today,
  );
  const queue = snapshot.tasks
    .filter(
      (task) => task.status !== "completed" && task.status !== "cancelled",
    )
    .map((task) => mapTask(task, now.valueOf()))
    .sort(
      (a, b) =>
        b.score - a.score || (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity),
    );
  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const current = todayCalendarEvents.find(
    (event) =>
      event.startMinute <= currentMinute && event.endMinute > currentMinute,
  );
  const next = todayCalendarEvents.find(
    (event) => event.startMinute > currentMinute,
  );
  const weekEventCounts = Array.from(
    { length: 7 },
    (_, index) =>
      weekCalendarEvents.filter((event) => event.dayIndex === index).length,
  );
  const completedByDay = new Map<string, number>();
  for (const task of snapshot.tasks) {
    if (task.completedAt) {
      const key = day(new Date(task.completedAt));
      completedByDay.set(key, (completedByDay.get(key) ?? 0) + 1);
    }
  }
  const heatmapData = Array.from({ length: 90 }, (_, index) => {
    const date = day(addDays(now, index - 89));
    const completedCount = completedByDay.get(date) ?? 0;
    return {
      date,
      completedCount,
      intensity: Math.min(4, completedCount) as 0 | 1 | 2 | 3 | 4,
    };
  });
  return {
    hasGoogleCalendar: providerStatus("google") === "connected",
    hasGoogleTasks: false,
    hasSpotify: false,
    googleCalendarStatus: providerStatus("google"),
    googleTasksStatus: "unavailable",
    spotifyStatus: "unavailable",
    timezoneLabel: Intl.DateTimeFormat().resolvedOptions().timeZone,
    queue,
    doNow: queue[0]?.title ?? "nothing urgent",
    doNext: queue[1]?.title ?? "queue is clear",
    todayEvents: todayCalendarEvents.map((event) => ({
      id: event.id,
      hour: event.startMinute / 60,
      endHour: event.endMinute / 60,
      summary: event.summary,
      type:
        event.type === "focusTime" || event.type === "outOfOffice"
          ? event.type
          : "default",
    })),
    currentHour: now.getHours(),
    executionScore: null,
    executionScoreStatusText: "tracked locally",
    weekEventCounts,
    weekTotalEvents: weekCalendarEvents.length,
    todayEventCount: todayCalendarEvents.length,
    heatmapData,
    weekGridEvents: weekCalendarEvents.map((event) => ({
      id: event.id,
      day: event.dayIndex ?? new Date(`${event.date}T12:00:00`).getDay(),
      startHour: event.startMinute / 60,
      endHour: event.endMinute / 60,
      label: event.summary,
      kind: event.type === "plannedTask" ? "agent_overlay" : "mandatory",
    })),
    todayCalendarEvents,
    weekCalendarEvents,
    currentEvent: current ? { summary: current.summary } : null,
    nextEvent: next
      ? {
          summary: next.summary,
          startsInMinutes: next.startMinute - currentMinute,
        }
      : null,
  };
}

export function fetchLifeSnapshot(): Promise<LifeSnapshot> {
  return cachedLifeRead("life:snapshot", buildLifeSnapshot);
}

export function fetchCalendarEvents(
  params: URLSearchParams,
): Promise<CalendarEvent[]> {
  const key = `life:calendar:${params.toString()}`;
  return cachedLifeRead(key, async () => {
    const start = new Date(
      params.get("timeMin") ?? Date.now() - 7 * 86_400_000,
    );
    const end = new Date(params.get("timeMax") ?? Date.now() + 7 * 86_400_000);
    const [events, snapshot] = await Promise.all([
      convexClient.query(convexApi.calendar.list, {
        startDay: day(start),
        endDay: day(end),
      }) as Promise<RawEvent[]>,
      rawSnapshot(start, end),
    ]);
    return [
      ...events.map((event) => mapEvent(event, snapshot.tags)),
      ...workoutEvents(snapshot.workouts, snapshot.tags),
      ...taskEvents(snapshot),
    ].sort(
      (a, b) => a.date.localeCompare(b.date) || a.startMinute - b.startMinute,
    );
  });
}

export async function fetchLifeTags(): Promise<LifeTag[]> {
  const tags = (await convexClient.query(convexApi.life.listTags, {
    includeHidden: true,
  })) as RawTag[];
  return tags.map(mapTag);
}

async function getLifeTag(id: string): Promise<LifeTag> {
  const tag = (await fetchLifeTags()).find((candidate) => candidate.id === id);
  if (!tag) throw new Error(`Life tag ${id} was not returned after mutation`);
  return tag;
}

export async function saveLifeTag(input: {
  name: string;
  color?: string | null;
}): Promise<LifeTag> {
  const id = (await convexClient.mutation(convexApi.life.upsertTag, {
    name: input.name,
    color: input.color ?? undefined,
  })) as string;
  return getLifeTag(id);
}

export async function updateLifeTag(
  id: string,
  patch: { name?: string; color?: string | null; hidden?: boolean },
): Promise<LifeTag> {
  await convexClient.mutation(convexApi.life.updateTag, {
    id,
    ...patch,
    color: patch.color ?? undefined,
    clearColor: patch.color === null ? true : undefined,
  });
  return getLifeTag(id);
}

export function hideLifeTag(id: string): Promise<LifeTag> {
  return updateLifeTag(id, { hidden: true });
}

function eventArgs(input: CreateEventInput) {
  return {
    summary: input.summary,
    schedule: {
      kind: "timed" as const,
      startAt: new Date(input.startAt).valueOf(),
      endAt: new Date(input.endAt).valueOf(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    location: input.location,
    description: input.description,
    tag: input.tag,
  };
}

export function createCalendarEvent(input: CreateEventInput) {
  clearLifeReadCache();
  return clearAfterLifeMutation(
    convexClient.mutation(convexApi.calendar.create, eventArgs(input)),
  );
}

export function updateCalendarEvent(input: UpdateEventInput) {
  clearLifeReadCache();
  return clearAfterLifeMutation(
    convexClient.mutation(convexApi.calendar.update, {
      id: input.id,
      ...eventArgs(input),
    }),
  );
}

export function deleteCalendarEvent(id: string) {
  clearLifeReadCache();
  return clearAfterLifeMutation(
    convexClient.mutation(convexApi.calendar.remove, { id }),
  );
}

function taskInput(value: unknown, updating = false): Record<string, unknown> {
  const input = (value && typeof value === "object" ? value : {}) as Record<
    string,
    unknown
  >;
  const dueAt =
    typeof input.dueAt === "string"
      ? new Date(input.dueAt).valueOf()
      : input.dueAt;
  const priority = input.priority === "normal" ? "medium" : input.priority;
  return {
    title: input.title,
    notes: typeof input.notes === "string" ? input.notes : undefined,
    clearNotes: updating && input.notes === null ? true : undefined,
    priority,
    dueAt:
      typeof dueAt === "number" && Number.isFinite(dueAt) ? dueAt : undefined,
    clearDueAt: updating && input.dueAt === null ? true : undefined,
    durationMinutes: input.durationMinutes,
    clearDuration:
      updating && input.durationMinutes === null ? true : undefined,
    links: input.links,
    multiSession: input.multiSession,
  };
}

export function createTask(input: unknown) {
  clearLifeReadCache();
  return clearAfterLifeMutation(
    convexClient.mutation(convexApi.tasks.create, taskInput(input)),
  );
}

export function updateTask(id: string, input: unknown) {
  clearLifeReadCache();
  return clearAfterLifeMutation(
    convexClient.mutation(convexApi.tasks.update, {
      id,
      ...taskInput(input, true),
    }),
  );
}

export function completeTask(id: string) {
  clearLifeReadCache();
  return clearAfterLifeMutation(
    convexClient.mutation(convexApi.tasks.complete, { id }),
  );
}

export function deleteTask(id: string) {
  clearLifeReadCache();
  return clearAfterLifeMutation(
    convexClient.mutation(convexApi.tasks.remove, { id }),
  );
}

export function moveTaskSession(input: MoveTaskSessionInput) {
  clearLifeReadCache();
  return clearAfterLifeMutation(
    convexClient.mutation(convexApi.tasks.moveSession, {
      id: input.id,
      startAt: new Date(input.startAt).valueOf(),
      endAt: new Date(input.endAt).valueOf(),
    }),
  );
}
