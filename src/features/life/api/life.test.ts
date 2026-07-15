import { describe, expect, it } from "vitest";
import { workoutEvents } from "./life";

type Workouts = Parameters<typeof workoutEvents>[0];
type Tags = Parameters<typeof workoutEvents>[1];

const started = new Date("2026-07-13T17:00:00");

const hevyWorkout: Workouts[number] = {
  _id: "w1",
  title: "push day",
  startedAt: started.valueOf(),
  durationSeconds: 3600,
  source: "hevy",
};

describe("workoutEvents", () => {
  it("projects hevy workouts as read-only calendar events with the system tag", () => {
    const tags: Tags = [
      {
        _id: "t1",
        name: "Hevy",
        color: "#ef4444",
        systemKey: "hevy",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const [event] = workoutEvents([hevyWorkout], tags);
    expect(event).toMatchObject({
      id: "workout:w1",
      summary: "push day",
      source: "hevy",
      calendarId: "hevy",
      tag: "Hevy",
      tagColor: "#ef4444",
      readOnly: true,
      date: "2026-07-13",
    });
    expect(event.endMinute - event.startMinute).toBe(60);
  });

  it("resolves a collision-renamed integration tag by systemKey", () => {
    const tags: Tags = [
      // A user tag owns the canonical name; the system row was minted renamed.
      { _id: "t1", name: "Hevy", hidden: false, createdAt: 1, updatedAt: 1 },
      {
        _id: "t2",
        name: "Hevy (integration)",
        color: "#ef4444",
        systemKey: "hevy",
        hidden: false,
        createdAt: 1,
        updatedAt: 1,
      },
    ];
    const [event] = workoutEvents([hevyWorkout], tags);
    expect(event.tag).toBe("Hevy (integration)");
    expect(event.tagColor).toBe("#ef4444");
  });

  it("keeps manual workouts off the integration tag", () => {
    const [event] = workoutEvents(
      [{ ...hevyWorkout, _id: "w2", source: "manual" }],
      [],
    );
    expect(event).toMatchObject({
      tag: "health",
      tagColor: null,
      source: "health",
      readOnly: true,
    });
  });
});
