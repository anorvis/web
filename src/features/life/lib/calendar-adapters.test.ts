import { describe, expect, it } from "vitest";
import { platformCalendarEventToUiEvents } from "./calendar-adapters";
import type { PlatformCalendarEvent } from "./task-plan-types";

function makeEvent(
  overrides: Partial<PlatformCalendarEvent> = {},
): PlatformCalendarEvent {
  return {
    id: "evt",
    summary: "Event",
    startAt: "2026-03-17",
    endAt: "2026-03-17",
    ...overrides,
  };
}

describe("platformCalendarEventToUiEvents", () => {
  it("expands a single-date all-day event into one all-day UI segment", () => {
    const events = platformCalendarEventToUiEvents(
      makeEvent({
        id: "hevy-1",
        summary: "Morning Lift",
        allDay: true,
        startAt: "2026-03-17",
        endAt: "2026-03-17",
      }),
    );

    expect(events).toHaveLength(1);
    expect(events[0].date).toBe("2026-03-17");
    expect(events[0].allDay).toBe(true);
    expect(events[0].startMinute).toBe(0);
    expect(events[0].endMinute).toBe(1440);
  });

  it("expands a multi-date all-day span into one segment per date with an exclusive end and no timezone shift", () => {
    const events = platformCalendarEventToUiEvents(
      makeEvent({
        id: "hevy-week",
        allDay: true,
        startAt: "2026-03-17",
        endAt: "2026-03-20",
      }),
    );

    // End date is exclusive: a 17->20 span covers 17, 18, 19. Local date parsing
    // keeps each segment on its own calendar day regardless of runner timezone.
    expect(events.map((event) => event.date)).toEqual([
      "2026-03-17",
      "2026-03-18",
      "2026-03-19",
    ]);
    expect(events.every((event) => event.allDay === true)).toBe(true);
    expect(events.map((event) => event.id)).toEqual([
      "hevy-week:2026-03-17",
      "hevy-week:2026-03-18",
      "hevy-week:2026-03-19",
    ]);
  });

  it("preserves tag, source, and readOnly on every expanded all-day date", () => {
    const events = platformCalendarEventToUiEvents(
      makeEvent({
        id: "hevy-2",
        allDay: true,
        startAt: "2026-03-17",
        endAt: "2026-03-19",
        tag: "workout",
        source: "hevy",
        readOnly: true,
      }),
    );

    expect(events).toHaveLength(2);
    for (const event of events) {
      expect(event.tag).toBe("workout");
      expect(event.source).toBe("hevy");
      expect(event.readOnly).toBe(true);
    }
  });

  it("keeps a non-all-day workout as a single timed event and preserves source", () => {
    const events = platformCalendarEventToUiEvents(
      makeEvent({
        id: "hevy-3",
        summary: "Bench Session",
        allDay: false,
        startAt: "2026-03-17T09:30:00",
        endAt: "2026-03-17T10:30:00",
        tag: "workout",
        source: "hevy",
        readOnly: true,
      }),
    );

    expect(events).toHaveLength(1);
    expect(events[0].id).toBe("hevy-3");
    expect(events[0].allDay).toBeUndefined();
    expect(events[0].date).toBe("2026-03-17");
    expect(events[0].startMinute).toBe(9 * 60 + 30);
    expect(events[0].endMinute).toBe(10 * 60 + 30);
    expect(events[0].source).toBe("hevy");
    expect(events[0].readOnly).toBe(true);
  });
});
