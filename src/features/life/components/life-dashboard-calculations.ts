import { toDateString } from "@/features/life/lib/calendar-utils";
import type { Session, Tag, TimeBlock } from "@/lib/life-intelligence/model";
import type { CalendarEvent } from "@/types/workspace";

function scheduledSessionKey(input: {
  taskId: string;
  date: string;
  startMinute: number;
  endMinute: number;
}) {
  return `${input.taskId}|${input.date}|${input.startMinute}|${input.endMinute}`;
}

export function sessionBlockKey(block: Session) {
  const taskId = block.todoIds[0];
  if (!taskId || !block.startAt || !block.endAt) return null;
  const start = new Date(block.startAt);
  const end = new Date(block.endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return scheduledSessionKey({
    taskId,
    date: toDateString(start),
    startMinute: start.getHours() * 60 + start.getMinutes(),
    endMinute: Math.max(
      start.getHours() * 60 + start.getMinutes() + 1,
      end.getHours() * 60 + end.getMinutes(),
    ),
  });
}

export function plannedSessionKeys(events: CalendarEvent[]) {
  return new Set(
    events.flatMap((event) =>
      event.type === "plannedTask" && event.taskId
        ? [
            scheduledSessionKey({
              taskId: event.taskId,
              date: event.date,
              startMinute: event.startMinute,
              endMinute: event.endMinute,
            }),
          ]
        : [],
    ),
  );
}

export function rangeFor(date: Date, mode: "day" | "week" | "month") {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  if (mode === "week") start.setDate(start.getDate() - start.getDay());
  if (mode === "month") start.setDate(1);
  const end = new Date(start);
  if (mode === "day") end.setDate(end.getDate() + 1);
  if (mode === "week") end.setDate(end.getDate() + 7);
  if (mode === "month") end.setMonth(end.getMonth() + 1);
  return { start, end };
}

function blockTime(block: TimeBlock) {
  const value = block.startAt ?? block.dueAt ?? block.endAt;
  return value ? Date.parse(value) : Number.NaN;
}

export function blockInRange(block: TimeBlock, start: Date, end: Date) {
  const time = blockTime(block);
  return !Number.isNaN(time) && time >= start.getTime() && time < end.getTime();
}

export function calendarEventMatchesFilters(
  event: CalendarEvent,
  selectedTagIds: string[],
  tagById: Map<string, Tag>,
) {
  if (selectedTagIds.length === 0) return true;
  const selectedNames = new Set(
    selectedTagIds.map((id) => tagById.get(id)?.name).filter(Boolean),
  );
  return (
    selectedNames.has(event.tag ?? "") || selectedNames.has(event.source ?? "")
  );
}

export function tagIdFromName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function todoPriorityClass(priority: string | undefined) {
  if (priority === "high" || priority === "urgent") {
    return "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-200";
  }
  if (priority === "medium" || priority === "normal") {
    return "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }
  return "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
}
