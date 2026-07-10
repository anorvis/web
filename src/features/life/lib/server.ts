import "server-only";

import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import { getGoogleWorkspaceStatus } from "@/lib/google-workspace";
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
import { platformCalendarEventToUiEvents } from "./calendar-adapters";
import { getWeekStart, toDateString } from "./calendar-utils";
import { resolveTimeZone } from "./google-api";
import {
  taskPlanToCalendarEvents,
  taskPlanToPriorityQueue,
} from "./task-plan-adapters";
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
    doNow: "Open the life workspace.",
    doNext: "Connect calendar/task context through Anorvis OS.",
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
  const filteredTaskEvents = taskEvents.filter((event) => {
    const eventDate = new Date(`${event.date}T12:00:00`);
    return eventDate >= weekStart && eventDate <= weekEnd;
  });

  try {
    const gatewayEvents = await fetchGatewayCalendarEvents(weekStart, weekEnd);
    return {
      items: [...gatewayEvents, ...filteredTaskEvents],
    };
  } catch {
    return {
      items: [
        ...((await readWorkspaceDocument({
          kind: "summary",
          id: "web-life-calendar-events",
          isValue: isCalendarEventArray,
        })) ?? []),
        ...filteredTaskEvents,
      ],
    };
  }
}

type WebCalendarEventDocument = {
  events: PlatformCalendarEvent[];
};

async function fetchGatewayCalendarEvents(
  timeMin: Date,
  timeMax: Date,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  });
  const payload = await gatewayFetchJson<WebCalendarEventDocument>(
    `/v1/calendar/events?${params.toString()}`,
  );
  return payload.events.flatMap(platformCalendarEventToUiEvents);
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
    if (status.connected) {
      events = _opts?.skipCalendar
        ? taskPlanToCalendarEvents(taskPlan)
        : (await fetchMultiCalendarEvents()).items;
    }
  } catch {
    googleStatus = "unavailable";
  }

  if (googleStatus !== "connected") {
    const calendarEvents = _opts?.skipCalendar
      ? taskPlan
        ? taskPlanToCalendarEvents(taskPlan)
        : []
      : (await fetchMultiCalendarEvents()).items;
    return {
      ...lifeSnapshotFromCalendar(base, calendarEvents, {
        hasGoogleCalendar: false,
        googleCalendarStatus: googleStatus,
        executionScoreStatusText: "local calendar stored through anorvis-os",
      }),
      queue: taskPlanToPriorityQueue(taskPlan),
      googleTasksStatus: "unavailable",
    };
  }

  return {
    ...lifeSnapshotFromCalendar(base, events, {
      hasGoogleCalendar: true,
      googleCalendarStatus: "connected",
      executionScoreStatusText: "google calendar connected through anorvis-os",
    }),
    queue: taskPlanToPriorityQueue(taskPlan),
  };
};

function lifeSnapshotFromCalendar(
  base: LifeSnapshot,
  events: CalendarEvent[],
  status: Pick<
    LifeSnapshot,
    "hasGoogleCalendar" | "googleCalendarStatus" | "executionScoreStatusText"
  >,
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

  const scheduledTodayEvents = todayCalendarEvents
    .filter(
      (event) =>
        !event.allDay &&
        (event.type === "default" ||
          event.type === "focusTime" ||
          event.type === "outOfOffice" ||
          event.type === "plannedTask"),
    )
    .sort((left, right) => left.startMinute - right.startMinute);

  const currentMinute = now.getHours() * 60 + now.getMinutes();
  const currentEvent = scheduledTodayEvents.find(
    (event) =>
      event.startMinute <= currentMinute && event.endMinute >= currentMinute,
  );
  const next =
    scheduledTodayEvents.find((event) => event.startMinute > currentMinute) ??
    null;
  const weekEventCounts = Array.from(
    { length: 7 },
    (_, day) => events.filter((event) => event.dayIndex === day).length,
  );

  return {
    ...base,
    hasGoogleCalendar: status.hasGoogleCalendar,
    googleCalendarStatus: status.googleCalendarStatus,
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
    executionScoreStatusText: status.executionScoreStatusText,
  };
}
