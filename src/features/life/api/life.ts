import {
  deleteJson,
  patchJson,
  postJson,
  requestJson,
} from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";
import type { CalendarEvent, LifeSnapshot } from "@/types/workspace";

type CalendarResponse = {
  events: CalendarEvent[];
};

export type CreateEventInput = {
  summary: string;
  startDateTime: string;
  endDateTime: string;
  location?: string;
  description?: string;
  tag?: string;
};

export type UpdateEventInput = {
  id: string;
} & CreateEventInput;

export type MoveTaskSessionInput = {
  id: string;
  start: string;
  end: string;
};

export function fetchLifeSnapshot(): Promise<LifeSnapshot> {
  return runEffect(requestJson<LifeSnapshot>("/api/life/snapshot"));
}

export function fetchCalendarEvents(params: URLSearchParams) {
  return runEffect(
    requestJson<CalendarResponse>(`/api/life/calendar?${params.toString()}`),
  ).then((response) => response.events);
}

export function createCalendarEvent(input: CreateEventInput) {
  return runEffect(postJson<CalendarEvent>("/api/life/events", input));
}

export function updateCalendarEvent(input: UpdateEventInput) {
  return runEffect(
    patchJson<CalendarEvent>(`/api/life/events/${input.id}`, input),
  );
}

export function deleteCalendarEvent(id: string) {
  return runEffect(deleteJson<{ ok: true }>(`/api/life/events/${id}`));
}

export function createTask(input: unknown) {
  return runEffect(postJson<unknown>("/api/life/tasks", input));
}

export function updateTask(id: string, input: unknown) {
  return runEffect(
    patchJson<unknown>(`/api/life/tasks/${encodeURIComponent(id)}`, input),
  );
}

export function completeTask(id: string) {
  return runEffect(patchJson<unknown>("/api/life/tasks", { id }));
}

export function deleteTask(id: string) {
  return runEffect(deleteJson<unknown>(`/api/life/tasks/${id}`));
}

export function moveTaskSession(input: MoveTaskSessionInput) {
  return runEffect(
    patchJson<unknown>(`/api/life/tasks/sessions/${input.id}`, {
      start: input.start,
      end: input.end,
    }),
  );
}
