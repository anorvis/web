import "server-only";

import {
  fetchCalendarEvents,
  fetchLifeSnapshot,
} from "@/features/life/api/life";
import type { CalendarEvent, LifeSnapshot } from "@/types/workspace";
import { getWeekStart } from "./calendar-utils";

export async function fetchMultiCalendarEvents(input?: {
  timeMin?: Date;
  timeMax?: Date;
}): Promise<{
  items: CalendarEvent[];
}> {
  const now = new Date();
  const weekStart = input?.timeMin ?? getWeekStart(now);
  const weekEnd = input?.timeMax ?? new Date(weekStart);
  if (!input?.timeMax) weekEnd.setDate(weekEnd.getDate() + 7);
  const params = new URLSearchParams({
    timeMin: weekStart.toISOString(),
    timeMax: weekEnd.toISOString(),
  });
  return { items: await fetchCalendarEvents(params) };
}

export const getLifeSnapshot = async (_opts?: {
  skipCalendar?: boolean;
}): Promise<LifeSnapshot> => fetchLifeSnapshot();
