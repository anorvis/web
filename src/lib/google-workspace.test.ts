import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CalendarEvent } from "@/types/workspace";
import { fetchGoogleCalendarEvents } from "./google-workspace";

vi.mock("server-only", () => ({}));

const gatewayFetchJson = vi.hoisted(() => vi.fn());

vi.mock("@/lib/anorvis-gateway", () => ({
  gatewayFetchJson,
}));

const range = {
  timeMin: new Date("2026-03-16T00:00:00Z"),
  timeMax: new Date("2026-03-23T00:00:00Z"),
};

// Number of whole days between two YYYY-MM-DD strings (UTC-anchored so the
// comparison is timezone-independent even though the strings themselves are
// derived from toISOString()).
function dayGap(earlier: string, later: string): number {
  const a = Date.parse(`${earlier}T00:00:00Z`);
  const b = Date.parse(`${later}T00:00:00Z`);
  return (b - a) / 86_400_000;
}

describe("fetchGoogleCalendarEvents Google event mapping", () => {
  beforeEach(() => {
    gatewayFetchJson.mockReset();
  });

  it('tags a timed Google event with tag "google calendar" and google-calendar source', async () => {
    gatewayFetchJson.mockResolvedValue({
      events: [
        {
          id: "evt-timed",
          summary: "Standup",
          calendarId: "primary",
          start: { dateTime: "2026-03-16T15:00:00Z" },
          end: { dateTime: "2026-03-16T15:30:00Z" },
        },
      ],
    });

    const events = await fetchGoogleCalendarEvents(range);

    expect(events).toHaveLength(1);
    const [event] = events;
    expect(event.tag).toBe("google calendar");
    expect(event.source).toBe("google-calendar");
    expect(event.allDay).toBe(false);
    expect(event.readOnly).toBe(true);
  });

  it('applies tag "google calendar" to every expanded all-day day segment', async () => {
    // Google encodes all-day ranges with an exclusive end date, so
    // 2026-03-16 → 2026-03-18 must expand into exactly two day segments
    // (the 16th and the 17th), each carrying the tag independently.
    gatewayFetchJson.mockResolvedValue({
      events: [
        {
          id: "evt-allday",
          summary: "Conference",
          start: { date: "2026-03-16" },
          end: { date: "2026-03-18" },
        },
      ],
    });

    const events = await fetchGoogleCalendarEvents(range);

    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event.tag).toBe("google calendar");
      expect(event.source).toBe("google-calendar");
      expect(event.allDay).toBe(true);
      expect(event.startMinute).toBe(0);
      expect(event.endMinute).toBe(1440);
      expect(event.readOnly).toBe(true);
    }

    // Distinct, consecutive calendar days — proves the expansion walked the
    // range rather than emitting the same day twice or dropping the boundary.
    const [first, second] = events;
    expect(first.date).not.toBe(second.date);
    expect(dayGap(first.date, second.date)).toBe(1);
    // Each segment id embeds its own date so the two are addressable apart.
    expect(first.id).toBe(`evt-allday:${first.date}`);
    expect(second.id).toBe(`evt-allday:${second.date}`);
  });

  it('tags every event across a mixed timed + all-day payload with "google calendar"', async () => {
    gatewayFetchJson.mockResolvedValue({
      events: [
        {
          id: "evt-timed",
          summary: "Standup",
          start: { dateTime: "2026-03-16T15:00:00Z" },
          end: { dateTime: "2026-03-16T15:30:00Z" },
        },
        {
          id: "evt-allday",
          summary: "Conference",
          start: { date: "2026-03-16" },
          end: { date: "2026-03-18" },
        },
      ],
    });

    const events = await fetchGoogleCalendarEvents(range);

    // 1 timed + 2 expanded all-day segments.
    expect(events).toHaveLength(3);
    expect(
      events.every(
        (event: CalendarEvent) =>
          event.tag === "google calendar" && event.source === "google-calendar",
      ),
    ).toBe(true);
  });
});
