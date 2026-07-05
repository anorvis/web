import type { CalendarEvent } from "@/types/workspace";
import { toDateString } from "./calendar-utils";
import type { PlatformCalendarEvent } from "./task-plan-types";

function minuteOfDay(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
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
    source: event.source,
    readOnly: event.readOnly,
  };
}
