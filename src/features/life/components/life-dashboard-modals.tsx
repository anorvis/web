"use client";

import { DialogFooter } from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { type Dispatch, type SetStateAction, useState } from "react";
import {
  WorkspaceDialog,
  WorkspaceModalFrame,
} from "@/components/layout/workspace-dialog";
import { todoPriorityClass } from "@/features/life/components/life-dashboard-calculations";
import * as LifeUi from "@/features/life/components/life-dashboard-ui";
import { CreateTaskForm } from "@/features/life/components/priority-queue";
import { TaskEditForm } from "@/features/life/components/task-edit-dialog";
import { formatDateTime } from "@/lib/life-intelligence/derive";
import type { Session, Tag } from "@/lib/life-intelligence/model";
import type { LifePriorityTask } from "@/types/workspace";

const TODOS_PAGE_SIZE = 7;

export function TodoDialog({
  open,
  onOpenChange,
  calendarMode,
  todos,
  periodTodosCount,
  queue,
  view,
  onViewChange,
  onComplete,
  onDelete,
  completePending,
  deletePending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarMode: "day" | "week" | "month";
  todos: Array<{
    id: string;
    title: string;
    priority?: string;
    dueAt?: string;
    notes?: string;
  }>;
  periodTodosCount: number;
  queue: LifePriorityTask[];
  view: LifeUi.TodoView;
  onViewChange: (view: LifeUi.TodoView) => void;
  onComplete: (id: string) => void;
  onDelete: (id: string) => void;
  completePending: boolean;
  deletePending: boolean;
}) {
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(todos.length / TODOS_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visibleTodos = todos.slice(
    safePage * TODOS_PAGE_SIZE,
    safePage * TODOS_PAGE_SIZE + TODOS_PAGE_SIZE,
  );

  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={onOpenChange}
      className={LifeUi.modalClass}
    >
      <WorkspaceModalFrame
        title={
          view === "create"
            ? "add todo"
            : typeof view === "object"
              ? "edit todo"
              : "todos"
        }
        description="Open tasks. Add and edit replace this modal view instead of stacking another modal."
      >
        <div className="flex min-h-0 flex-1 flex-col space-y-3 pt-4 pb-0">
          {view === "list" && (
            <>
              <div className="flex items-center justify-between gap-3">
                <p className={workspacePageStyles.cardBodyText}>
                  {todos.length} open · {periodTodosCount} due in selected{" "}
                  {calendarMode}
                </p>
                <button
                  type="button"
                  className={workspacePageStyles.modalButton}
                  onClick={() => onViewChange("create")}
                >
                  create todo
                </button>
              </div>
              <div className="space-y-1.5">
                {todos.length === 0 ? (
                  <p className={workspacePageStyles.cardBodyText}>
                    queue is empty
                  </p>
                ) : (
                  visibleTodos.map((todo) => {
                    const task = queue.find((entry) => entry.id === todo.id);
                    return (
                      <div
                        key={todo.id}
                        className="group flex h-14 w-full min-w-0 max-w-full items-center gap-2 overflow-hidden border border-border px-2.5 py-2 hover:border-foreground"
                      >
                        <button
                          type="button"
                          onClick={() => task && onViewChange({ edit: task })}
                          className="block min-w-0 flex-1 overflow-hidden text-left"
                        >
                          <div className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden">
                            <span
                              className={`shrink-0 border px-1.5 py-0.5 text-[0.48rem] uppercase tracking-[0.12em] ${todoPriorityClass(todo.priority)}`}
                            >
                              {todo.priority ?? "normal"}
                            </span>
                            <p className="min-w-0 flex-1 truncate text-[0.72rem] leading-tight text-foreground">
                              {todo.title}
                            </p>
                          </div>
                          <p className="mt-1 max-w-full truncate text-[0.54rem] uppercase tracking-[0.14em] text-muted-foreground">
                            {todo.dueAt
                              ? formatDateTime(todo.dueAt)
                              : "no date"}
                            {todo.notes ? ` · ${todo.notes}` : ""}
                          </p>
                        </button>
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            type="button"
                            className="h-7 border border-border px-2 text-[0.52rem] uppercase tracking-[0.14em] text-muted-foreground hover:border-foreground hover:text-foreground"
                            disabled={completePending}
                            onClick={() => onComplete(todo.id)}
                          >
                            done
                          </button>
                          <button
                            type="button"
                            className="h-7 border border-border px-2 text-[0.52rem] uppercase tracking-[0.14em] text-muted-foreground hover:border-destructive hover:text-destructive"
                            disabled={deletePending}
                            onClick={() => onDelete(todo.id)}
                          >
                            delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              {pageCount > 1 && (
                <DialogFooter
                  className={`items-center justify-between sm:justify-between ${LifeUi.modalFooterClass}`}
                >
                  <p className={workspacePageStyles.metricLabel}>
                    {safePage + 1} / {pageCount}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={workspacePageStyles.modalButton}
                      disabled={safePage === 0}
                      onClick={() =>
                        setPage((current) => Math.max(0, current - 1))
                      }
                    >
                      prev
                    </button>
                    <button
                      type="button"
                      className={workspacePageStyles.modalButton}
                      disabled={safePage >= pageCount - 1}
                      onClick={() =>
                        setPage((current) =>
                          Math.min(pageCount - 1, current + 1),
                        )
                      }
                    >
                      next
                    </button>
                  </div>
                </DialogFooter>
              )}
            </>
          )}
          {view === "create" && (
            <CreateTaskForm
              onDone={() => onViewChange("list")}
              onCancel={() => onViewChange("list")}
              footerClassName={LifeUi.modalFooterClass}
            />
          )}
          {typeof view === "object" && (
            <TaskEditForm
              task={view.edit}
              onClose={() => onViewChange("list")}
              footerClassName={LifeUi.modalFooterClass}
            />
          )}
        </div>
      </WorkspaceModalFrame>
    </WorkspaceDialog>
  );
}

export function TagsDialog({
  open,
  onOpenChange,
  tags,
  selectedTagIds,
  setSelectedTagIds,
  draftTag,
  setDraftTag,
  addTag,
  tagEdit,
  setTagEdit,
  saveTagEdit,
  onRemoveSelected,
  busy,
  error,
  onFilter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: Tag[];
  selectedTagIds: string[];
  setSelectedTagIds: Dispatch<SetStateAction<string[]>>;
  draftTag: string;
  setDraftTag: (value: string) => void;
  addTag: () => void;
  tagEdit: { id: string; name: string; color: string } | null;
  setTagEdit: Dispatch<
    SetStateAction<{ id: string; name: string; color: string } | null>
  >;
  saveTagEdit: () => void;
  onRemoveSelected: () => void;
  busy: boolean;
  error: string | null;
  onFilter: () => void;
}) {
  const hasRemovableSelection = selectedTagIds.some(
    (id) => !tags.find((tag) => tag.id === id)?.system,
  );

  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={onOpenChange}
      className={LifeUi.modalClass}
    >
      <WorkspaceModalFrame
        title="tags"
        description="Manage available tags, edit them inline, and choose calendar filters. Applying filters closes this modal."
      >
        <div className="flex min-h-0 flex-1 flex-col space-y-4 pt-4 pb-0">
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              addTag();
            }}
          >
            <input
              className={`min-w-0 flex-1 ${workspacePageStyles.inlineInput}`}
              value={draftTag}
              onChange={(event) => setDraftTag(event.target.value)}
              placeholder="new tag"
            />
            <button
              type="submit"
              className={workspacePageStyles.modalButton}
              disabled={busy}
            >
              create
            </button>
          </form>
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {tags.map((tag) => {
              const editing = tagEdit?.id === tag.id;
              return (
                <div
                  key={tag.id}
                  className="group flex h-12 min-w-0 items-center gap-2 overflow-hidden border border-border px-2 hover:border-foreground"
                  onClick={(event) => {
                    if (editing) return;
                    const target = event.target;
                    if (
                      target instanceof HTMLElement &&
                      target.closest("button,input")
                    ) {
                      return;
                    }
                    setSelectedTagIds((current) =>
                      current.includes(tag.id)
                        ? current.filter((id) => id !== tag.id)
                        : [...current, tag.id],
                    );
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedTagIds.includes(tag.id)}
                    onChange={(event) =>
                      setSelectedTagIds((current) =>
                        event.target.checked
                          ? [...current, tag.id]
                          : current.filter((id) => id !== tag.id),
                      )
                    }
                    aria-label={`filter ${tag.name}`}
                    className="size-4 shrink-0 accent-foreground"
                  />
                  {editing ? (
                    <>
                      <input
                        className={`h-8 min-w-0 flex-1 ${workspacePageStyles.inlineInput}`}
                        value={tagEdit.name}
                        disabled={tag.system}
                        onChange={(event) =>
                          setTagEdit((current) =>
                            current
                              ? { ...current, name: event.target.value }
                              : current,
                          )
                        }
                        aria-label={`edit ${tag.name} name`}
                        title={
                          tag.system
                            ? "automatic tag names cannot be changed"
                            : undefined
                        }
                      />
                      <input
                        type="color"
                        className="h-8 w-10 shrink-0 border border-border bg-transparent p-0.5"
                        value={tagEdit.color}
                        onChange={(event) =>
                          setTagEdit((current) =>
                            current
                              ? { ...current, color: event.target.value }
                              : current,
                          )
                        }
                        aria-label={`edit ${tag.name} color`}
                      />
                      <button
                        type="button"
                        className="shrink-0 text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground disabled:opacity-50"
                        onClick={saveTagEdit}
                        disabled={busy}
                      >
                        save
                      </button>
                      <button
                        type="button"
                        className="shrink-0 text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground"
                        onClick={() => setTagEdit(null)}
                      >
                        cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span
                        className="size-3 shrink-0 border border-border"
                        style={{
                          backgroundColor: tag.color ?? "transparent",
                        }}
                      />
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate text-left text-[0.62rem] text-foreground"
                        onClick={() =>
                          setSelectedTagIds((current) =>
                            current.includes(tag.id)
                              ? current.filter((id) => id !== tag.id)
                              : [...current, tag.id],
                          )
                        }
                      >
                        {tag.name}
                      </button>
                      {tag.system ? (
                        <span className="shrink-0 text-[0.5rem] uppercase tracking-[0.14em] text-muted-foreground">
                          auto
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="shrink-0 text-[0.55rem] uppercase tracking-[0.16em] text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100 group-focus-within:opacity-100"
                        onClick={(event) => {
                          event.stopPropagation();
                          setTagEdit({
                            id: tag.id,
                            name: tag.name,
                            color: tag.color ?? "#60a5fa",
                          });
                        }}
                      >
                        edit
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {error && <p className={workspacePageStyles.errorText}>{error}</p>}
          <DialogFooter className={LifeUi.modalFooterClass}>
            <button
              type="button"
              className={workspacePageStyles.modalButton}
              onClick={() => setSelectedTagIds([])}
            >
              clear
            </button>
            <button
              type="button"
              className={workspacePageStyles.modalDangerButton}
              disabled={!hasRemovableSelection || busy}
              onClick={onRemoveSelected}
            >
              remove selected
            </button>
            <button
              type="button"
              className={workspacePageStyles.modalButton}
              onClick={onFilter}
            >
              filter
            </button>
          </DialogFooter>
        </div>
      </WorkspaceModalFrame>
    </WorkspaceDialog>
  );
}

export function FocusSessionList({
  sessions,
  totalMinutes,
  onCreate,
  onEdit,
}: {
  sessions: Session[];
  totalMinutes: number;
  onCreate: () => void;
  onEdit: (session: Session) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <p className={workspacePageStyles.cardBodyText}>
          {sessions.length} sessions · {totalMinutes}m
        </p>
        <button
          className={workspacePageStyles.modalButton}
          type="button"
          onClick={onCreate}
        >
          new session
        </button>
      </div>
      {sessions.length === 0 ? (
        <p className={workspacePageStyles.cardBodyText}>
          no focus sessions in this time frame
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {sessions.map((session) => (
            <button
              key={session.id}
              type="button"
              onClick={() => onEdit(session)}
              className="w-full border border-border p-3 text-left hover:border-foreground"
            >
              <p className="text-sm text-foreground">{session.title}</p>
              <p className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
                {session.startAt
                  ? formatDateTime(session.startAt)
                  : "unscheduled"}
              </p>
              {session.notes && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {session.notes}
                </p>
              )}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
