import { describe, expect, it, vi } from "vitest";
import type { LifePriorityTask } from "@/types/workspace";
import {
  buildPriorityTasks,
  computePriorityScore,
  formatDueContext,
  getPriorityLabel,
  resolveRightNow,
  sortByPriority,
} from "./priority";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-03-15T11:00:00-07:00").getTime();
const HOUR = 3_600_000;

describe("computePriorityScore", () => {
  it("overdue by 2 days scores 102", () => {
    const dueAt = NOW - 48 * HOUR;
    expect(computePriorityScore(dueAt, NOW)).toBeCloseTo(102.0);
  });

  it("overdue by 6h scores 100.25", () => {
    const dueAt = NOW - 6 * HOUR;
    expect(computePriorityScore(dueAt, NOW)).toBeCloseTo(100.25);
  });

  it("due in 1h scores 0.96", () => {
    const dueAt = NOW + 1 * HOUR;
    expect(computePriorityScore(dueAt, NOW)).toBeCloseTo(24 / 25);
  });

  it("due in 24h scores 0.50", () => {
    const dueAt = NOW + 24 * HOUR;
    expect(computePriorityScore(dueAt, NOW)).toBeCloseTo(0.5);
  });

  it("due in 48h scores 0.333", () => {
    const dueAt = NOW + 48 * HOUR;
    expect(computePriorityScore(dueAt, NOW)).toBeCloseTo(1 / 3);
  });

  it("due in 7d scores 0.125", () => {
    const dueAt = NOW + 168 * HOUR;
    expect(computePriorityScore(dueAt, NOW)).toBeCloseTo(1 / 8);
  });

  it("at exact deadline scores 1.0", () => {
    expect(computePriorityScore(NOW, NOW)).toBeCloseTo(1.0);
  });

  it("no-date task scores 0.01", () => {
    expect(computePriorityScore(null, NOW)).toBe(0.01);
  });
});

describe("getPriorityLabel", () => {
  it("score >= 100 → overdue", () => {
    expect(getPriorityLabel(100)).toBe("overdue");
    expect(getPriorityLabel(102)).toBe("overdue");
  });

  it("score 0.50 → due soon", () => {
    expect(getPriorityLabel(0.5)).toBe("due soon");
  });

  it("score 0.499 → upcoming", () => {
    expect(getPriorityLabel(0.499)).toBe("upcoming");
  });

  it("score 0.10 → upcoming", () => {
    expect(getPriorityLabel(0.1)).toBe("upcoming");
  });

  it("score 0.02 → scheduled", () => {
    expect(getPriorityLabel(0.02)).toBe("scheduled");
  });

  it("score 0.01 → no date", () => {
    expect(getPriorityLabel(0.01)).toBe("no date");
  });
});

describe("sortByPriority", () => {
  it("empty list returns empty", () => {
    expect(sortByPriority([])).toEqual([]);
  });

  it("sorts overdue > due soon > upcoming > no date", () => {
    const tasks: LifePriorityTask[] = [
      {
        id: "1",
        title: "A",
        source: "google tasks",
        dueAt: null,
        dueContext: "",
        label: "no date",
        score: 0.01,
      },
      {
        id: "2",
        title: "B",
        source: "google tasks",
        dueAt: NOW + 24 * HOUR,
        dueContext: "",
        label: "due soon",
        score: 0.5,
      },
      {
        id: "3",
        title: "C",
        source: "google tasks",
        dueAt: NOW - 48 * HOUR,
        dueContext: "",
        label: "overdue",
        score: 102,
      },
      {
        id: "4",
        title: "D",
        source: "google tasks",
        dueAt: NOW + 48 * HOUR,
        dueContext: "",
        label: "upcoming",
        score: 1 / 3,
      },
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["3", "2", "4", "1"]);
  });

  it("tiebreaker: earlier due date wins", () => {
    const score = 0.5;
    const tasks: LifePriorityTask[] = [
      {
        id: "1",
        title: "A",
        source: "google tasks",
        dueAt: NOW + 30 * HOUR,
        dueContext: "",
        label: "due soon",
        score,
      },
      {
        id: "2",
        title: "B",
        source: "google tasks",
        dueAt: NOW + 24 * HOUR,
        dueContext: "",
        label: "due soon",
        score,
      },
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0].id).toBe("2");
  });

  it("tiebreaker: alphabetical when same due", () => {
    const score = 0.5;
    const dueAt = NOW + 24 * HOUR;
    const tasks: LifePriorityTask[] = [
      {
        id: "1",
        title: "Zebra",
        source: "google tasks",
        dueAt,
        dueContext: "",
        label: "due soon",
        score,
      },
      {
        id: "2",
        title: "Alpha",
        source: "google tasks",
        dueAt,
        dueContext: "",
        label: "due soon",
        score,
      },
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted[0].id).toBe("2");
  });

  it("all overdue sorts by most overdue first", () => {
    const tasks: LifePriorityTask[] = [
      {
        id: "1",
        title: "A",
        source: "google tasks",
        dueAt: NOW - 24 * HOUR,
        dueContext: "",
        label: "overdue",
        score: 101,
      },
      {
        id: "2",
        title: "B",
        source: "google tasks",
        dueAt: NOW - 72 * HOUR,
        dueContext: "",
        label: "overdue",
        score: 103,
      },
      {
        id: "3",
        title: "C",
        source: "google tasks",
        dueAt: NOW - 48 * HOUR,
        dueContext: "",
        label: "overdue",
        score: 102,
      },
    ];
    const sorted = sortByPriority(tasks);
    expect(sorted.map((t) => t.id)).toEqual(["2", "3", "1"]);
  });
});

describe("buildPriorityTasks", () => {
  it("single task sorts correctly", () => {
    const result = buildPriorityTasks(
      [{ id: "1", title: "Test", status: "needsAction" }],
      NOW,
    );
    expect(result).toHaveLength(1);
    expect(result[0].label).toBe("no date");
  });
});

describe("formatDueContext", () => {
  it("overdue by 2 days", () => {
    expect(formatDueContext(NOW - 48 * HOUR, NOW)).toBe("overdue by 2d");
  });

  it("overdue by 3 hours", () => {
    expect(formatDueContext(NOW - 3 * HOUR, NOW)).toBe("overdue by 3h");
  });

  it("due in 45 minutes", () => {
    expect(formatDueContext(NOW + 45 * 60_000, NOW)).toBe("due in 45m");
  });

  it("due in 5 hours", () => {
    expect(formatDueContext(NOW + 5 * HOUR, NOW)).toBe("due in 5h");
  });

  it("due tomorrow", () => {
    expect(formatDueContext(NOW + 30 * HOUR, NOW)).toBe("due tomorrow");
  });

  it("due next week shows weekday", () => {
    const result = formatDueContext(NOW + 120 * HOUR, NOW);
    expect(result).toMatch(/^due \w+$/);
  });

  it("no due date", () => {
    expect(formatDueContext(null, NOW)).toBe("no due date");
  });
});

describe("resolveRightNow", () => {
  const task: LifePriorityTask = {
    id: "1",
    title: "Do thing",
    source: "google tasks",
    dueAt: NOW + 3 * HOUR,
    dueContext: "due in 3h",
    label: "due soon",
    score: 0.8,
  };

  it("shows current event when inside event", () => {
    const result = resolveRightNow([task], { summary: "Deep work" }, null);
    expect(result.text).toContain("Deep work");
    expect(result.text).toContain("happening now");
    expect(result.isCalendarEvent).toBe(true);
  });

  it("shows upcoming event within 30min when no overdue", () => {
    const result = resolveRightNow([task], null, {
      summary: "1:1",
      startsInMinutes: 20,
    });
    expect(result.text).toContain("1:1");
    expect(result.text).toContain("20m");
  });

  it("shows overdue task over upcoming event", () => {
    const overdueTask: LifePriorityTask = {
      id: "2",
      title: "Overdue thing",
      source: "google tasks",
      dueAt: NOW - 24 * HOUR,
      dueContext: "overdue by 1d",
      label: "overdue",
      score: 101,
    };
    const result = resolveRightNow([overdueTask], null, {
      summary: "Meeting",
      startsInMinutes: 15,
    });
    expect(result.text).toContain("Overdue thing");
    expect(result.isCalendarEvent).toBe(false);
  });

  it("shows task when no events within 30min", () => {
    const result = resolveRightNow([task], null, null);
    expect(result.text).toContain("Do thing");
    expect(result.isCalendarEvent).toBe(false);
  });
});
