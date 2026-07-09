"use client";

import { calendarStyles } from "@anorvis/ui/styles";
import { memo } from "react";
import type { CalendarEvent } from "@/types/workspace";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MAX_VISIBLE_EVENTS = 3;

function getMonthEventTone(event: CalendarEvent) {
  if (event.type === "taskDeadline") return calendarStyles.monthDeadlineLabel;
  if (event.type === "plannedTask")
    return "border-l-2 border-dashed border-l-teal-500 bg-teal-500/10 pl-1 text-[0.5rem] text-teal-800 dark:text-teal-100 truncate leading-tight";
  if (event.type === "focusTime" && event.source === "time-block")
    return "border-l-2 border-l-purple-500 bg-purple-500/10 pl-1 text-[0.5rem] text-purple-800 dark:text-purple-100 truncate leading-tight";
  if (event.source === "google-calendar") {
    return getMonthGoogleTone(event.calendarId ?? event.id);
  }
  const tagTone = getMonthTagTone(event.tag);
  if (tagTone) return tagTone;
  if (event.source === "local") {
    return "truncate border-l-2 border-l-foreground bg-foreground/10 pl-1 text-[0.5rem] leading-tight text-foreground";
  }
  return calendarStyles.monthEventLabel;
}

function getMonthTagTone(tag?: string | null) {
  switch (tag?.toLowerCase()) {
    case "work":
      return "truncate border-l-2 border-l-sky-500 bg-sky-500/10 pl-1 text-[0.5rem] leading-tight text-sky-700 dark:text-sky-200";
    case "personal":
      return "truncate border-l-2 border-l-violet-500 bg-violet-500/10 pl-1 text-[0.5rem] leading-tight text-violet-700 dark:text-violet-200";
    case "health":
      return "truncate border-l-2 border-l-emerald-500 bg-emerald-500/10 pl-1 text-[0.5rem] leading-tight text-emerald-700 dark:text-emerald-200";
    case "social":
      return "truncate border-l-2 border-l-pink-500 bg-pink-500/10 pl-1 text-[0.5rem] leading-tight text-pink-700 dark:text-pink-200";
    case "travel":
      return "truncate border-l-2 border-l-orange-500 bg-orange-500/10 pl-1 text-[0.5rem] leading-tight text-orange-700 dark:text-orange-200";
    default:
      return "";
  }
}

function getMonthGoogleTone(seed: string) {
  const tones = [
    calendarStyles.monthGoogleLabel,
    "truncate border-l-2 border-l-violet-500 bg-violet-500/10 pl-1 text-[0.5rem] leading-tight text-violet-700 dark:text-violet-200",
    "truncate border-l-2 border-l-emerald-500 bg-emerald-500/10 pl-1 text-[0.5rem] leading-tight text-emerald-700 dark:text-emerald-200",
    "truncate border-l-2 border-l-pink-500 bg-pink-500/10 pl-1 text-[0.5rem] leading-tight text-pink-700 dark:text-pink-200",
    "truncate border-l-2 border-l-orange-500 bg-orange-500/10 pl-1 text-[0.5rem] leading-tight text-orange-700 dark:text-orange-200",
  ];
  const hash = Array.from(seed).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return tones[hash % tones.length];
}

type MonthGridProps = {
  date: Date;
  today: Date;
  events: CalendarEvent[];
  onDayClick: (d: Date) => void;
};

export const MonthGrid = memo(function MonthGrid({
  date,
  today,
  events,
  onDayClick,
}: MonthGridProps) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();
  const totalCells = startOffset + daysInMonth;
  const rowCount = Math.ceil(totalCells / 7);

  const eventsByDay = new Map<number, CalendarEvent[]>();
  for (const ev of events) {
    const [, mStr, dStr] = ev.date.split("-");
    const eMonth = Number(mStr) - 1;
    const eDay = Number(dStr);
    if (eMonth === month) {
      const list = eventsByDay.get(eDay) ?? [];
      list.push(ev);
      eventsByDay.set(eDay, list);
    }
  }

  const isCurrentMonth =
    today.getFullYear() === year && today.getMonth() === month;

  return (
    <div className="flex flex-col h-full">
      {/* Weekday headers */}
      <div className={calendarStyles.monthGrid}>
        {WEEKDAY_LABELS.map((d) => (
          <div key={d} className={calendarStyles.monthHeader}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells — fills remaining space */}
      <div
        className="grid grid-cols-7 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${rowCount}, 1fr)` }}
      >
        {startOffset > 0 &&
          Array.from({ length: startOffset }, (_, idx) => idx).map((n) => (
            <div
              key={`pad-${month}-${n}`}
              className={calendarStyles.monthCell}
            />
          ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const dayEvts = eventsByDay.get(day) ?? [];
          const isToday = isCurrentMonth && today.getDate() === day;
          const overflow = dayEvts.length - MAX_VISIBLE_EVENTS;

          return (
            <button
              key={day}
              type="button"
              onClick={() => onDayClick(new Date(year, month, day))}
              className={`${calendarStyles.monthCell} ${isToday ? calendarStyles.monthCellToday : ""} text-left flex flex-col`}
            >
              <span
                className={
                  isToday
                    ? calendarStyles.monthDayToday
                    : calendarStyles.monthDay
                }
              >
                {day}
              </span>
              <div className="flex-1 min-h-0 overflow-hidden space-y-0.5 mt-0.5">
                {dayEvts.slice(0, MAX_VISIBLE_EVENTS).map((ev) => (
                  <p key={ev.id} className={getMonthEventTone(ev)}>
                    {ev.type === "taskDeadline" ? "due: " : ""}
                    {ev.tag ? `[${ev.tag}] ` : ""}
                    {ev.summary}
                  </p>
                ))}
                {overflow > 0 && (
                  <p className={calendarStyles.monthEventLabel}>
                    +{overflow} more
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
