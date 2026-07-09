import { Badge } from "@anorvis/ui/badge";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { Clock3, GitPullRequestArrow, Tags } from "lucide-react";
import { LifePanel } from "@/features/life/components/life-command-widgets";
import type {
  LifeData,
  ProposedLifeDiff,
  TimeBlock,
} from "@/features/life/types/life";

function formatBlockTime(block: TimeBlock) {
  if (block.type === "todo") {
    return block.dueAt
      ? `due ${new Date(block.dueAt).toLocaleDateString()}`
      : "unscheduled";
  }
  if (!block.startAt) return "unscheduled";
  const start = new Date(block.startAt);
  const end = block.endAt ? new Date(block.endAt) : null;
  if (block.allDay) return start.toLocaleDateString();
  return `${start.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}${end ? `–${end.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : ""}`;
}

function typeTone(type: TimeBlock["type"]) {
  if (type === "event") return "border-blue-400/50 text-blue-300";
  if (type === "session") return "border-emerald-400/50 text-emerald-300";
  return "border-amber-400/50 text-amber-300";
}

export function TimeBlockSystemPanel({ data }: { data: LifeData }) {
  const blocks = data.timeBlocks.slice(0, 7);
  const eventCount = data.timeBlocks.filter(
    (block) => block.type === "event",
  ).length;
  const todoCount = data.timeBlocks.filter(
    (block) => block.type === "todo",
  ).length;
  const sessionCount = data.timeBlocks.filter(
    (block) => block.type === "session",
  ).length;

  return (
    <LifePanel
      label="// unified primitive"
      title="time blocks"
      meta={`${eventCount} events · ${todoCount} todos · ${sessionCount} sessions`}
    >
      <div className="space-y-3">
        <p className={workspacePageStyles.cardBodyText}>
          calendar, todos, and focus sessions now render from the shared plan.md
          time-block shape instead of disconnected widgets.
        </p>
        <div className="space-y-2">
          {blocks.length > 0 ? (
            blocks.map((block) => (
              <div
                key={`${block.type}-${block.id}`}
                className="border border-border p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate text-sm text-foreground">
                      {block.title}
                    </p>
                    <p className={workspacePageStyles.listLabel}>
                      {formatBlockTime(block)}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      workspacePageStyles.badgeSmall,
                      typeTone(block.type),
                    )}
                  >
                    {block.type}
                  </Badge>
                </div>
              </div>
            ))
          ) : (
            <p className={workspacePageStyles.cardBodyText}>
              No time blocks yet.
            </p>
          )}
        </div>
      </div>
    </LifePanel>
  );
}

export function TagManagementPanel({ data }: { data: LifeData }) {
  return (
    <LifePanel
      label="// filters"
      title="tags"
      meta={`${data.tags.length} groups`}
      action={<Tags className="size-4 text-muted-foreground" />}
    >
      <div className="space-y-3">
        <p className={workspacePageStyles.cardBodyText}>
          tags stay lightweight: color, filter, show/hide groups across events,
          todos, and sessions without replacing explicit fields.
        </p>
        <div className="flex flex-wrap gap-2">
          {data.tags.map((tag) => (
            <Badge
              key={tag.id}
              variant="outline"
              className="rounded-none"
              style={{ borderColor: tag.color, color: tag.color }}
            >
              {tag.name}
            </Badge>
          ))}
          {data.tags.length === 0 && (
            <p className={workspacePageStyles.cardBodyText}>
              Create tags as records arrive.
            </p>
          )}
        </div>
      </div>
    </LifePanel>
  );
}

export function ReviewableDiffPanel({ diffs }: { diffs: ProposedLifeDiff[] }) {
  return (
    <LifePanel
      label="// agent boundary"
      title="review queue"
      meta="propose → review → apply"
      action={<GitPullRequestArrow className="size-4 text-muted-foreground" />}
    >
      <div className="space-y-3">
        {diffs.map((diff) => (
          <div key={diff.id} className="border border-border p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <p className="text-sm text-foreground">{diff.title}</p>
                <p className={workspacePageStyles.cardBodyText}>
                  {diff.reason}
                </p>
              </div>
              <Badge
                variant="outline"
                className={workspacePageStyles.badgeSmall}
              >
                {diff.operation} {diff.targetType}
              </Badge>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[0.65rem] uppercase tracking-[0.18em] text-muted-foreground">
              <Clock3 className="size-3" />
              {diff.evidenceIds.length > 0
                ? `${diff.evidenceIds.length} evidence refs`
                : "needs source records"}
            </div>
          </div>
        ))}
      </div>
    </LifePanel>
  );
}
