import type { GoogleTaskListResponse } from "./google-api";

export const computeExecutionScore = (
  payload: GoogleTaskListResponse | null,
  hasTaskSync: boolean,
) => {
  if (!hasTaskSync || !payload) {
    return {
      score: null as number | null,
      statusText: "score unavailable until tasks sync",
    };
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  if (items.length === 0) {
    return {
      score: null as number | null,
      statusText: "score unavailable because synced task list is empty",
    };
  }

  const completedLast7d = items.filter((task) => {
    if (task.status !== "completed" || !task.completed) return false;
    const completedAt = new Date(task.completed);
    if (Number.isNaN(completedAt.getTime())) return false;
    return Date.now() - completedAt.getTime() <= 7 * 24 * 60 * 60 * 1000;
  }).length;

  const dueIn48h = items.filter((task) => {
    if (task.status === "completed" || !task.due) return false;
    const dueAt = new Date(task.due);
    if (Number.isNaN(dueAt.getTime())) return false;
    const ms = dueAt.getTime() - Date.now();
    return ms >= 0 && ms <= 48 * 60 * 60 * 1000;
  }).length;

  const rawScore = 60 + completedLast7d * 6 - dueIn48h * 7;
  const score = Math.max(0, Math.min(100, rawScore));

  return {
    score,
    statusText: `${completedLast7d} completed in 7d · ${dueIn48h} due in 48h`,
  };
};
