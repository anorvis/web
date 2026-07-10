import type { CalendarEvent } from "@/types/workspace";

export function calendarTagColorStyle(event: CalendarEvent) {
  if (!eventUsesTagColor(event)) return {};
  const color = event.tagColor?.trim();
  if (!color) return {};
  return {
    borderLeftColor: color,
    backgroundColor: colorWithAlpha(color, 0.12),
  };
}

export function eventUsesTagColor(event: CalendarEvent) {
  if (!event.tagColor) return false;
  if (event.type === "taskDeadline" || event.type === "plannedTask")
    return false;
  if (event.type === "focusTime" && event.source === "time-block") return false;
  return true;
}

function colorWithAlpha(color: string, alpha: number) {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(color);
  if (!match) return color;
  const [, red, green, blue] = match;
  return `rgba(${Number.parseInt(red, 16)}, ${Number.parseInt(green, 16)}, ${Number.parseInt(blue, 16)}, ${alpha})`;
}
