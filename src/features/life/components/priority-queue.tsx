"use client";

import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@anorvis/ui/empty";
import { lifeStyles, workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  CheckCircle2,
  Clock3,
  ListTodo,
  Plus,
  Trash2,
} from "lucide-react";
import { useCallback, useReducer, useState } from "react";
import {
  WorkspaceDialog,
  workspaceModalFooterClass,
} from "@/components/layout/workspace-dialog";
import { completeTask, createTask, deleteTask } from "@/features/life/api/life";
import { TaskEditDialog } from "@/features/life/components/task-edit-dialog";
import { EmptyTaskText } from "@/features/life/components/task-row";
import { queryKeys } from "@/lib/query/keys";
import type {
  CalendarEvent,
  LifePriorityTask,
  LifeSnapshot,
} from "@/types/workspace";

type TaskPriority = "low" | "normal" | "high" | "urgent";
const QUEUE_PAGE_SIZE = 5;
const PRIORITY_DOT_STYLES: Record<string, string> = {
  "3": "border-red-500 bg-red-500/80",
  "2": "border-amber-500 bg-amber-500/80",
  "1": "border-muted-foreground/50 bg-muted-foreground/30",
  "0": "border-border bg-transparent",
};
const INITIAL_TASK_FORM = {
  title: "",
  description: "",
  links: "",
  dueDate: "",
  dueTime: "",
  durationMinutes: "",
  priority: "normal" as TaskPriority,
  error: null as string | null,
};

type TaskFormState = typeof INITIAL_TASK_FORM;
type TaskFormAction =
  | {
      type: "set";
      field: keyof TaskFormState;
      value: string | boolean | null;
    }
  | { type: "reset" };

function taskFormReducer(
  state: TaskFormState,
  action: TaskFormAction,
): TaskFormState {
  switch (action.type) {
    case "set":
      return { ...state, [action.field]: action.value };
    case "reset":
      return INITIAL_TASK_FORM;
  }
}

function TaskCheckbox({
  taskId,
  onCompleted,
}: {
  taskId: string;
  onCompleted: () => void;
}) {
  const queryClient = useQueryClient();
  const completeMutation = useMutation({
    mutationFn: completeTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
    },
  });

  const complete = useCallback(async () => {
    try {
      await completeMutation.mutateAsync(taskId);
      onCompleted();
    } catch {
      // Keep task visible for retry.
    }
  }, [taskId, onCompleted, completeMutation]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void complete();
      }}
      disabled={completeMutation.isPending}
      className="flex size-4 shrink-0 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
      aria-label="Complete task"
    >
      {completeMutation.isPending && (
        <Check className="size-2.5 text-muted-foreground" />
      )}
    </button>
  );
}

function DeleteTaskButton({
  taskId,
  onDeleted,
}: {
  taskId: string;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onMutate: async (id) => {
      onDeleted();
      await queryClient.cancelQueries({ queryKey: ["life"] });
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["life", "calendar"] },
        (events) => events?.filter((event) => event.taskId !== id),
      );
      queryClient.setQueryData<LifeSnapshot>(
        queryKeys.life.snapshot(),
        (snapshot) =>
          snapshot
            ? {
                ...snapshot,
                queue: snapshot.queue.filter((task) => task.id !== id),
                todayCalendarEvents: snapshot.todayCalendarEvents.filter(
                  (event) => event.taskId !== id,
                ),
                weekCalendarEvents: snapshot.weekCalendarEvents.filter(
                  (event) => event.taskId !== id,
                ),
              }
            : snapshot,
      );
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    },
  });

  const remove = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync(taskId);
    } catch {
      // Keep task visible for retry.
    }
  }, [taskId, deleteMutation]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void remove();
      }}
      disabled={deleteMutation.isPending}
      className="flex size-5 shrink-0 items-center justify-center text-muted-foreground opacity-0 transition-colors hover:text-destructive group-hover:opacity-100 disabled:opacity-50"
      aria-label="Delete task"
    >
      <Trash2 className="size-3" />
    </button>
  );
}

export function CreateTaskForm({
  onDone,
  onCancel,
  footerClassName = workspaceModalFooterClass,
}: {
  onDone: () => void;
  onCancel: () => void;
  footerClassName?: string;
}) {
  const [form, dispatch] = useReducer(taskFormReducer, INITIAL_TASK_FORM);
  const queryClient = useQueryClient();
  const createTaskMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
    },
  });

  const reset = () => {
    dispatch({ type: "reset" });
    onCancel();
  };

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!form.title.trim()) return;

      dispatch({ type: "set", field: "error", value: null });
      try {
        const body = {
          title: form.title.trim(),
          notes: form.description.trim() || null,
          links: form.links.split("\n").flatMap((link) => {
            const trimmed = link.trim();
            return trimmed ? [trimmed] : [];
          }),
          ...(form.durationMinutes.trim()
            ? { durationMinutes: Number(form.durationMinutes) }
            : {}),
          dueAt: form.dueDate
            ? new Date(
                `${form.dueDate}T${form.dueTime || "23:59"}`,
              ).toISOString()
            : null,
          priority: form.priority,
        };

        await createTaskMutation.mutateAsync(body);
        dispatch({ type: "reset" });
        onDone();
      } catch {
        dispatch({
          type: "set",
          field: "error",
          value: "failed to create task",
        });
      }
    },
    [form, createTaskMutation, onDone],
  );

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col space-y-3">
      {form.error && (
        <p className="text-[0.6rem] text-destructive">{form.error}</p>
      )}
      <input
        type="text"
        value={form.title}
        onChange={(e) =>
          dispatch({ type: "set", field: "title", value: e.target.value })
        }
        placeholder="title"
        className={`w-full ${workspacePageStyles.inlineInput}`}
        aria-label="task title"
        autoFocus
      />
      <label className="space-y-1">
        <span className={workspacePageStyles.metricLabel}>description</span>
        <textarea
          value={form.description}
          onChange={(e) =>
            dispatch({
              type: "set",
              field: "description",
              value: e.target.value,
            })
          }
          placeholder="context, constraints, or notes for the prep package"
          className={`min-h-24 w-full resize-none ${workspacePageStyles.inlineInput}`}
          aria-label="task description"
        />
      </label>
      <label className="space-y-1">
        <span className={workspacePageStyles.metricLabel}>links</span>
        <textarea
          value={form.links}
          onChange={(e) =>
            dispatch({ type: "set", field: "links", value: e.target.value })
          }
          placeholder="one link per line"
          className={`min-h-16 w-full resize-none ${workspacePageStyles.inlineInput}`}
          aria-label="task links"
        />
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1">
          <span className={workspacePageStyles.metricLabel}>task length</span>
          <input
            type="number"
            list="task-length-options"
            min={1}
            value={form.durationMinutes}
            onChange={(e) =>
              dispatch({
                type: "set",
                field: "durationMinutes",
                value: e.target.value,
              })
            }
            placeholder="optional minutes"
            className={`w-full ${workspacePageStyles.inlineInputSmall}`}
            aria-label="task length minutes"
          />
          <datalist id="task-length-options">
            <option value="15">15 min</option>
            <option value="30">30 min</option>
            <option value="45">45 min</option>
            <option value="60">1 hour</option>
            <option value="90">1.5 hours</option>
            <option value="120">2 hours</option>
            <option value="180">3 hours</option>
          </datalist>
        </label>
        <label className="space-y-1">
          <span className={workspacePageStyles.metricLabel}>date</span>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) =>
              dispatch({
                type: "set",
                field: "dueDate",
                value: e.target.value,
              })
            }
            className={`w-full ${workspacePageStyles.inlineInputSmall}`}
            aria-label="task due date"
          />
        </label>
        <label className="space-y-1">
          <span className={workspacePageStyles.metricLabel}>time</span>
          <input
            type="time"
            list="task-time-options"
            value={form.dueTime}
            onChange={(e) =>
              dispatch({
                type: "set",
                field: "dueTime",
                value: e.target.value,
              })
            }
            className={`w-full ${workspacePageStyles.inlineInputSmall}`}
            aria-label="task due time"
          />
          <datalist id="task-time-options">
            <option value="09:00">9:00 AM</option>
            <option value="12:00">12:00 PM</option>
            <option value="17:00">5:00 PM</option>
            <option value="18:00">6:00 PM</option>
            <option value="21:00">9:00 PM</option>
            <option value="23:59">end of day</option>
          </datalist>
        </label>
        <label className="space-y-1">
          <span className={workspacePageStyles.metricLabel}>priority</span>
          <select
            value={form.priority}
            onChange={(e) =>
              dispatch({
                type: "set",
                field: "priority",
                value: e.target.value as TaskPriority,
              })
            }
            className={`w-full ${workspacePageStyles.inlineInputSmall}`}
            aria-label="task priority"
          >
            <option value="low">low</option>
            <option value="normal">normal</option>
            <option value="high">high</option>
            <option value="urgent">urgent</option>
          </select>
        </label>
      </div>
      <DialogFooter className={footerClassName}>
        <button
          type="button"
          onClick={reset}
          className={workspacePageStyles.modalButton}
        >
          cancel
        </button>
        <button
          type="submit"
          disabled={createTaskMutation.isPending || !form.title.trim()}
          className={workspacePageStyles.modalButton}
        >
          {createTaskMutation.isPending ? "..." : "add"}
        </button>
      </DialogFooter>
    </form>
  );
}

export function AddTaskButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-6 items-center justify-center border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
        aria-label="Add task"
      >
        <Plus className="size-3" />
      </button>
      <WorkspaceDialog
        open={open}
        onOpenChange={(nextOpen) => setOpen(nextOpen)}
      >
        <DialogHeader>
          <DialogTitle className={workspacePageStyles.cardTitle}>
            add task
          </DialogTitle>
          <DialogDescription className={workspacePageStyles.cardBodyText}>
            create schedulable work for anorvis-os.
          </DialogDescription>
        </DialogHeader>
        <CreateTaskForm
          onDone={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </WorkspaceDialog>
    </>
  );
}

function PriorityQueueTaskRow({
  task,
  onCompleted,
  onDeleted,
  onClick,
}: {
  task: LifePriorityTask;
  onCompleted: () => void;
  onDeleted: () => void;
  onClick: () => void;
}) {
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

  return (
    <div className={lifeStyles.taskRow}>
      <div className="flex items-center gap-2">
        <TaskCheckbox taskId={task.id} onCompleted={onCompleted} />
        <span
          className={`${lifeStyles.priorityDot} ${priorityStyle}`}
          title={`priority ${task.score}`}
        />
      </div>
      <button
        type="button"
        className={`${lifeStyles.taskMain} min-w-0 text-left hover:bg-foreground/[0.03]`}
        onClick={onClick}
        aria-label={`Open task ${task.title}`}
      >
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
      </button>
      <div className="flex items-center gap-1">
        <DeleteTaskButton taskId={task.id} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

export function PriorityQueue({
  queue,
  emptyDescription,
  allowCreate = false,
}: {
  queue: LifePriorityTask[];
  emptyDescription: string;
  allowCreate?: boolean;
}) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [selectedTask, setSelectedTask] = useState<LifePriorityTask | null>(
    null,
  );

  const handleCompleted = useCallback((id: string) => {
    setCompleted((prev) => new Set(prev).add(id));
  }, []);

  const visible = queue.filter((t) => !completed.has(t.id));
  const pageCount = Math.max(1, Math.ceil(visible.length / QUEUE_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(
    safePage * QUEUE_PAGE_SIZE,
    safePage * QUEUE_PAGE_SIZE + QUEUE_PAGE_SIZE,
  );

  if (visible.length === 0 && !allowCreate) {
    return (
      <Empty className="rounded-none border-border/70 py-10">
        <EmptyHeader>
          <ListTodo className="size-6 text-muted-foreground" />
          <EmptyTitle className="text-sm uppercase tracking-[0.25em]">
            queue is empty
          </EmptyTitle>
          <EmptyDescription className="max-w-md text-xs uppercase tracking-[0.2em]">
            {emptyDescription}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div>
      {visible.length > 0 && (
        <div className={lifeStyles.taskList}>
          {pageItems.map((task) => (
            <PriorityQueueTaskRow
              key={task.id}
              task={task}
              onClick={() => setSelectedTask(task)}
              onCompleted={() => handleCompleted(task.id)}
              onDeleted={() => handleCompleted(task.id)}
            />
          ))}
        </div>
      )}
      {visible.length === 0 && (
        <EmptyTaskText>{emptyDescription}</EmptyTaskText>
      )}
      {pageCount > 1 && (
        <div className={lifeStyles.queueFooter}>
          <p className={workspacePageStyles.metricLabel}>
            {safePage + 1} / {pageCount}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={workspacePageStyles.toggleButton}
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              prev
            </button>
            <button
              type="button"
              className={workspacePageStyles.toggleButton}
              disabled={safePage >= pageCount - 1}
              onClick={() =>
                setPage((current) => Math.min(pageCount - 1, current + 1))
              }
            >
              next
            </button>
          </div>
        </div>
      )}
      <TaskEditDialog
        task={selectedTask}
        onOpenChange={(open) => !open && setSelectedTask(null)}
      />
    </div>
  );
}
