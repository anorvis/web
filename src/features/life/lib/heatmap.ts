import type { HeatmapDay } from "@/types/workspace";
import type { GoogleTask } from "./google-api";

export function getHeatmapIntensity(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count >= 4) return 4;
  return count as 0 | 1 | 2 | 3;
}

function toDayKey(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return parts; // en-CA format is YYYY-MM-DD
}

export function assembleHeatmapData(
  completedTasks: GoogleTask[],
  timezone: string,
  today: Date,
): HeatmapDay[] {
  const completionsByDay = new Map<string, number>();

  for (const task of completedTasks) {
    if (!task.completed) continue;
    const completedDate = new Date(task.completed);
    if (Number.isNaN(completedDate.getTime())) continue;
    const key = toDayKey(completedDate, timezone);
    completionsByDay.set(key, (completionsByDay.get(key) ?? 0) + 1);
  }

  const days: HeatmapDay[] = [];
  for (let i = 90; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = toDayKey(date, timezone);
    const count = completionsByDay.get(key) ?? 0;
    days.push({
      date: key,
      completedCount: count,
      intensity: getHeatmapIntensity(count),
    });
  }

  return days;
}
