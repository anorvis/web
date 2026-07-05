import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/types/workspace";
import { getVisibleRange, layoutEvents } from "./calendar-layout";

function ev(id: string, startMinute: number, endMinute: number): CalendarEvent {
  return {
    id,
    summary: id,
    startMinute,
    endMinute,
    type: "default",
    date: "2026-03-17",
  };
}

function findEvent(events: ReturnType<typeof layoutEvents>, id: string) {
  const event = events.find((entry) => entry.id === id);
  expect(event).toBeDefined();
  return event as NonNullable<typeof event>;
}

describe("layoutEvents", () => {
  it("returns empty array for empty input", () => {
    expect(layoutEvents([])).toEqual([]);
  });

  it("single event gets column=0, totalColumns=1", () => {
    const result = layoutEvents([ev("a", 60, 120)]);
    expect(result).toHaveLength(1);
    expect(result[0].column).toBe(0);
    expect(result[0].totalColumns).toBe(1);
  });

  it("two non-overlapping events each get column=0, totalColumns=1", () => {
    const result = layoutEvents([ev("a", 60, 120), ev("b", 180, 240)]);
    expect(result).toHaveLength(2);
    for (const e of result) {
      expect(e.column).toBe(0);
      expect(e.totalColumns).toBe(1);
    }
  });

  it("adjacent events (end === start) do not overlap", () => {
    const result = layoutEvents([ev("a", 60, 120), ev("b", 120, 180)]);
    expect(result).toHaveLength(2);
    for (const e of result) {
      expect(e.column).toBe(0);
      expect(e.totalColumns).toBe(1);
    }
  });

  it("two overlapping events get columns 0 and 1, totalColumns=2", () => {
    const result = layoutEvents([ev("a", 60, 150), ev("b", 90, 180)]);
    expect(result).toHaveLength(2);
    const cols = result.map((e) => e.column).sort();
    expect(cols).toEqual([0, 1]);
    expect(result[0].totalColumns).toBe(2);
    expect(result[1].totalColumns).toBe(2);
  });

  it("transitive overlap: A-B overlap, B-C overlap, A-C don't — same group", () => {
    // A: 60-150, B: 120-240, C: 200-300
    // A overlaps B (120 < 150), B overlaps C (200 < 240), A doesn't overlap C (150 < 200)
    const result = layoutEvents([
      ev("a", 60, 150),
      ev("b", 120, 240),
      ev("c", 200, 300),
    ]);
    expect(result).toHaveLength(3);
    // All three share one collision group
    for (const e of result) {
      expect(e.totalColumns).toBeGreaterThanOrEqual(2);
    }
    // A and C don't directly overlap so they can reuse column 0
    const a = findEvent(result, "a");
    const b = findEvent(result, "b");
    const c = findEvent(result, "c");
    expect(a.totalColumns).toBe(2);
    expect(b.totalColumns).toBe(2);
    expect(c.totalColumns).toBe(2);
    // A and C can share column 0, B gets column 1
    expect(a.column).toBe(0);
    expect(b.column).toBe(1);
    expect(c.column).toBe(0);
  });

  it("preserves event properties in output", () => {
    const input: CalendarEvent = {
      id: "x",
      summary: "Meeting",
      startMinute: 540,
      endMinute: 600,
      type: "focusTime",
      dayIndex: 2,
      date: "2026-03-19",
    };
    const result = layoutEvents([input]);
    expect(result[0].id).toBe("x");
    expect(result[0].summary).toBe("Meeting");
    expect(result[0].type).toBe("focusTime");
    expect(result[0].dayIndex).toBe(2);
  });

  it("sorts by start time regardless of input order", () => {
    const result = layoutEvents([ev("b", 180, 240), ev("a", 60, 120)]);
    expect(result[0].id).toBe("a");
    expect(result[1].id).toBe("b");
  });

  it("longer events sort first at same start time", () => {
    const result = layoutEvents([ev("short", 60, 90), ev("long", 60, 180)]);
    // "long" should be placed first (column 0)
    const long = findEvent(result, "long");
    expect(long.column).toBe(0);
  });

  it("separate groups get independent totalColumns", () => {
    // Group 1: two overlapping events → totalColumns=2
    // Group 2: one isolated event → totalColumns=1
    const result = layoutEvents([
      ev("a", 60, 150),
      ev("b", 90, 180),
      ev("c", 600, 660),
    ]);
    const a = findEvent(result, "a");
    const b = findEvent(result, "b");
    const c = findEvent(result, "c");
    expect(a.totalColumns).toBe(2);
    expect(b.totalColumns).toBe(2);
    expect(c.totalColumns).toBe(1);
  });
});

describe("getVisibleRange", () => {
  // RANGE_PAD = 15 minutes of visual buffer at top/bottom
  it("returns full 0-24 range with padding", () => {
    const range = getVisibleRange([]);
    expect(range.fromHour).toBe(0);
    expect(range.toHour).toBe(24);
    expect(range.fromMinute).toBe(0); // capped at 0
    expect(range.toMinute).toBe(1440); // capped at 1440
    expect(range.hours).toHaveLength(24);
    expect(range.hours[0]).toBe(0);
    expect(range.hours[23]).toBe(23);
  });

  it("keeps full range when events fall within it", () => {
    const range = getVisibleRange([ev("a", 540, 600)]); // 9am-10am
    expect(range.fromHour).toBe(0);
    expect(range.toHour).toBe(24);
  });

  it("respects custom defaults", () => {
    const range = getVisibleRange([], 9, 17);
    expect(range.fromHour).toBe(9);
    expect(range.toHour).toBe(17);
    expect(range.hours).toHaveLength(8);
  });
});
