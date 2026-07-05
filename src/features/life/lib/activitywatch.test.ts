import { describe, expect, it } from "vitest";
import { aggregateByApp, findWindowBucket } from "./activitywatch";

const awBuckets = {
  "aw-watcher-window_MacBook-Pro.local": {
    id: "aw-watcher-window_MacBook-Pro.local",
    type: "currentwindow",
    hostname: "MacBook-Pro.local",
  },
};

const awEvents = [
  {
    timestamp: "2026-03-15T09:00:00Z",
    duration: 3600,
    data: { app: "VS Code", title: "server.ts" },
  },
  {
    timestamp: "2026-03-15T10:00:00Z",
    duration: 1800,
    data: { app: "Firefox", title: "GitHub" },
  },
  {
    timestamp: "2026-03-15T10:30:00Z",
    duration: 900,
    data: { app: "VS Code", title: "tasks.ts" },
  },
  {
    timestamp: "2026-03-15T10:45:00Z",
    duration: 2700,
    data: { app: "Firefox", title: "MDN" },
  },
];

describe("aggregateByApp", () => {
  it("groups events by app name and sums durations", () => {
    const result = aggregateByApp(awEvents);
    expect(result).toEqual([
      { name: "VS Code", hours: 1.3 },
      { name: "Firefox", hours: 1.3 },
    ]);
  });

  it("returns top 2 apps sorted by hours", () => {
    const events = [
      ...awEvents,
      {
        timestamp: "2026-03-15T11:00:00Z",
        duration: 7200,
        data: { app: "Slack", title: "chat" },
      },
      {
        timestamp: "2026-03-15T13:00:00Z",
        duration: 100,
        data: { app: "Terminal", title: "zsh" },
      },
      {
        timestamp: "2026-03-15T13:00:00Z",
        duration: 50,
        data: { app: "Finder", title: "files" },
      },
    ];
    const result = aggregateByApp(events);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("Slack");
  });

  it("handles empty event list", () => {
    const result = aggregateByApp([]);
    expect(result).toEqual([]);
  });

  it("totalHours can be computed from events", () => {
    const totalSeconds = awEvents.reduce((sum, e) => sum + e.duration, 0);
    const totalHours = Math.round((totalSeconds / 3600) * 10) / 10;
    expect(totalHours).toBe(2.5);
  });
});

describe("findWindowBucket", () => {
  it("finds window watcher bucket by prefix", () => {
    expect(findWindowBucket(awBuckets)).toBe(
      "aw-watcher-window_MacBook-Pro.local",
    );
  });

  it("returns null when no window bucket exists", () => {
    expect(
      findWindowBucket({
        "aw-watcher-web_host": {
          id: "aw-watcher-web_host",
          type: "web",
          hostname: "host",
        },
      }),
    ).toBeNull();
  });
});
