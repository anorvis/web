"use client";

import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anorvis/ui/dropdown-menu";
import { lifeStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { WorkspaceDialog } from "@/components/layout/workspace-dialog";
import { updateTask } from "@/features/life/api/life";
import { queryKeys } from "@/lib/query/keys";
import type {
  CalendarEvent,
  LifePriorityTask,
  LifeSnapshot,
} from "@/types/workspace";

type TaskPriority = "low" | "normal" | "high" | "urgent";
const PRIORITY_OPTIONS: TaskPriority[] = ["urgent", "high", "normal", "low"];
type OptimisticTaskInput = {
  title: string;
  notes: string | null;
  links: string[];
  durationMinutes?: number;
  date: string | null;
  priority: TaskPriority;
  multiSession: boolean;
};

function dateInputValue(value: number | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function timeInputValue(value: number | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toTimeString().slice(0, 5);
}

function priorityScore(priority: TaskPriority) {
  if (priority === "urgent") return 3;
  if (priority === "high") return 2;
  if (priority === "normal") return 1;
  return 0;
}

function taskLabel(dueAt: number | null): LifePriorityTask["label"] {
  if (!dueAt) return "no date";
  return dueAt < Date.now() ? "overdue" : "scheduled";
}

function taskDueContext(date: string | null) {
  if (!date) return "next 7 days";
  return `by ${new Date(date).toLocaleDateString()}`;
}

function optimisticTask(
  task: LifePriorityTask,
  input: OptimisticTaskInput,
): LifePriorityTask {
  const dueAt = input.date ? Date.parse(input.date) : null;
  return {
    ...task,
    title: input.title,
    notes: input.notes,
    links: input.links,
    ...(input.durationMinutes
      ? { durationMinutes: input.durationMinutes }
      : {}),
    priority: input.priority,
    multiSession: input.multiSession,
    dueAt,
    dueContext: taskDueContext(input.date),
    label: taskLabel(dueAt),
    score: priorityScore(input.priority),
  };
}

function optimisticCalendarEvent(
  event: CalendarEvent,
  input: OptimisticTaskInput,
): CalendarEvent | null {
  if (!input.date && event.type === "taskDeadline") return null;
  if (!input.date) {
    return {
      ...event,
      summary: input.title,
    };
  }
  const date = new Date(input.date);
  if (Number.isNaN(date.getTime())) {
    return {
      ...event,
      summary: input.title,
    };
  }
  return {
    ...event,
    summary: input.title,
    date: input.date.slice(0, 10),
    dayIndex: date.getDay(),
  };
}

function optimisticCalendarEvents(
  events: CalendarEvent[],
  taskId: string,
  input: OptimisticTaskInput,
) {
  return events.flatMap((event) => {
    if (event.taskId !== taskId) return [event];
    const updated = optimisticCalendarEvent(event, input);
    return updated ? [updated] : [];
  });
}

function TaskEditForm({
  task,
  onClose,
}: {
  task: LifePriorityTask;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [links, setLinks] = useState<string[]>(task.links ?? []);
  const [draftLink, setDraftLink] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(
    task.durationMinutes ? String(task.durationMinutes) : "",
  );
  const [dueDate, setDueDate] = useState(dateInputValue(task.dueAt));
  const [dueTime, setDueTime] = useState(timeInputValue(task.dueAt));
  const [priority, setPriority] = useState<TaskPriority>(
    task.priority ?? "normal",
  );
  const [multiSession, setMultiSession] = useState(Boolean(task.multiSession));
  const [error, setError] = useState<string | null>(null);
  const updateMutation = useMutation({
    mutationFn: (input: OptimisticTaskInput) => updateTask(task.id, input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["life"] });
      const previousSnapshot = queryClient.getQueryData<LifeSnapshot>(
        queryKeys.life.snapshot(),
      );
      const previousCalendarEntries = queryClient.getQueriesData<
        CalendarEvent[]
      >({ queryKey: ["life", "calendar"] });
      const nextTask = optimisticTask(task, input);

      queryClient.setQueryData<LifeSnapshot>(
        queryKeys.life.snapshot(),
        (snapshot) =>
          snapshot
            ? {
                ...snapshot,
                queue: snapshot.queue.map((entry) =>
                  entry.id === task.id ? nextTask : entry,
                ),
                todayCalendarEvents: optimisticCalendarEvents(
                  snapshot.todayCalendarEvents,
                  task.id,
                  input,
                ),
                weekCalendarEvents: optimisticCalendarEvents(
                  snapshot.weekCalendarEvents,
                  task.id,
                  input,
                ),
              }
            : snapshot,
      );
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["life", "calendar"] },
        (events) =>
          events ? optimisticCalendarEvents(events, task.id, input) : events,
      );

      return { previousSnapshot, previousCalendarEntries };
    },
    onError: (_error, _input, context) => {
      if (context?.previousSnapshot) {
        queryClient.setQueryData(
          queryKeys.life.snapshot(),
          context.previousSnapshot,
        );
      }
      for (const [queryKey, data] of context?.previousCalendarEntries ?? []) {
        queryClient.setQueryData(queryKey, data);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    },
  });

  const addLink = useCallback(() => {
    const nextLink = draftLink.trim();
    if (!nextLink) return;
    setLinks((current) =>
      current.includes(nextLink) ? current : [...current, nextLink],
    );
    setDraftLink("");
  }, [draftLink]);

  const submit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (!title.trim()) return;
      setError(null);
      const normalizedLinks = [
        ...links,
        ...(draftLink.trim() ? [draftLink.trim()] : []),
      ];
      const durationInput = durationMinutes.trim();
      try {
        await updateMutation.mutateAsync({
          title: title.trim(),
          notes: notes.trim() || null,
          links: Array.from(new Set(normalizedLinks)),
          ...(durationInput ? { durationMinutes: Number(durationInput) } : {}),
          date: dueDate
            ? new Date(`${dueDate}T${dueTime || "23:59"}`).toISOString()
            : null,
          priority,
          multiSession,
        });
        onClose();
      } catch {
        setError("couldn't update task");
      }
    },
    [
      title,
      notes,
      links,
      draftLink,
      durationMinutes,
      dueDate,
      dueTime,
      priority,
      multiSession,
      updateMutation,
      onClose,
    ],
  );

  return (
    <form onSubmit={submit} className={workspacePageStyles.formGroup}>
      {error && <p className={workspacePageStyles.errorText}>{error}</p>}
      <label className={workspacePageStyles.formLabel}>
        <span className={workspacePageStyles.metricLabel}>title</span>
        <input
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          className={`w-full ${workspacePageStyles.inlineInput}`}
          autoFocus
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className={workspacePageStyles.formLabel}>
          <span className={workspacePageStyles.metricLabel}>duration</span>
          <input
            type="number"
            min={1}
            step={5}
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(event.target.value)}
            placeholder="optional minutes"
            className={`h-8 w-full ${workspacePageStyles.inlineInputSmall}`}
            aria-label="duration minutes"
          />
        </label>
        <label className={workspacePageStyles.formLabel}>
          <span className={workspacePageStyles.metricLabel}>priority</span>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={`${workspacePageStyles.inlineInputSmall} flex h-8 w-full items-center justify-between text-left uppercase`}
              >
                {priority}
                <span className="text-muted-foreground">▾</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className={`${workspacePageStyles.dropdownContent} z-[90]`}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <DropdownMenuItem
                  key={option}
                  onClick={() => setPriority(option)}
                  className={workspacePageStyles.dropdownAction}
                >
                  {option}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </label>
        <label className={workspacePageStyles.formLabel}>
          <span className={workspacePageStyles.metricLabel}>date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
            className={`w-full ${workspacePageStyles.inlineInputSmall}`}
          />
        </label>
        <label className={workspacePageStyles.formLabel}>
          <span className={workspacePageStyles.metricLabel}>time</span>
          <input
            type="time"
            value={dueTime}
            onChange={(event) => setDueTime(event.target.value)}
            className={`w-full ${workspacePageStyles.inlineInputSmall}`}
          />
        </label>
      </div>
      <label className={workspacePageStyles.formLabel}>
        <span className={workspacePageStyles.metricLabel}>notes</span>
        <textarea
          value={notes}
          onChange={(event) => setNotes(event.target.value)}
          className={`min-h-24 w-full resize-none ${workspacePageStyles.inlineInput}`}
        />
      </label>
      <div className={workspacePageStyles.formLabel}>
        <span className={workspacePageStyles.metricLabel}>links</span>
        {links.length > 0 && (
          <div className="space-y-1">
            {links.map((link) => (
              <div
                key={link}
                className="flex min-w-0 items-center justify-between gap-2 border border-border px-2 py-1"
              >
                <span className="truncate text-[0.62rem] text-muted-foreground">
                  {link}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setLinks((current) =>
                      current.filter((currentLink) => currentLink !== link),
                    )
                  }
                  className={workspacePageStyles.inlineAction}
                >
                  remove
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex gap-2">
          <input
            type="url"
            value={draftLink}
            onChange={(event) => setDraftLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addLink();
              }
            }}
            placeholder="https://..."
            className={`min-w-0 flex-1 ${workspacePageStyles.inlineInput}`}
          />
          <button
            type="button"
            onClick={addLink}
            disabled={!draftLink.trim()}
            className={workspacePageStyles.modalButton}
          >
            add link
          </button>
        </div>
      </div>
      <button
        type="button"
        onClick={() => setMultiSession((value) => !value)}
        className={`${workspacePageStyles.toggleButton} ${
          multiSession ? "border-foreground text-foreground" : ""
        }`}
      >
        multi-session
      </button>
      {task.conflictState && task.conflictState !== "none" && (
        <p className={lifeStyles.statusPillDanger}>{task.conflictState}</p>
      )}

      <DialogFooter>
        <button
          type="button"
          onClick={onClose}
          className={workspacePageStyles.modalButton}
        >
          cancel
        </button>
        <button
          type="submit"
          disabled={updateMutation.isPending || !title.trim()}
          className={workspacePageStyles.modalButton}
        >
          {updateMutation.isPending ? "..." : "save"}
        </button>
      </DialogFooter>
    </form>
  );
}

export function TaskEditDialog({
  task,
  onOpenChange,
}: {
  task: LifePriorityTask | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <WorkspaceDialog open={!!task} onOpenChange={onOpenChange}>
      <DialogHeader className="gap-1">
        <DialogTitle className={workspacePageStyles.cardTitle}>
          edit task
        </DialogTitle>
        <DialogDescription className={workspacePageStyles.cardBodyText}>
          update task details and planning context
        </DialogDescription>
      </DialogHeader>
      {task && (
        <TaskEditForm
          key={task.id}
          task={task}
          onClose={() => onOpenChange(false)}
        />
      )}
    </WorkspaceDialog>
  );
}
