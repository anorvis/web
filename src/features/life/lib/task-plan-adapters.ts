import type { CalendarEvent, LifeSnapshot } from "@/types/workspace";
import { toDateString } from "./calendar-utils";
import type { TaskPlan } from "./task-plan-types";

function parseTaskDueDate(task: TaskPlan["tasks"][number]) {
  if (!task.dueAt) return null;
  const due = new Date(task.dueAt);
  return Number.isNaN(due.getTime()) ? null : due;
}

export function taskPlanToCalendarEvents(
  plan: TaskPlan | null,
): CalendarEvent[] {
  if (!plan) return [];
  const taskById = new Map(plan.tasks.map((task) => [task.id, task]));
  const deadlines = plan.tasks.flatMap((task) => {
    const due = parseTaskDueDate(task);
    if (task.status !== "open" || !due) return [];
    return [
      {
        id: `task-deadline-${task.id}`,
        summary: task.title,
        startMinute: 0,
        endMinute: 1440,
        type: "taskDeadline",
        dayIndex: due.getDay(),
        date: toDateString(due),
        allDay: true,
        taskId: task.id,
        source: "task",
      } satisfies CalendarEvent,
    ];
  });
  const sessions = plan.sessions.flatMap((session) => {
    if (session.status !== "planned") return [];
    const task = taskById.get(session.taskId);
    const start = new Date(session.startAt);
    const end = new Date(session.endAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const startMinute = start.getHours() * 60 + start.getMinutes();
    const endMinute = Math.max(
      startMinute + 1,
      end.getHours() * 60 + end.getMinutes(),
    );
    const fallbackId = `task-session-${session.taskId}-${toDateString(start)}-${startMinute}-${endMinute}`;
    return [
      {
        id: session.id ?? fallbackId,
        summary: task?.title ?? "planned task",
        startMinute,
        endMinute,
        type: "plannedTask",
        dayIndex: start.getDay(),
        date: toDateString(start),
        taskId: session.taskId,
        sessionId: session.id,
        source: "task",
        readOnly: false,
      } satisfies CalendarEvent,
    ];
  });
  return [...deadlines, ...sessions];
}

export function mergeTaskPlanIntoQueue(
  queue: LifeSnapshot["queue"],
  plan: TaskPlan | null,
): LifeSnapshot["queue"] {
  if (!plan) return queue;
  const metadataByTask = new Map(
    taskPlanToPriorityQueue(plan).map((task) => [task.id, task]),
  );
  const seen = new Set(queue.map((task) => task.id));
  const merged = queue.map((task) => {
    const metadata = metadataByTask.get(task.id);
    if (!metadata) return task;
    return {
      ...task,
      notes: metadata.notes ?? task.notes,
      links: metadata.links ?? task.links,
      durationMinutes: metadata.durationMinutes ?? task.durationMinutes,
      priority: metadata.priority ?? task.priority,
      multiSession: metadata.multiSession ?? task.multiSession,
      scheduledStart: metadata.scheduledStart ?? task.scheduledStart,
      scheduledEnd: metadata.scheduledEnd ?? task.scheduledEnd,
      prepStatus: metadata.prepStatus ?? task.prepStatus,
      prepSummary: metadata.prepSummary ?? task.prepSummary,
      suggestedSteps: metadata.suggestedSteps ?? task.suggestedSteps,
      risksOrQuestions: metadata.risksOrQuestions ?? task.risksOrQuestions,
    };
  });
  for (const metadata of metadataByTask.values()) {
    if (!seen.has(metadata.id)) merged.push(metadata);
  }
  return merged;
}

export function taskPlanToPriorityQueue(
  plan: TaskPlan | null,
): LifeSnapshot["queue"] {
  if (!plan) return [];
  const sessionByTask = new Map(
    plan.sessions
      .filter((session) => session.status === "planned")
      .map((session) => [session.taskId, session]),
  );
  const prepByTask = new Map(plan.prepPackages.map((pkg) => [pkg.taskId, pkg]));
  return plan.tasks
    .filter((task) => task.status === "open")
    .map((task) => {
      const prep = prepByTask.get(task.id);
      const due = parseTaskDueDate(task);
      const dueAt = due?.getTime() ?? null;
      return {
        id: task.id,
        title: task.title,
        source: "anorvis-os",
        dueAt,
        dueContext: due ? `by ${due.toLocaleDateString()}` : "next 7 days",
        label: due
          ? due.getTime() < Date.now()
            ? "overdue"
            : "scheduled"
          : "no date",
        score:
          task.priority === "urgent" ? 3 : task.priority === "high" ? 2 : 1,
        notes: task.notes,
        links: task.links,
        durationMinutes: task.durationMinutes ?? undefined,
        priority: task.priority ?? undefined,
        multiSession: task.multiSession,
        scheduledStart: sessionByTask.get(task.id)?.startAt ?? null,
        scheduledEnd: sessionByTask.get(task.id)?.endAt ?? null,
        prepStatus: prep?.status ?? null,
        prepSummary: prep?.summary ?? null,
        suggestedSteps: prep?.suggestedSteps ?? [],
        risksOrQuestions: prep?.risksOrQuestions ?? [],
      };
    });
}
