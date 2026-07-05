import { lifeStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { CheckCircle2, Clock3 } from "lucide-react";
import type { LifePriorityTask } from "@/types/workspace";

const PRIORITY_DOT_STYLES: Record<string, string> = {
  "3": "border-red-500 bg-red-500/80",
  "2": "border-amber-500 bg-amber-500/80",
  "1": "border-muted-foreground/50 bg-muted-foreground/30",
  "0": "border-border bg-transparent",
};

type TaskRowProps = {
  task: LifePriorityTask;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onClick?: () => void;
};

export function TaskRow({ task, leading, trailing, onClick }: TaskRowProps) {
  const isOverdue = task.label === "overdue";
  const isDueSoon = task.label === "due soon";
  const isScheduled =
    task.label === "scheduled" || task.dueContext.includes(":");
  const pillClass = isOverdue
    ? lifeStyles.statusPillDanger
    : isDueSoon
      ? lifeStyles.statusPillWarn
      : isScheduled
        ? lifeStyles.statusPillStrong
        : lifeStyles.statusPill;
  const priorityStyle =
    PRIORITY_DOT_STYLES[String(Math.max(0, Math.min(3, task.score)))] ??
    PRIORITY_DOT_STYLES["0"];

  const mainContent = (
    <>
      <p className={lifeStyles.taskTitle}>{task.title}</p>
      <div className={lifeStyles.taskMeta}>
        <span className={pillClass}>{task.label}</span>
        <span className={lifeStyles.statusPill}>
          <Clock3 className="mr-1 size-3" />
          {task.dueContext}
        </span>
        {isScheduled && (
          <span className={lifeStyles.statusPill}>
            <CheckCircle2 className="mr-1 size-3" />
            planned
          </span>
        )}
      </div>
    </>
  );

  return (
    <div className={lifeStyles.taskRow}>
      <div className="flex items-center gap-2">
        {leading}
        <span
          className={`${lifeStyles.priorityDot} ${priorityStyle}`}
          title={`priority ${task.score}`}
        />
      </div>
      {onClick ? (
        <button
          type="button"
          className={`${lifeStyles.taskMain} min-w-0 text-left hover:bg-foreground/[0.03]`}
          onClick={onClick}
          aria-label={`Open task ${task.title}`}
        >
          {mainContent}
        </button>
      ) : (
        <div className={lifeStyles.taskMain}>{mainContent}</div>
      )}
      <div className="flex items-center gap-1">{trailing}</div>
    </div>
  );
}

export function EmptyTaskText({ children }: { children: React.ReactNode }) {
  return <p className={workspacePageStyles.cardBodyText}>{children}</p>;
}
