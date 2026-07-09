import type { CalendarEvent } from "@/types/workspace";
import { calendarRangeParams } from "./calendar-query";
import { toDateString, toMonthKey, toWeekKey } from "./calendar-utils";

// ── Cache factory ───────────────────────────────

type CacheEntry<T> = { data: T; at: number };
const CACHE_TTL = 2 * 60_000;

function createCache<T>() {
  const store = new Map<string, CacheEntry<T>>();
  const inflight = new Map<string, Promise<T>>();

  function get(key: string): T | null {
    const entry = store.get(key);
    if (!entry || Date.now() - entry.at > CACHE_TTL) {
      if (entry) store.delete(key);
      return null;
    }
    return entry.data;
  }

  function set(key: string, data: T) {
    store.set(key, { data, at: Date.now() });
  }

  function invalidate(key: string) {
    store.delete(key);
  }

  async function fetchOnce(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = get(key);
    if (cached) return cached;
    const existing = inflight.get(key);
    if (existing) return existing;
    const promise = fetcher()
      .then((data) => {
        set(key, data);
        inflight.delete(key);
        return data;
      })
      .catch((err) => {
        inflight.delete(key);
        throw err;
      });
    inflight.set(key, promise);
    return promise;
  }

  function clear() {
    store.clear();
    inflight.clear();
  }

  return { get, set, invalidate, fetchOnce, clear };
}

export const dayCache = createCache<CalendarEvent[]>();
export const weekCache = createCache<CalendarEvent[]>();
export const monthCache = createCache<CalendarEvent[]>();

// ── Fetchers ────────────────────────────────────

async function fetchCalendar(
  params: URLSearchParams,
): Promise<CalendarEvent[]> {
  const res = await fetch(`/api/life/calendar?${params.toString()}`);
  if (!res.ok) throw new Error(`calendar fetch failed: ${res.status}`);
  const data = await res.json();
  return data.events ?? [];
}

export async function fetchDay(date: Date): Promise<CalendarEvent[]> {
  return fetchCalendar(calendarRangeParams(date, "day"));
}

export async function fetchWeek(date: Date): Promise<CalendarEvent[]> {
  return fetchCalendar(calendarRangeParams(date, "week"));
}

export async function fetchMonth(date: Date): Promise<CalendarEvent[]> {
  return fetchCalendar(calendarRangeParams(date, "month"));
}

// ── Helpers ─────────────────────────────────────

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

export function groupByDay(events: CalendarEvent[]) {
  const days: CalendarEvent[][] = Array.from({ length: 7 }, () => []);
  for (const ev of events) {
    if (ev.dayIndex !== undefined && ev.dayIndex >= 0 && ev.dayIndex < 7) {
      days[ev.dayIndex].push(ev);
    }
  }
  return days.map((evts, i) => ({ key: DAY_KEYS[i], events: evts }));
}

export function invalidateAll(date: Date) {
  dayCache.invalidate(toDateString(date));
  weekCache.invalidate(toWeekKey(date));
  monthCache.invalidate(toMonthKey(date));
}

export function invalidateCalendarCaches() {
  dayCache.clear();
  weekCache.clear();
  monthCache.clear();
}

if (typeof window !== "undefined") {
  window.addEventListener("anorvis:calendar-cache-invalidated", () => {
    invalidateCalendarCaches();
  });
}
