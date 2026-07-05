import "server-only";

import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import {
  fetchGoogleCalendarEvents,
  getGoogleWorkspaceStatus,
} from "@/lib/google-workspace";
import { readWorkspaceDocument } from "@/lib/os-workspace-data";
import {
  isCalendarEventArray,
  isLifeSnapshot,
} from "@/lib/workspace-type-guards";
import type {
  CalendarEvent,
  LifeSnapshot,
  ProviderSetupStatus,
  TodayEvent,
} from "@/types/workspace";
import { platformCalendarEventToUiEvent } from "./calendar-adapters";
import { getWeekStart, toDateString } from "./calendar-utils";
import { resolveTimeZone } from "./google-api";
import type { PlatformCalendarEvent, TaskPlan } from "./task-plan-types";

function localLifeSnapshot(): LifeSnapshot {
  return {
    hasGoogleCalendar: false,
    hasGoogleTasks: false,
    hasSpotify: false,
    googleCalendarStatus: "unavailable",
    googleTasksStatus: "unavailable",
    spotifyStatus: "unavailable",
    timezoneLabel: resolveTimeZone(),
    queue: [],
    doNow: "Open agent chat.",
    doNext: "Use anorvis-os-backed skills for calendar/task context.",
    todayEvents: [],
    currentHour: new Date().getHours(),
    executionScore: null,
    executionScoreStatusText: "local-only mode: no hosted integrations enabled",
    weekEventCounts: [0, 0, 0, 0, 0, 0, 0],
    weekTotalEvents: 0,
    todayEventCount: 0,
    heatmapData: [],
    weekGridEvents: [],
    todayCalendarEvents: [],
    weekCalendarEvents: [],
    currentEvent: null,
    nextEvent: null,
  };
}

export async function fetchMultiCalendarEvents(input?: {
  timeMin?: Date;
  timeMax?: Date;
}): Promise<{
  items: CalendarEvent[];
}> {
  const now = new Date();
  const weekStart = input?.timeMin ?? getWeekStart(now);
  const weekEnd = input?.timeMax ?? new Date(weekStart);
  if (!input?.timeMax) weekEnd.setDate(weekEnd.getDate() + 7);
  const taskEvents = await fetchTaskPlanEvents();
  const localEvents = await fetchLocalWebEvents();
  const filteredTaskEvents = taskEvents.filter((event) => {
    const eventDate = new Date(`${event.date}T12:00:00`);
    return eventDate >= weekStart && eventDate <= weekEnd;
  });
  const filteredLocalEvents = localEvents.filter((event) => {
    const eventDate = new Date(`${event.date}T12:00:00`);
    return eventDate >= weekStart && eventDate <= weekEnd;
  });

  try {
    return {
      items: [
        ...(await fetchGoogleCalendarEvents({
          timeMin: weekStart,
          timeMax: weekEnd,
          maxResults: 250,
        })),
        ...filteredLocalEvents,
        ...filteredTaskEvents,
      ],
    };
  } catch {
    return {
      items: [
        ...((await readWorkspaceDocument({
          kind: "summary",
          id: "web-life-calendar-events",
          isValue: isCalendarEventArray,
        })) ?? []),
        ...filteredLocalEvents,
        ...filteredTaskEvents,
      ],
    };
  }
}

type WebCalendarEventDocument = {
  events: PlatformCalendarEvent[];
};

async function fetchLocalWebEvents(): Promise<CalendarEvent[]> {
  const payload = await gatewayFetchJson<WebCalendarEventDocument>(
    "/v1/calendar/events?includeProviders=false",
  ).catch(() => ({ events: [] }));
  return payload.events
    .map(platformCalendarEventToUiEvent)
    .filter((event): event is CalendarEvent => event !== null);
}

async function fetchTaskPlan(): Promise<TaskPlan | null> {
  try {
    return await gatewayFetchJson<TaskPlan>("/v1/tasks/plan");
  } catch {
    return null;
  }
}

async function fetchTaskPlanEvents(): Promise<CalendarEvent[]> {
  const plan = await fetchTaskPlan();
  return plan ? taskPlanToCalendarEvents(plan) : [];
}

function taskPlanToCalendarEvents(plan: TaskPlan): CalendarEvent[] {
  const deadlines: CalendarEvent[] = plan.tasks.flatMap((task) => {
    if (task.status !== "open" || !task.date) return [];
    const hasExplicitTime = /T\d{2}:\d{2}/.test(task.date);
    const due = hasExplicitTime
      ? new Date(task.date)
      : new Date(`${task.date}T12:00:00`);
    if (Number.isNaN(due.getTime())) return [];
    return [
      {
        id: `task-deadline-${task.id}`,
        summary: task.title,
        startMinute: 0,
        endMinute: 1440,
        type: "taskDeadline",
        dayIndex: due.getDay(),
        date: hasExplicitTime ? toDateString(due) : task.date,
        allDay: true,
        taskId: task.id,
        source: "task",
      },
    ];
  });
  return deadlines;
}

export const getLifeSnapshot = async (_opts?: {
  skipCalendar?: boolean;
}): Promise<LifeSnapshot> => {
  const explicitSnapshot = await readWorkspaceDocument({
    kind: "summary",
    id: "web-life-snapshot",
    isValue: isLifeSnapshot,
  });
  if (explicitSnapshot) return explicitSnapshot;

  const base = localLifeSnapshot();
  const taskPlan = await fetchTaskPlan();
  let googleStatus: ProviderSetupStatus = "unavailable";
  let events: CalendarEvent[] = [];

  try {
    const status = await getGoogleWorkspaceStatus();
    googleStatus = status.connected
      ? "connected"
      : status.hasClientConfig
        ? "available"
        : "unavailable";
    if (status.connected && !_opts?.skipCalendar) {
      events = (await fetchMultiCalendarEvents()).items;
    }
  } catch {
    googleStatus = "unavailable";
  }

  if (googleStatus !== "connected") {
    const taskEvents = taskPlan ? taskPlanToCalendarEvents(taskPlan) : [];
    return {
      ...base,
      queue: taskPlanToPriorityQueue(taskPlan),
      todayCalendarEvents: taskEvents.filter(
        (event) => event.date === toDateString(new Date()),
      ),
      weekCalendarEvents: taskEvents,
      googleCalendarStatus: googleStatus,
      googleTasksStatus: "unavailable",
    };
  }

  return {
    ...lifeSnapshotFromGoogleCalendar(base, events),
    queue: taskPlanToPriorityQueue(taskPlan),
  };
};

function taskPlanToPriorityQueue(plan: TaskPlan | null): LifeSnapshot["queue"] {
  if (!plan) return [];
  const sessionByTask = new Map(
    plan.sessions
      .filter((session) => !session.completed)
      .map((session) => [session.taskId, session]),
  );
  const prepByTask = new Map(plan.prepPackages.map((pkg) => [pkg.taskId, pkg]));
  return plan.tasks
    .filter((task) => task.status === "open")
    .map((task) => {
      const prep = prepByTask.get(task.id);
      const dueAt = task.date ? Date.parse(task.date) : null;
      return {
        id: task.id,
        title: task.title,
        source: "anorvis-os",
        dueAt,
        dueContext: task.date
          ? `by ${new Date(task.date).toLocaleDateString()}`
          : "next 7 days",
        label: task.date
          ? Date.parse(task.date) < Date.now()
            ? "overdue"
            : "scheduled"
          : "no date",
        score:
          task.priority === "urgent" ? 3 : task.priority === "high" ? 2 : 1,
        notes: task.notes,
        links: task.links,
        durationMinutes: task.durationMinutes,
        priority: task.priority,
        multiSession: task.multiSession,
        scheduledStart: sessionByTask.get(task.id)?.start ?? null,
        scheduledEnd: sessionByTask.get(task.id)?.end ?? null,
        conflictState: sessionByTask.get(task.id)?.conflictState ?? null,
        prepStatus: prep?.status ?? null,
        prepSummary: prep?.summary ?? null,
        suggestedSteps: prep?.suggestedSteps ?? [],
        risksOrQuestions: prep?.risksOrQuestions ?? [],
      };
    });
}

function lifeSnapshotFromGoogleCalendar(
  base: LifeSnapshot,
  events: CalendarEvent[],
): LifeSnapshot {
  const now = new Date();
  const todayKey = toDateString(now);
  const todayCalendarEvents = events.filter((event) => event.date === todayKey);
  const todayEvents: TodayEvent[] = todayCalendarEvents
    .filter(
      (event) =>
        event.type === "default" ||
        event.type === "focusTime" ||
        event.type === "outOfOffice",
    )
    .map((event) => ({
      id: event.id,
      hour: Math.floor(event.startMinute / 60),
      endHour: Math.max(
        Math.ceil(event.endMinute / 60),
        Math.floor(event.startMinute / 60) + 1,
      ),
      summary: event.summary,
      type: event.type as TodayEvent["type"],
    }));

  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const currentEvent = todayCalendarEvents.find(
    (event) =>
      event.startMinute <= currentMinute && event.endMinute >= currentMinute,
  );
  const next =
    todayCalendarEvents.find((event) => event.startMinute > currentMinute) ??
    null;
  const weekEventCounts = Array.from(
    { length: 7 },
    (_, day) => events.filter((event) => event.dayIndex === day).length,
  );

  return {
    ...base,
    hasGoogleCalendar: true,
    googleCalendarStatus: "connected",
    todayEvents,
    todayCalendarEvents,
    weekCalendarEvents: events,
    weekEventCounts,
    weekTotalEvents: events.length,
    todayEventCount: todayCalendarEvents.length,
    currentEvent: currentEvent ? { summary: currentEvent.summary } : null,
    nextEvent: next
      ? {
          summary: next.summary,
          startsInMinutes: Math.max(0, next.startMinute - currentMinute),
        }
      : null,
    doNow: currentEvent
      ? currentEvent.summary
      : next
        ? `prep for ${next.summary}`
        : "No calendar event right now.",
    doNext: next
      ? `Upcoming: ${next.summary}`
      : "Review priorities for the day.",
    executionScoreStatusText: "google calendar connected through anorvis-os",
  };
}
