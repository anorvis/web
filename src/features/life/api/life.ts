import { platformCalendarEventToUiEvent } from "@/features/life/lib/calendar-adapters";
import {
  mergeTaskPlanIntoQueue,
  taskPlanToCalendarEvents,
} from "@/features/life/lib/task-plan-adapters";
import type {
  PlatformCalendarEvent,
  TaskPlan,
} from "@/features/life/lib/task-plan-types";
import {
  deleteJson,
  patchJson,
  postJson,
  requestJson,
} from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";
import {
  requestBrowserLocalJson,
  shouldUseBrowserLocalBackend,
} from "@/lib/local-backend-client";
import type { CalendarEvent, LifeSnapshot } from "@/types/workspace";

type CalendarResponse = {
  events: CalendarEvent[];
};

type LocalCalendarResponse = {
  events: PlatformCalendarEvent[];
};
const LIFE_READ_CACHE_TTL_MS = 60_000;
const lifeReadCache = new Map<
  string,
  { expiresAt: number; promise: Promise<unknown> }
>();

export function clearLifeReadCache() {
  lifeReadCache.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("anorvis:life-read-cache-invalidated", () => {
    clearLifeReadCache();
  });
  window.addEventListener("anorvis:calendar-cache-invalidated", () => {
    clearLifeReadCache();
  });
}

function cachedLifeRead<T>(key: string, load: () => Promise<T>): Promise<T> {
  const cached = lifeReadCache.get(key);
  if (cached && cached.expiresAt > Date.now())
    return cached.promise as Promise<T>;
  const promise = load().catch((error) => {
    lifeReadCache.delete(key);
    throw error;
  });
  lifeReadCache.set(key, {
    expiresAt: Date.now() + LIFE_READ_CACHE_TTL_MS,
    promise,
  });
  return promise;
}

function clearAfterLifeMutation<T>(promise: Promise<T>): Promise<T> {
  return promise.finally(clearLifeReadCache);
}

export type CreateEventInput = {
  summary: string;
  startAt: string;
  endAt: string;
  location?: string;
  description?: string;
  tag?: string;
};

export type UpdateEventInput = {
  id: string;
} & CreateEventInput;

function localCalendarEventPayload(input: CreateEventInput) {
  return {
    summary: input.summary,
    startAt: input.startAt,
    endAt: input.endAt,
    location: input.location,
    description: input.description,
    tag: input.tag,
  };
}

export type MoveTaskSessionInput = {
  id: string;
  startAt: string;
  endAt: string;
};
function filterEventsByRange(events: CalendarEvent[], params: URLSearchParams) {
  const timeMin = params.get("timeMin");
  const timeMax = params.get("timeMax");
  const min = timeMin ? new Date(timeMin) : null;
  const max = timeMax ? new Date(timeMax) : null;
  return events.filter((event) => {
    const eventDate = new Date(`${event.date}T12:00:00`);
    if (Number.isNaN(eventDate.getTime())) return false;
    if (min && eventDate < min) return false;
    if (max && eventDate > max) return false;
    return true;
  });
}

async function fetchBrowserLocalTaskPlan() {
  try {
    return await requestBrowserLocalJson<TaskPlan>("/v1/tasks/plan");
  } catch {
    return null;
  }
}

async function fetchBrowserLocalLifeSnapshot() {
  const [snapshot, taskPlan] = await Promise.all([
    requestBrowserLocalJson<LifeSnapshot>("/v1/life/snapshot"),
    fetchBrowserLocalTaskPlan(),
  ]);
  return taskPlan
    ? {
        ...snapshot,
        queue: mergeTaskPlanIntoQueue(snapshot.queue, taskPlan),
      }
    : snapshot;
}

async function fetchBrowserLocalCalendarEvents(params: URLSearchParams) {
  const [response, taskPlan] = await Promise.all([
    requestBrowserLocalJson<LocalCalendarResponse>(
      `/v1/calendar/events?${params.toString()}`,
    ),
    fetchBrowserLocalTaskPlan(),
  ]);
  const calendarEvents = response.events
    .map(platformCalendarEventToUiEvent)
    .filter((event): event is CalendarEvent => event !== null);
  return [
    ...calendarEvents,
    ...filterEventsByRange(taskPlanToCalendarEvents(taskPlan), params),
  ];
}

export function fetchLifeSnapshot(): Promise<LifeSnapshot> {
  return cachedLifeRead("life:snapshot", () => {
    if (shouldUseBrowserLocalBackend()) {
      return fetchBrowserLocalLifeSnapshot();
    }

    return runEffect(requestJson<LifeSnapshot>("/api/life/snapshot"));
  });
}

export function fetchCalendarEvents(params: URLSearchParams) {
  const key = `life:calendar:${params.toString()}`;
  return cachedLifeRead(key, () => {
    if (shouldUseBrowserLocalBackend()) {
      return fetchBrowserLocalCalendarEvents(params);
    }

    return runEffect(
      requestJson<CalendarResponse>(`/api/life/calendar?${params.toString()}`),
    ).then((response) => response.events);
  });
}

export function createCalendarEvent(input: CreateEventInput) {
  clearLifeReadCache();
  if (shouldUseBrowserLocalBackend()) {
    return clearAfterLifeMutation(
      requestBrowserLocalJson<PlatformCalendarEvent>("/v1/calendar/events", {
        method: "POST",
        body: JSON.stringify(localCalendarEventPayload(input)),
      }).then(platformCalendarEventToUiEvent),
    );
  }

  return clearAfterLifeMutation(
    runEffect(postJson<CalendarEvent>("/api/life/events", input)),
  );
}

export function updateCalendarEvent(input: UpdateEventInput) {
  clearLifeReadCache();
  if (shouldUseBrowserLocalBackend()) {
    return clearAfterLifeMutation(
      requestBrowserLocalJson<PlatformCalendarEvent>(
        `/v1/calendar/events/${encodeURIComponent(input.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify(localCalendarEventPayload(input)),
        },
      ).then(platformCalendarEventToUiEvent),
    );
  }

  return clearAfterLifeMutation(
    runEffect(patchJson<CalendarEvent>(`/api/life/events/${input.id}`, input)),
  );
}

export function deleteCalendarEvent(id: string) {
  clearLifeReadCache();
  if (shouldUseBrowserLocalBackend()) {
    return clearAfterLifeMutation(
      requestBrowserLocalJson<{ ok: true }>(
        `/v1/calendar/events/${encodeURIComponent(id)}`,
        { method: "DELETE" },
      ),
    );
  }

  return clearAfterLifeMutation(
    runEffect(deleteJson<{ ok: true }>(`/api/life/events/${id}`)),
  );
}

export function createTask(input: unknown) {
  clearLifeReadCache();
  if (shouldUseBrowserLocalBackend()) {
    return clearAfterLifeMutation(
      requestBrowserLocalJson<unknown>("/v1/tasks", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    );
  }

  return clearAfterLifeMutation(
    runEffect(postJson<unknown>("/api/life/tasks", input)),
  );
}

export function updateTask(id: string, input: unknown) {
  clearLifeReadCache();
  if (shouldUseBrowserLocalBackend()) {
    return clearAfterLifeMutation(
      requestBrowserLocalJson<unknown>(`/v1/tasks/${encodeURIComponent(id)}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    );
  }

  return clearAfterLifeMutation(
    runEffect(
      patchJson<unknown>(`/api/life/tasks/${encodeURIComponent(id)}`, input),
    ),
  );
}

export function completeTask(id: string) {
  clearLifeReadCache();
  if (shouldUseBrowserLocalBackend()) {
    return clearAfterLifeMutation(
      requestBrowserLocalJson<unknown>(
        `/v1/tasks/${encodeURIComponent(id)}/complete`,
        { method: "PATCH" },
      ),
    );
  }

  return clearAfterLifeMutation(
    runEffect(patchJson<unknown>("/api/life/tasks", { id })),
  );
}

export function deleteTask(id: string) {
  clearLifeReadCache();
  if (shouldUseBrowserLocalBackend()) {
    return clearAfterLifeMutation(
      requestBrowserLocalJson<unknown>(`/v1/tasks/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    );
  }

  return clearAfterLifeMutation(
    runEffect(deleteJson<unknown>(`/api/life/tasks/${id}`)),
  );
}

export function moveTaskSession(input: MoveTaskSessionInput) {
  clearLifeReadCache();
  if (shouldUseBrowserLocalBackend()) {
    return clearAfterLifeMutation(
      requestBrowserLocalJson<unknown>(
        `/v1/tasks/sessions/${encodeURIComponent(input.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ startAt: input.startAt, endAt: input.endAt }),
        },
      ),
    );
  }

  return clearAfterLifeMutation(
    runEffect(
      patchJson<unknown>(`/api/life/tasks/sessions/${input.id}`, {
        startAt: input.startAt,
        endAt: input.endAt,
      }),
    ),
  );
}
