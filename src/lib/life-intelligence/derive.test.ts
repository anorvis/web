import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CalendarEvent } from "@/types/workspace";
import { timeBlocksToCalendarEvents } from "./derive";
import type { LifeData, Session, Todo } from "./model";

// Local-time strings (no trailing "Z") are parsed as local time by `new Date`,
// so hour/day derivation stays deterministic regardless of the runner timezone.
const CREATED = "2026-07-01T00:00:00";
// 2026-07-08 is a Wednesday -> getDay() === 3 in every timezone for a local string.
const WEDNESDAY = 3;

function toEvent(block: LifeData["timeBlocks"][number]): CalendarEvent {
  const life: LifeData = { tags: [], timeBlocks: [block] };
  const [event] = timeBlocksToCalendarEvents(life);
  expect(event).toBeDefined();
  return event as CalendarEvent;
}

function todo(overrides: Partial<Todo> = {}): Todo {
  return {
    id: "todo-taxes",
    type: "todo",
    title: "File taxes",
    tagIds: [],
    dueAt: "2026-07-08T17:00:00",
    createdAt: CREATED,
    updatedAt: CREATED,
    ...overrides,
  };
}

function session(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-real-1",
    type: "session",
    title: "focus: File taxes",
    tagIds: [],
    startAt: "2026-07-08T13:00:00",
    endAt: "2026-07-08T14:30:00",
    createdAt: CREATED,
    updatedAt: CREATED,
    todoIds: ["task-1"],
    mode: "focus",
    ...overrides,
  };
}

describe("timeBlocksToCalendarEvents", () => {
  it("distinguishes deadline, planned task, and standalone focus blocks by type", () => {
    const life: LifeData = {
      tags: [],
      timeBlocks: [
        todo(),
        session({ id: "sess-real-1", todoIds: ["task-1"] }),
        session({ id: "local-session-1", todoIds: [], title: "focus session" }),
      ],
    };

    const types = timeBlocksToCalendarEvents(life).map((event) => event.type);

    expect(types).toEqual(["taskDeadline", "plannedTask", "focusTime"]);
  });

  describe("todo deadlines", () => {
    it("renders a todo as an all-day taskDeadline anchored to its own id", () => {
      const event = toEvent(todo());

      expect(event.type).toBe("taskDeadline");
      expect(event.allDay).toBe(true);
      expect(event.startMinute).toBe(0);
      expect(event.endMinute).toBe(1440);
      expect(event.taskId).toBe("todo-taxes");
      expect(event.date).toBe("2026-07-08");
      expect(event.dayIndex).toBe(WEDNESDAY);
    });

    it("stays all-day even when the todo carries a start time", () => {
      const event = toEvent(todo({ startAt: "2026-07-08T09:30:00" }));

      expect(event.type).toBe("taskDeadline");
      expect(event.allDay).toBe(true);
      expect(event.startMinute).toBe(0);
      expect(event.endMinute).toBe(1440);
    });
  });

  describe("planned task sessions", () => {
    it("renders a task-linked session as a timed plannedTask carrying its taskId", () => {
      const event = toEvent(
        session({ id: "sess-real-1", todoIds: ["task-1"] }),
      );

      expect(event.type).toBe("plannedTask");
      expect(event.allDay).toBe(false);
      expect(event.startMinute).toBe(13 * 60);
      expect(event.endMinute).toBe(14 * 60 + 30);
      expect(event.taskId).toBe("task-1");
      // A real, persisted session id is editable: it surfaces sessionId and is not read-only.
      expect(event.sessionId).toBe("sess-real-1");
      expect(event.readOnly).toBe(false);
    });

    it("treats a synthetic session-<taskId> block as a read-only placeholder", () => {
      const event = toEvent(
        session({ id: "session-task-1", todoIds: ["task-1"] }),
      );

      expect(event.type).toBe("plannedTask");
      expect(event.taskId).toBe("task-1");
      // Synthetic mirrors of a task must not be independently draggable/editable.
      expect(event.sessionId).toBeUndefined();
      expect(event.readOnly).toBe(true);
    });
  });

  describe("standalone focus sessions", () => {
    it("renders a timer session with no todoIds as a removable focusTime block", () => {
      const event = toEvent(
        session({
          id: "local-session-1751990400000",
          title: "focus session",
          startAt: "2026-07-08T09:00:00",
          endAt: "2026-07-08T10:00:00",
          todoIds: [],
        }),
      );

      expect(event.type).toBe("focusTime");
      // "removable" in the UI means non-read-only and not a task type.
      expect(event.readOnly).toBe(false);
      expect(event.taskId).toBeUndefined();
      expect(event.allDay).toBe(false);
      expect(event.startMinute).toBe(9 * 60);
      expect(event.endMinute).toBe(10 * 60);
    });

    it("treats a persisted session without todoIds as focusTime too", () => {
      const event = toEvent(session({ id: "sess-focus-99", todoIds: [] }));

      expect(event.type).toBe("focusTime");
      expect(event.readOnly).toBe(false);
      expect(event.taskId).toBeUndefined();
    });
  });
});

// Regression: a task's calendar date must be its LOCAL calendar day. The prior
// implementation derived it via `new Date(value).toISOString().slice(0, 10)`, which
// reports the UTC day and pushes late-evening due times to "tomorrow" in any
// behind-UTC timezone — the user-visible "my task date didn't save" bug. These
// cases pin a fixed behind-UTC zone so local-day and UTC-slice actually diverge.
describe("calendar date resolves to the local day, not the UTC slice", () => {
  let originalTZ: string | undefined;

  beforeAll(() => {
    originalTZ = process.env.TZ;
    process.env.TZ = "America/New_York";
    // The distinction only exists west of UTC (positive offset). If the runtime
    // ignored the override, fail loudly rather than pass vacuously.
    if (new Date("2026-07-08T12:00:00Z").getTimezoneOffset() <= 0) {
      throw new Error(
        "TZ override to America/New_York did not take effect; test would be vacuous",
      );
    }
  });

  afterAll(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it("keeps a late-evening local due time on its own day (UTC slice says tomorrow)", () => {
    // 23:59 local on Wed Jul 8. UTC-slice would report 2026-07-09 (03:59Z).
    const event = toEvent(todo({ dueAt: "2026-07-08T23:59:00" }));

    expect(event.date).toBe("2026-07-08");
    expect(event.dayIndex).toBe(WEDNESDAY);
  });

  it("maps a Z-suffixed instant to its local day, not its UTC date", () => {
    // 2026-07-09T02:30Z is 2026-07-08 22:30 in New York; UTC-slice says 2026-07-09.
    const event = toEvent(todo({ dueAt: "2026-07-09T02:30:00Z" }));

    expect(event.date).toBe("2026-07-08");
  });

  it("passes a date-only due string through verbatim (no shift back a day)", () => {
    // Date-only strings parse as UTC midnight; applying local date parts would
    // report 2026-07-07 here. The guard must return the string unchanged.
    const event = toEvent(todo({ dueAt: "2026-07-08" }));

    expect(event.date).toBe("2026-07-08");
  });
});
