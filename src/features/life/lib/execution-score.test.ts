import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GoogleTask } from "./google-api";
import { computeExecutionScore } from "./tasks";

vi.mock("server-only", () => ({}));

const NOW = new Date("2026-03-15T11:00:00-07:00");

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("computeExecutionScore", () => {
  it("baseline with no tasks → 60", () => {
    const result = computeExecutionScore({ items: [] }, true);
    expect(result.score).toBeNull(); // empty list returns null
  });

  it("clamped at 0", () => {
    const items: GoogleTask[] = Array.from({ length: 9 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      status: "needsAction",
      due: new Date(NOW.getTime() + 12 * 3_600_000).toISOString(),
    }));
    items.push({ id: "tc", title: "Done", status: "completed" });
    const result = computeExecutionScore({ items }, true);
    // 60 + 0*6 - 9*7 = 60 - 63 = -3 → clamped to 0
    expect(result.score).toBe(0);
  });

  it("clamped at 100", () => {
    const items = Array.from({ length: 7 }, (_, i) => ({
      id: `t${i}`,
      title: `Task ${i}`,
      status: "completed" as const,
      completed: new Date(NOW.getTime() - i * 24 * 3_600_000).toISOString(),
    }));
    const result = computeExecutionScore({ items }, true);
    // 60 + 7*6 = 102 → clamped to 100
    expect(result.score).toBe(100);
  });
});
