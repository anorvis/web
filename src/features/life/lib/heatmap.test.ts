import { describe, expect, it, vi } from "vitest";
import type { GoogleTask } from "./google-api";
import { assembleHeatmapData, getHeatmapIntensity } from "./heatmap";

vi.mock("server-only", () => ({}));

const TODAY = new Date("2026-03-15T11:00:00-07:00");
const TZ = "America/Los_Angeles";

describe("getHeatmapIntensity", () => {
  it("0 → intensity 0", () => expect(getHeatmapIntensity(0)).toBe(0));
  it("1 → intensity 1", () => expect(getHeatmapIntensity(1)).toBe(1));
  it("2 → intensity 2", () => expect(getHeatmapIntensity(2)).toBe(2));
  it("3 → intensity 3", () => expect(getHeatmapIntensity(3)).toBe(3));
  it("4+ → intensity 4", () => {
    expect(getHeatmapIntensity(4)).toBe(4);
    expect(getHeatmapIntensity(5)).toBe(4);
  });
});

describe("assembleHeatmapData", () => {
  it("produces exactly 91 entries", () => {
    const result = assembleHeatmapData([], TZ, TODAY);
    expect(result).toHaveLength(91);
  });

  it("empty task list → all zeros", () => {
    const result = assembleHeatmapData([], TZ, TODAY);
    expect(result.every((d) => d.intensity === 0)).toBe(true);
  });

  it("dates are in chronological order", () => {
    const result = assembleHeatmapData([], TZ, TODAY);
    expect(result[0].date < result[90].date).toBe(true);
  });

  it("1 completion → intensity 1", () => {
    const tasks: GoogleTask[] = [
      {
        id: "1",
        title: "X",
        status: "completed",
        completed: "2026-03-15T10:00:00-07:00",
      },
    ];
    const result = assembleHeatmapData(tasks, TZ, TODAY);
    const todayEntry = result[result.length - 1];
    expect(todayEntry.completedCount).toBe(1);
    expect(todayEntry.intensity).toBe(1);
  });

  it("4+ completions → intensity 4", () => {
    const tasks: GoogleTask[] = Array.from({ length: 5 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      status: "completed",
      completed: `2026-03-15T${10 + i}:00:00-07:00`,
    }));
    const result = assembleHeatmapData(tasks, TZ, TODAY);
    const todayEntry = result[result.length - 1];
    expect(todayEntry.completedCount).toBe(5);
    expect(todayEntry.intensity).toBe(4);
  });

  it("completions grouped by timezone day", () => {
    // 11:30 PM PST on Mar 14 = 6:30 AM UTC on Mar 15
    const tasks: GoogleTask[] = [
      {
        id: "1",
        title: "Late task",
        status: "completed",
        completed: "2026-03-15T06:30:00.000Z",
      },
    ];
    const result = assembleHeatmapData(tasks, TZ, TODAY);
    const mar14 = result.find((d) => d.date === "2026-03-14");
    const mar15 = result.find((d) => d.date === "2026-03-15");
    expect(mar14?.completedCount).toBe(1);
    expect(mar15?.completedCount).toBe(0);
  });

  it("completed task with no due date counts", () => {
    const tasks: GoogleTask[] = [
      {
        id: "1",
        title: "No due",
        status: "completed",
        completed: "2026-03-10T10:00:00-07:00",
      },
    ];
    const result = assembleHeatmapData(tasks, TZ, TODAY);
    const mar10 = result.find((d) => d.date === "2026-03-10");
    expect(mar10?.completedCount).toBe(1);
  });
});
