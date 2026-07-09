import { describe, expect, it } from "vitest";
import {
  taskPlanToCalendarEvents,
  taskPlanToPriorityQueue,
} from "./task-plan-adapters";
import type { TaskPlan } from "./task-plan-types";

const FUTURE_DUE = "2099-01-02T09:00:00";
const PAST_DUE = "2000-01-01T00:00:00";
const SESSION_START = "2026-03-17T09:30:00";
const SESSION_END = "2026-03-17T10:30:00";

type PlanTask = TaskPlan["tasks"][number];
type PlanSession = TaskPlan["sessions"][number];

function makeTask(overrides: Partial<PlanTask> & { id: string }): PlanTask {
  const { id, ...rest } = overrides;
  return {
    id,
    title: `task ${id}`,
    notes: null,
    status: "open",
    priority: "normal",
    dueAt: null,
    source: "manual",
    sourceId: null,
    durationMinutes: null,
    links: [],
    multiSession: false,
    completedAt: null,
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
    ...rest,
  };
}

function makeSession(
  overrides: Partial<PlanSession> & { id: string; taskId: string },
): PlanSession {
  const { id, taskId, ...rest } = overrides;
  return {
    id,
    taskId,
    startAt: SESSION_START,
    endAt: SESSION_END,
    status: "planned",
    source: "manual",
    createdAt: "2026-03-16T00:00:00.000Z",
    updatedAt: "2026-03-16T00:00:00.000Z",
    ...rest,
  };
}

function makePlan(overrides: Partial<TaskPlan> = {}): TaskPlan {
  return {
    tasks: [],
    sessions: [],
    prepPackages: [],
    ...overrides,
  };
}

describe("taskPlanToPriorityQueue", () => {
  it("uses the new dueAt task field", () => {
    const plan = makePlan({
      tasks: [makeTask({ id: "t1", dueAt: FUTURE_DUE })],
    });

    const [task] = taskPlanToPriorityQueue(plan);

    expect(task.dueAt).toBe(Date.parse(FUTURE_DUE));
    expect(task.label).toBe("scheduled");
    expect(task.dueContext.startsWith("by ")).toBe(true);
  });

  it("marks past dueAt tasks overdue", () => {
    const plan = makePlan({
      tasks: [makeTask({ id: "t1", dueAt: PAST_DUE })],
    });

    const [task] = taskPlanToPriorityQueue(plan);

    expect(task.dueAt).toBe(Date.parse(PAST_DUE));
    expect(task.label).toBe("overdue");
  });

  it("uses new startAt/endAt planned sessions", () => {
    const plan = makePlan({
      tasks: [makeTask({ id: "t1" })],
      sessions: [makeSession({ id: "s1", taskId: "t1" })],
    });

    const [task] = taskPlanToPriorityQueue(plan);

    expect(task.scheduledStart).toBe(SESSION_START);
    expect(task.scheduledEnd).toBe(SESSION_END);
  });

  it("ignores non-planned sessions", () => {
    const plan = makePlan({
      tasks: [makeTask({ id: "t1" })],
      sessions: [makeSession({ id: "s1", taskId: "t1", status: "completed" })],
    });

    const [task] = taskPlanToPriorityQueue(plan);

    expect(task.scheduledStart).toBeNull();
    expect(task.scheduledEnd).toBeNull();
  });
});

describe("taskPlanToCalendarEvents", () => {
  it("emits a task deadline event from new dueAt", () => {
    const plan = makePlan({
      tasks: [makeTask({ id: "t1", title: "deadline", dueAt: SESSION_START })],
    });

    const deadlines = taskPlanToCalendarEvents(plan).filter(
      (event) => event.type === "taskDeadline" && event.taskId === "t1",
    );

    expect(deadlines).toHaveLength(1);
    expect(deadlines[0].summary).toBe("deadline");
    expect(deadlines[0].date).toBe("2026-03-17");
    expect(deadlines[0].allDay).toBe(true);
  });

  it("emits a planned task event from new session fields", () => {
    const plan = makePlan({
      tasks: [makeTask({ id: "t1", title: "session task" })],
      sessions: [makeSession({ id: "s1", taskId: "t1" })],
    });

    const planned = taskPlanToCalendarEvents(plan).filter(
      (event) => event.type === "plannedTask" && event.taskId === "t1",
    );

    expect(planned).toHaveLength(1);
    expect(planned[0].summary).toBe("session task");
    expect(planned[0].startMinute).toBe(9 * 60 + 30);
    expect(planned[0].endMinute).toBe(10 * 60 + 30);
  });

  it("skips completed sessions", () => {
    const plan = makePlan({
      tasks: [makeTask({ id: "t1" })],
      sessions: [makeSession({ id: "s1", taskId: "t1", status: "completed" })],
    });

    const planned = taskPlanToCalendarEvents(plan).filter(
      (event) => event.type === "plannedTask",
    );

    expect(planned).toHaveLength(0);
  });
});
