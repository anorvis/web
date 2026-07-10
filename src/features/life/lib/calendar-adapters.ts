import type { CalendarEvent } from "@/types/workspace";
import { toDateString } from "./calendar-utils";
import type { PlatformCalendarEvent } from "./task-plan-types";

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

export function platformCalendarEventToUiEvents(
  event: PlatformCalendarEvent,
): CalendarEvent[] {
  if (!event.allDay) {
    const converted = platformCalendarEventToUiEvent(event);
    return converted ? [converted] : [];
  }
  const start = dateOnlyValue(event.startAt);
  const end = dateOnlyValue(event.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const events: CalendarEvent[] = [];
  const cursor = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const exclusiveEnd = end > start ? end : new Date(start);
  if (exclusiveEnd.getTime() === start.getTime()) {
    exclusiveEnd.setDate(exclusiveEnd.getDate() + 1);
  }
  while (cursor < exclusiveEnd) {
    const date = new Date(cursor);
    events.push({
      id: `${event.id}:${toDateString(date)}`,
      summary: event.summary,
      startMinute: 0,
      endMinute: 1440,
      type: "default",
      dayIndex: date.getDay(),
      date: toDateString(date),
      allDay: true,
      tag: event.tag,
      location: event.location,
      description: event.description,
      source: event.source,
      readOnly: event.readOnly,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return events;
}
function dateOnlyValue(value: string): Date {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function platformCalendarEventToUiEvent(
  event: PlatformCalendarEvent,
): CalendarEvent | null {
  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  const startMinute = minuteOfDay(start);
  return {
    id: event.id,
    summary: event.summary,
    startMinute,
    endMinute: Math.max(startMinute + 1, minuteOfDay(end)),
    type: "default",
    dayIndex: start.getDay(),
    date: toDateString(start),
    tag: event.tag,
    location: event.location,
    description: event.description,
    source: event.source,
    readOnly: event.readOnly,
  };
}
