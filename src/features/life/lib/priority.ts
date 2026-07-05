import type { LifePriorityTask, PriorityLabel } from "@/types/workspace";
import type { GoogleTask } from "./google-api";

export function computePriorityScore(
  dueAt: number | null,
  now: number,
): number {
  if (dueAt === null) return 0.01;

  const hoursRemaining = (dueAt - now) / 3_600_000;

  if (hoursRemaining < 0) {
    const daysOverdue = -hoursRemaining / 24;
    return 100 + daysOverdue;
  }

  return 1 / (1 + hoursRemaining / 24);
}

export function getPriorityLabel(score: number): PriorityLabel {
  if (score >= 100) return "overdue";
  if (score >= 0.5) return "due soon";
  if (score >= 0.1) return "upcoming";
  if (score >= 0.02) return "scheduled";
  return "no date";
}

export function formatDueContext(dueAt: number | null, now: number): string {
  if (dueAt === null) return "no due date";

  const diff = dueAt - now;
  const absDiff = Math.abs(diff);

  if (diff < 0) {
    const hours = absDiff / 3_600_000;
    if (hours >= 24) return `overdue by ${Math.floor(hours / 24)}d`;
    return `overdue by ${Math.floor(hours)}h`;
  }

  const minutes = absDiff / 60_000;
  if (minutes < 60) return `due in ${Math.floor(minutes)}m`;

  const hours = absDiff / 3_600_000;
  if (hours < 24) return `due in ${Math.floor(hours)}h`;

  if (hours < 48) return "due tomorrow";

  if (hours < 168) {
    const date = new Date(dueAt);
    return `due ${date.toLocaleDateString("en-US", { weekday: "short" }).toLowerCase()}`;
  }

  const date = new Date(dueAt);
  const month = date
    .toLocaleDateString("en-US", { month: "short" })
    .toLowerCase();
  const day = date.getDate();
  return `due ${month} ${day}`;
}

export function sortByPriority(tasks: LifePriorityTask[]): LifePriorityTask[] {
  return [...tasks].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aDue = a.dueAt ?? Number.POSITIVE_INFINITY;
    const bDue = b.dueAt ?? Number.POSITIVE_INFINITY;
    if (aDue !== bDue) return aDue - bDue;
    return a.title.localeCompare(b.title);
  });
}

export function buildPriorityTasks(
  tasks: GoogleTask[],
  now: number,
): LifePriorityTask[] {
  const valid = tasks.filter(
    (t): t is GoogleTask & { id: string; title: string } =>
      typeof t.id === "string" &&
      t.id.length > 0 &&
      typeof t.title === "string" &&
      t.title.trim().length > 0 &&
      t.status !== "completed",
  );

  const scored = valid.map((t) => {
    const dueAt = t.due ? new Date(t.due).getTime() : null;
    const score = computePriorityScore(dueAt, now);
    return {
      id: t.id,
      title: t.title.trim().slice(0, 60),
      source: "google tasks",
      dueAt,
      dueContext: formatDueContext(dueAt, now),
      label: getPriorityLabel(score),
      score,
    };
  });

  return sortByPriority(scored).slice(0, 10);
}

type RightNowResult = {
  text: string;
  subtext: string;
  isCalendarEvent: boolean;
};

export function resolveRightNow(
  queue: LifePriorityTask[],
  currentEvent: { summary: string } | null,
  nextEvent: { summary: string; startsInMinutes: number } | null,
): RightNowResult {
  if (currentEvent) {
    return {
      text: `▸ ${currentEvent.summary} — happening now`,
      subtext: "",
      isCalendarEvent: true,
    };
  }

  const hasOverdue = queue.length > 0 && queue[0].score >= 100;

  if (nextEvent && nextEvent.startsInMinutes <= 30 && !hasOverdue) {
    return {
      text: `▸ ${nextEvent.summary} in ${nextEvent.startsInMinutes}m`,
      subtext: "",
      isCalendarEvent: true,
    };
  }

  if (queue.length === 0) {
    return { text: "No tasks right now", subtext: "", isCalendarEvent: false };
  }

  const top = queue[0];
  return {
    text: `▸ ${top.title}`,
    subtext: `${top.dueContext} · ${top.source}`,
    isCalendarEvent: false,
  };
}
