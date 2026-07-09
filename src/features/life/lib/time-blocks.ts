import type { LifePriorityTask, LifeSnapshot } from "@/types/workspace";
import type {
  Event,
  LifeData,
  ProposedLifeDiff,
  Session,
  Tag,
  Todo,
} from "../types/life";

const DEFAULT_TAG_COLORS = [
  "#60a5fa",
  "#34d399",
  "#f59e0b",
  "#f472b6",
  "#a78bfa",
  "#fb7185",
];

function isoFromDateMinute(date: string, minute: number) {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${date}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

function normalizeTagName(value: string | null | undefined) {
  const name = value?.trim().toLowerCase();
  return name || null;
}

function tagId(name: string) {
  return name.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function priorityToPlanPriority(
  priority: LifePriorityTask["priority"],
): Todo["priority"] {
  if (priority === "urgent" || priority === "high") return "high";
  if (priority === "low") return "low";
  return "medium";
}

function collectTags(names: Array<string | null | undefined>): Tag[] {
  const unique = Array.from(
    new Set(
      names.map(normalizeTagName).filter((name): name is string => !!name),
    ),
  );
  return unique.map((name, index) => ({
    id: tagId(name),
    name,
    color: DEFAULT_TAG_COLORS[index % DEFAULT_TAG_COLORS.length],
  }));
}

export function lifeDataFromSnapshot(snapshot: LifeSnapshot): LifeData {
  const now = new Date().toISOString();
  const eventTags = snapshot.weekCalendarEvents.map((event) => event.tag);
  const taskTags = snapshot.queue.map((task) => task.source);
  const tags = collectTags([...eventTags, ...taskTags, "focus", "break"]);
  const tagByName = new Map(tags.map((tag) => [tag.name, tag.id]));
  const resolveTagIds = (names: Array<string | null | undefined>) =>
    names
      .map(normalizeTagName)
      .map((name) => (name ? tagByName.get(name) : undefined))
      .filter((id): id is string => !!id);

  const events: Event[] = snapshot.weekCalendarEvents.map((event) => ({
    id: event.id,
    type: "event",
    title: event.summary,
    tagIds: resolveTagIds([event.tag]),
    startAt: isoFromDateMinute(event.date, event.startMinute),
    endAt: isoFromDateMinute(event.date, event.endMinute),
    allDay: event.allDay,
    timezone: snapshot.timezoneLabel,
    createdAt: now,
    updatedAt: now,
  }));

  const todos: Todo[] = snapshot.queue.map((task) => ({
    id: task.id,
    type: "todo",
    title: task.title,
    notes: task.notes ?? undefined,
    tagIds: resolveTagIds([task.source]),
    dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : undefined,
    priority: priorityToPlanPriority(task.priority),
    createdAt: now,
    updatedAt: now,
  }));

  const sessions: Session[] = snapshot.queue.flatMap((task) => {
    if (!task.scheduledStart || !task.scheduledEnd) return [];
    return [
      {
        id: `session-${task.id}`,
        type: "session",
        title: `focus: ${task.title}`,
        notes: task.prepSummary ?? undefined,
        tagIds: resolveTagIds([task.source, "focus"]),
        startAt: task.scheduledStart,
        endAt: task.scheduledEnd,
        timezone: snapshot.timezoneLabel,
        todoIds: [task.id],
        mode: "focus",
        createdAt: now,
        updatedAt: now,
      },
    ];
  });

  return {
    tags,
    timeBlocks: [...events, ...todos, ...sessions],
    activeSession: sessions.find((session) => {
      const start = session.startAt ? Date.parse(session.startAt) : Number.NaN;
      const end = session.endAt ? Date.parse(session.endAt) : Number.NaN;
      const current = Date.now();
      return (
        Number.isFinite(start) &&
        Number.isFinite(end) &&
        start <= current &&
        current <= end
      );
    }),
  };
}

export function proposedDiffsFromLifeData(data: LifeData): ProposedLifeDiff[] {
  const unscheduledTodos = data.timeBlocks.filter(
    (block) => block.type === "todo" && !block.startAt,
  );
  const sessions = data.timeBlocks.filter((block) => block.type === "session");

  return [
    {
      id: "diff-schedule-top-todo",
      title: unscheduledTodos[0]
        ? `schedule ${unscheduledTodos[0].title}`
        : "schedule the next unscheduled todo",
      reason:
        "todos remain first-class time blocks, but can be proposed onto the calendar before apply",
      operation: "update",
      targetType: "todo",
      status: "needs_review",
      evidenceIds: unscheduledTodos.slice(0, 3).map((todo) => todo.id),
    },
    {
      id: "diff-session-calendar-history",
      title: "show focus sessions as execution history",
      reason:
        sessions.length > 0
          ? "scheduled focus sessions already have calendar evidence"
          : "timer-created sessions should become calendar-visible records",
      operation: sessions.length > 0 ? "update" : "create",
      targetType: "session",
      status: "needs_review",
      evidenceIds: sessions.slice(0, 3).map((session) => session.id),
    },
  ];
}
