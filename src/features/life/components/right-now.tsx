"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { EmptyTaskText, TaskRow } from "@/features/life/components/task-row";
import { resolveRightNow } from "@/features/life/lib/priority";
import type { LifePriorityTask } from "@/types/workspace";

interface RightNowProps {
  queue: LifePriorityTask[];
  currentEvent: { summary: string } | null;
  nextEvent: { summary: string; startsInMinutes: number } | null;
}

export function RightNow({ queue, currentEvent, nextEvent }: RightNowProps) {
  const { text, subtext, isCalendarEvent } = resolveRightNow(
    queue,
    currentEvent,
    nextEvent,
  );
  const currentTask = isCalendarEvent ? null : queue[0];

  return (
    <section className="flex h-full flex-col" aria-label="current focus">
      <p className={`${workspacePageStyles.cardLabel} flex h-6 items-center`}>
        {"// right now"}
      </p>
      <div className="mt-3">
        {currentTask ? (
          <TaskRow task={currentTask} />
        ) : (
          <>
            <EmptyTaskText>{text}</EmptyTaskText>
            {subtext && (
              <p className={workspacePageStyles.cardBodyText}>{subtext}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
