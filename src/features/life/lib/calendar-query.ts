import { queryKeys } from "@/lib/query/keys";
import {
  getWeekStart,
  toDateString,
  toMonthKey,
  toWeekKey,
} from "./calendar-utils";

export type CalendarMode = "day" | "week" | "month";

export function calendarQueryKey(mode: CalendarMode, date: Date) {
  const key =
    mode === "day"
      ? toDateString(date)
      : mode === "week"
        ? toWeekKey(date)
        : toMonthKey(date);
  return queryKeys.life.calendar(mode, key);
}

export function calendarRangeParams(date: Date, mode: CalendarMode) {
  const params = new URLSearchParams();
  params.set("view", mode);
  params.set("tz", Intl.DateTimeFormat().resolvedOptions().timeZone);
  if (mode === "day") {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    params.set("timeMin", dayStart.toISOString());
    params.set("timeMax", dayEnd.toISOString());
    params.set("date", toDateString(date));
  } else if (mode === "week") {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    params.set("timeMin", weekStart.toISOString());
    params.set("timeMax", weekEnd.toISOString());
  } else {
    const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
    const monthEnd = new Date(
      date.getFullYear(),
      date.getMonth() + 1,
      0,
      23,
      59,
    );
    params.set("timeMin", monthStart.toISOString());
    params.set("timeMax", monthEnd.toISOString());
  }
  return params;
}
