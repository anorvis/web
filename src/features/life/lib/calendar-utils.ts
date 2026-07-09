// Shared date/time helpers used by calendar components and fetchers

export function toDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function getWeekStart(date: Date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function toWeekKey(date: Date) {
  return toDateString(getWeekStart(date));
}

const WEEKDAY_LABELS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export type WeekHeaderDay = {
  dateKey: string;
  weekday: string;
  dayOfMonth: number;
};

// Week-view column-header days for the week containing `selectedDate` (Sunday-start).
// Labels come from real dates so `dayOfMonth` reflects the calendar; deriving them
// from the weekday column keys ("sun", ...) reported a day-of-month of 0.
export function weekHeaderDays(selectedDate: Date): WeekHeaderDay[] {
  const weekStart = getWeekStart(selectedDate);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return {
      dateKey: toDateString(date),
      weekday: WEEKDAY_LABELS[date.getDay()],
      dayOfMonth: date.getDate(),
    };
  });
}

export function toMonthKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}`;
}

export function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function minuteToTime(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function formatMinuteRange(startMinute: number, endMinute: number) {
  return `${minuteToTime(startMinute)}–${minuteToTime(endMinute)}`;
}

export function formatHour(h: number) {
  return String(h).padStart(2, "0");
}

export function formatDateLabel(date: Date) {
  return date
    .toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    })
    .toLowerCase();
}

export function formatWeekLabel(date: Date) {
  const sun = getWeekStart(date);
  const sat = new Date(sun);
  sat.setDate(sat.getDate() + 6);
  const fmt = (d: Date) =>
    d
      .toLocaleDateString("en-US", { month: "short", day: "numeric" })
      .toLowerCase();
  return `${fmt(sun)} – ${fmt(sat)}`;
}

export function formatMonthLabel(date: Date) {
  return date
    .toLocaleDateString("en-US", { month: "long", year: "numeric" })
    .toLowerCase();
}
