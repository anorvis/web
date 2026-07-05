import "server-only";

import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import type { CalendarEvent } from "@/types/workspace";

export type GoogleWorkspaceStatus = {
  connected: boolean;
  hasClientConfig: boolean;
  scopes: string[];
  canAutoRenew?: boolean;
  accessTokenExpiresAt?: number | null;
};

type GoogleCalendarApiEvent = {
  id?: string;
  calendarId?: string;
  status?: string;
  summary?: string;
  eventType?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
};

type GoogleCalendarEventsPayload = {
  events: GoogleCalendarApiEvent[];
};

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getGoogleWorkspaceStatus(): Promise<GoogleWorkspaceStatus> {
  return gatewayFetchJson<GoogleWorkspaceStatus>(
    "/v1/integrations/google/status",
  );
}

export async function startGoogleWorkspaceAuth(input?: {
  scopes?: string[];
  returnTo?: string;
}) {
  return gatewayFetchJson<{ authUrl: string; state: string; scopes: string[] }>(
    "/v1/integrations/google/auth/start",
    {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    },
  );
}

export async function fetchGoogleCalendarEvents(input: {
  timeMin: Date;
  timeMax: Date;
  maxResults?: number;
}): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: input.timeMin.toISOString(),
    timeMax: input.timeMax.toISOString(),
    maxResults: String(input.maxResults ?? 50),
  });
  const payload = await gatewayFetchJson<GoogleCalendarEventsPayload>(
    `/v1/integrations/google/calendar/events?${params.toString()}`,
  );
  return payload.events.flatMap(toCalendarEvent);
}

function toCalendarEvent(event: GoogleCalendarApiEvent): CalendarEvent[] {
  if (event.status === "cancelled") return [];
  const startRaw = event.start?.dateTime ?? event.start?.date;
  const endRaw = event.end?.dateTime ?? event.end?.date ?? startRaw;
  if (!startRaw || !endRaw) return [];

  const allDay = Boolean(event.start?.date && !event.start?.dateTime);
  const start = allDay ? parseGoogleDate(startRaw) : new Date(startRaw);
  const end = allDay ? parseGoogleDate(endRaw) : new Date(endRaw);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  if (allDay) {
    const events: CalendarEvent[] = [];
    const cursor = new Date(start);
    const exclusiveEnd = end > start ? end : new Date(start);
    if (exclusiveEnd.getTime() === start.getTime()) {
      exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
    }
    while (cursor < exclusiveEnd) {
      const date = new Date(cursor);
      events.push({
        id: `${event.id ?? crypto.randomUUID()}:${toDateString(date)}`,
        summary: event.summary || "untitled event",
        startMinute: 0,
        endMinute: 1440,
        type: googleEventType(event),
        dayIndex: date.getDay(),
        date: toDateString(date),
        allDay: true,
        source: "google-calendar",
        calendarId: event.calendarId ?? null,
        readOnly: true,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return events;
  }

  const startMinute = start.getHours() * 60 + start.getMinutes();
  const rawEndMinute = end.getHours() * 60 + end.getMinutes();
  const endMinute = Math.max(
    startMinute + 1,
    Math.min(1440, rawEndMinute || startMinute + 30),
  );

  return [
    {
      id: event.id ?? crypto.randomUUID(),
      summary: event.summary || "untitled event",
      startMinute,
      endMinute,
      type: googleEventType(event),
      dayIndex: start.getDay(),
      date: toDateString(start),
      allDay: false,
      source: "google-calendar",
      calendarId: event.calendarId ?? null,
      readOnly: true,
    },
  ];
}

function parseGoogleDate(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function googleEventType(event: GoogleCalendarApiEvent): CalendarEvent["type"] {
  return event.eventType === "focusTime" || event.eventType === "outOfOffice"
    ? event.eventType
    : "default";
}
