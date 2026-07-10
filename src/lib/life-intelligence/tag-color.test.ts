import { describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/types/workspace";
import { lifeFromSources } from "./adapters";
import type { LifeData } from "./model";
import { tagColorForName } from "./tag-color";

const HEX_COLOR = /^#[0-9a-f]{6}$/;

function calendarEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "evt",
    summary: "Event",
    startMinute: 540,
    endMinute: 600,
    type: "default",
    date: "2026-07-08",
    ...overrides,
  };
}

// Build a calendar range where each event carries a distinct user tag, in the
// exact order the tags are listed. `lifeFromSources` derives its tag set from
// event order, so this order is what a fragile index-based color scheme would
// key off of.
function rangeWithTags(tags: string[]): CalendarEvent[] {
  return tags.map((tag, index) =>
    calendarEvent({ id: `evt-${index}`, summary: tag, tag }),
  );
}

function colorOf(life: LifeData, tagName: string): string | undefined {
  const tag = life.tags.find((entry) => entry.name === tagName);
  expect(
    tag,
    `tag "${tagName}" should exist in derived life data`,
  ).toBeDefined();
  return tag?.color;
}

// Regression: the calendar renders the same tag across many different visible
// ranges (today / this week / a filtered slice). Its color must be a pure
// function of the tag name, never of the tag's position in the current range.
// An index-based palette assignment (TAG_COLORS[i % n]) would place the shared
// tag at a different slot per range and silently recolor it — exactly the drift
// this file pins.
describe("lifeFromSources tag colors stay pinned to the tag name", () => {
  const SHARED = "Deep Work";

  it("gives a shared tag one color across ranges with different tag sets and order", () => {
    // SHARED sits at index 2 here (after Standup, Lunch)...
    const rangeA = rangeWithTags(["Standup", "Lunch", SHARED, "Commute"]);
    // ...and at index 0 here, among an otherwise disjoint tag set.
    const rangeB = rangeWithTags([SHARED, "Groceries"]);

    const colorA = colorOf(lifeFromSources({ calendarEvents: rangeA }), SHARED);
    const colorB = colorOf(lifeFromSources({ calendarEvents: rangeB }), SHARED);

    expect(colorA).toBe(colorB);
    // Tie the color explicitly to the pure helper so a regression away from
    // name-based coloring (e.g. back to positional assignment) reddens here.
    expect(colorA).toBe(tagColorForName(SHARED));
  });

  it("keeps a tag's color stable when the same events are reordered", () => {
    const tags = [SHARED, "Gym", "Errands"];
    const forward = colorOf(
      lifeFromSources({ calendarEvents: rangeWithTags(tags) }),
      SHARED,
    );
    const reversed = colorOf(
      lifeFromSources({ calendarEvents: rangeWithTags([...tags].reverse()) }),
      SHARED,
    );

    expect(forward).toBe(reversed);
  });
});

describe("tagColorForName", () => {
  // Normalization contract at the helper boundary: differences that a user
  // never intends to be distinct tags — letter case and surrounding
  // whitespace — must collapse to the same color. Each pair is chosen so the
  // *un-normalized* inputs hash to different palette buckets; dropping either
  // `.trim()` or `.toLowerCase()` therefore reddens the matching case.
  const normalizationPairs: Array<[string, string]> = [
    ["Work", "work"],
    ["WORK", "work"],
    ["  work  ", "work"],
    ["\tGym\n", "gym"],
    ["Deep Focus", "deep focus"],
    ["  Errands", "errands"],
    ["MEETING ", "meeting"],
  ];

  it.each(normalizationPairs)(
    "normalizes %j to the same color as %j",
    (variant, canonical) => {
      expect(tagColorForName(variant)).toBe(tagColorForName(canonical));
    },
  );

  // Determinism + range: every input must resolve to a defined palette color
  // (a valid 6-digit hex), and the mapping must not depend on call order or
  // hidden state. The negative-hash names (e.g. "errands", "travel") guard the
  // `Math.abs` in the helper — without it their index goes negative and the
  // lookup yields `undefined`.
  const names = [
    "work",
    "gym",
    "deep focus",
    "errands",
    "reading",
    "meeting",
    "travel",
    "family time",
    "project-x",
    "health",
    "zzzzzzzz",
    "a",
  ];

  it("always resolves to a valid palette color", () => {
    for (const name of names) {
      expect(tagColorForName(name)).toMatch(HEX_COLOR);
    }
  });

  it("is order-independent: interleaving other names never changes a result", () => {
    const baseline: Record<string, string> = Object.fromEntries(
      names.map((name) => [name, tagColorForName(name)]),
    );

    // Hammer the helper in a scrambled, repeating order to expose any
    // round-robin counter or other mutable state that would drift the mapping.
    for (let pass = 0; pass < 3; pass += 1) {
      for (const name of [...names].reverse()) {
        expect(tagColorForName(name)).toBe(baseline[name]);
      }
    }
  });
});
