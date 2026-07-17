export const statusTones: Record<string, string> = {
  online: "border-foreground/30 bg-foreground/5 text-foreground",
  active: "border-foreground/30 bg-foreground/5 text-foreground",
  stable: "border-foreground/30 bg-foreground/5 text-foreground",
  connected:
    "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-200",
  idle: "border-foreground/20 bg-foreground/5 text-muted-foreground",
  low: "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-200",
  syncing:
    "border-blue-600/30 bg-blue-500/10 text-blue-700 dark:border-blue-500/50 dark:text-blue-200",
  elevated:
    "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/50 dark:text-amber-200",
  disconnected:
    "border-rose-600/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/50 dark:text-rose-200",
  offline:
    "border-rose-600/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/50 dark:text-rose-200",
  error:
    "border-rose-600/30 bg-rose-500/10 text-rose-700 dark:border-rose-500/50 dark:text-rose-200",
  unknown: "border-foreground/10 bg-foreground/5 text-muted-foreground",
};

export const getStatusTone = (status: string) => {
  const normalized = status.toLowerCase();
  return statusTones[normalized] ?? statusTones.unknown;
};

export const formatRelativeTime = (timestamp: number | string | null) => {
  if (timestamp === null || timestamp === "") return "—";

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return "just now";
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

// ── Score display (universal thresholds for overview page) ──

/** Badge classes for score values (border + bg + text) */
export function getScoreTone(score: number | null): string {
  if (score === null) return statusTones.unknown;
  if (score >= 80)
    return "border-emerald-600/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:text-emerald-200";
  if (score >= 50)
    return "border-amber-600/30 bg-amber-500/10 text-amber-700 dark:border-amber-500/50 dark:text-amber-200";
  if (score >= 30)
    return "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:border-rose-500/40 dark:text-rose-300";
  return "border-red-700/40 bg-red-600/15 text-red-700 dark:border-red-500/60 dark:text-red-200";
}

/** Text color class for SVG rings and score values */
export function getScoreColor(score: number | null): string {
  if (score === null) return "text-muted-foreground/30";
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 50) return "text-amber-500 dark:text-amber-400";
  if (score >= 30) return "text-rose-500 dark:text-rose-400";
  return "text-red-600 dark:text-red-400";
}

export const formatPageDate = () =>
  new Date()
    .toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    })
    .toLowerCase();

export const formatEventTime = (timestamp: string) => {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
};
