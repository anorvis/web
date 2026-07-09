"use client";

import { DialogFooter, DialogHeader, DialogTitle } from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  WorkspaceDialog,
  workspaceModalFooterClass,
} from "@/components/layout/workspace-dialog";
import {
  completeTask,
  deleteCalendarEvent,
  deleteTask,
  updateCalendarEvent,
} from "@/features/life/api/life";
import { TagSelect } from "@/features/life/components/tag-select";
import { invalidateAll } from "@/features/life/lib/calendar-cache";
import { minuteToTime } from "@/features/life/lib/calendar-utils";
import { useLifeStore } from "@/features/life/stores/life-store";
import { LOCAL_FOCUS_SESSION_ID_PREFIX } from "@/lib/life-intelligence/model";
import { queryKeys } from "@/lib/query/keys";
import type { CalendarEvent, LifeSnapshot } from "@/types/workspace";

function invalidateDateCache(value: string | null | undefined) {
  if (!value) return;
  const date = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (!Number.isNaN(date.getTime())) invalidateAll(date);
}

function removeEventFromCalendar(
  events: CalendarEvent[] | undefined,
  id: string,
) {
  return events?.filter((event) => event.id !== id);
}

function removeTaskFromCalendar(
  events: CalendarEvent[] | undefined,
  taskId: string,
) {
  return events?.filter((event) => event.taskId !== taskId);
}

function removeTaskFromSnapshot(
  snapshot: LifeSnapshot | undefined,
  taskId: string,
) {
  if (!snapshot) return snapshot;
  return {
    ...snapshot,
    queue: snapshot.queue.filter((task) => task.id !== taskId),
    todayCalendarEvents:
      removeTaskFromCalendar(snapshot.todayCalendarEvents, taskId) ?? [],
    weekCalendarEvents:
      removeTaskFromCalendar(snapshot.weekCalendarEvents, taskId) ?? [],
  };
}

export function EventDetailForm({
  event,
  tagOptions,
  onClose,
}: {
  event: CalendarEvent;
  tagOptions: string[];
  onClose?: () => void;
}) {
  const queryClient = useQueryClient();
  const { setDetailEvent, dismissFocusSession } = useLifeStore();
  const close = onClose ?? (() => setDetailEvent(null));
  const [summary, setSummary] = useState(event.summary);
  const [dateStr, setDateStr] = useState(event.date);
  const [startTime, setStartTime] = useState(minuteToTime(event.startMinute));
  const [endTime, setEndTime] = useState(minuteToTime(event.endMinute));
  const [tag, setTag] = useState(event.tag ?? "");
  const [location, setLocation] = useState(event.location ?? "");
  const [description, setDescription] = useState(event.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const updateEventMutation = useMutation({ mutationFn: updateCalendarEvent });
  const deleteEventMutation = useMutation({
    mutationFn: deleteCalendarEvent,
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["life", "calendar"] });
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["life", "calendar"] },
        (events) => removeEventFromCalendar(events, id),
      );
    },
    onSettled: () => {
      invalidateDateCache(event.date);
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
    },
  });
  const deleteTaskMutation = useMutation({
    mutationFn: deleteTask,
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["life"] });
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["life", "calendar"] },
        (events) => removeTaskFromCalendar(events, taskId),
      );
      queryClient.setQueryData<LifeSnapshot>(
        queryKeys.life.snapshot(),
        (snapshot) => removeTaskFromSnapshot(snapshot, taskId),
      );
    },
    onSettled: () => {
      invalidateDateCache(event.date);
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
    },
  });
  const completeTaskMutation = useMutation({
    mutationFn: completeTask,
    onMutate: async (taskId) => {
      await queryClient.cancelQueries({ queryKey: ["life"] });
      queryClient.setQueriesData<CalendarEvent[]>(
        { queryKey: ["life", "calendar"] },
        (events) => removeTaskFromCalendar(events, taskId),
      );
      queryClient.setQueryData<LifeSnapshot>(
        queryKeys.life.snapshot(),
        (snapshot) => removeTaskFromSnapshot(snapshot, taskId),
      );
    },
    onSettled: () => {
      invalidateDateCache(event.date);
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
    },
  });
  const isTaskDeadline = event.type === "taskDeadline";
  const isTask = isTaskDeadline || event.type === "plannedTask";
  const isGeneratedFocusSession =
    event.source === "time-block" &&
    event.id.startsWith(LOCAL_FOCUS_SESSION_ID_PREFIX);
  const isGoogleEvent = event.source === "google-calendar" || event.readOnly;
  const isReadOnly = isTask || isGoogleEvent;
  const canDelete =
    isGeneratedFocusSession ||
    (isTaskDeadline && !!event.taskId) ||
    (!isReadOnly && event.source !== "google-calendar");
  const canComplete = isTask && !!event.taskId;

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isReadOnly) return;
      if (!summary.trim()) return;
      setError(null);
      try {
        const startAt = new Date(`${dateStr}T${startTime}`).toISOString();
        const endAt = new Date(`${dateStr}T${endTime}`).toISOString();
        await updateEventMutation.mutateAsync({
          id: event.id,
          summary: summary.trim(),
          startAt,
          endAt,
          location: location.trim(),
          description: description.trim(),
          tag: tag.trim(),
        });
        invalidateDateCache(event.date);
        invalidateDateCache(dateStr);
        close();
        await queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      } catch {
        setError("couldn't update event");
      }
    },
    [
      summary,
      dateStr,
      startTime,
      endTime,
      event.id,
      event.date,
      location,
      description,
      tag,
      isReadOnly,
      updateEventMutation,
      queryClient,
      close,
    ],
  );

  const remove = useCallback(async () => {
    if (!canDelete) return;
    setError(null);
    close();
    try {
      if (isGeneratedFocusSession) {
        dismissFocusSession(event.id);
      } else if (isTaskDeadline && event.taskId) {
        await deleteTaskMutation.mutateAsync(event.taskId);
      } else {
        await deleteEventMutation.mutateAsync(event.id);
      }
    } catch {
      setError(
        isTaskDeadline || isGeneratedFocusSession
          ? "couldn't delete task"
          : "couldn't delete event",
      );
    }
  }, [
    canDelete,
    event.id,
    event.taskId,
    isTaskDeadline,
    isGeneratedFocusSession,
    close,
    dismissFocusSession,
    deleteEventMutation,
    deleteTaskMutation,
  ]);

  const complete = useCallback(async () => {
    if (!event.taskId) return;
    setError(null);
    close();
    try {
      await completeTaskMutation.mutateAsync(event.taskId);
    } catch {
      setError("couldn't complete task");
    }
  }, [completeTaskMutation, event.taskId, close]);

  return (
    <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 space-y-2 overflow-y-auto pb-4">
        <input
          type="text"
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          className={`w-full ${workspacePageStyles.inlineInput}`}
          autoFocus
          readOnly={isReadOnly}
        />
        {isTaskDeadline && (
          <p className={workspacePageStyles.cardBodyText}>task deadline</p>
        )}
        {event.type === "plannedTask" && (
          <p className={workspacePageStyles.cardBodyText}>scheduled task</p>
        )}
        {isGoogleEvent && (
          <p className={workspacePageStyles.cardBodyText}>
            google calendar event
          </p>
        )}
        <input
          type="date"
          value={dateStr}
          onChange={(e) => setDateStr(e.target.value)}
          className={`w-full ${workspacePageStyles.inlineInputSmall}`}
          readOnly={isReadOnly}
        />
        {!event.allDay && (
          <div className={workspacePageStyles.timeInputRow}>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={workspacePageStyles.inlineInputSmall}
              readOnly={isReadOnly}
            />
            <span className={workspacePageStyles.cardBodyText}>→</span>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={workspacePageStyles.inlineInputSmall}
              readOnly={isReadOnly}
            />
          </div>
        )}
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="location"
          className={`w-full ${workspacePageStyles.inlineInput}`}
          readOnly={isReadOnly}
        />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="description"
          className={`min-h-24 w-full resize-none ${workspacePageStyles.inlineInput}`}
          readOnly={isReadOnly}
        />
        <TagSelect
          value={tag}
          onChange={setTag}
          readOnly={isReadOnly}
          options={tagOptions}
        />
      </div>
      {error && <p className={workspacePageStyles.errorText}>{error}</p>}
      <DialogFooter className={workspaceModalFooterClass}>
        {canDelete && (
          <button
            type="button"
            onClick={remove}
            disabled={
              deleteEventMutation.isPending ||
              deleteTaskMutation.isPending ||
              updateEventMutation.isPending
            }
            className={workspacePageStyles.modalDangerButton}
          >
            {deleteEventMutation.isPending || deleteTaskMutation.isPending
              ? "..."
              : "delete"}
          </button>
        )}
        {canComplete && (
          <button
            type="button"
            onClick={complete}
            disabled={completeTaskMutation.isPending}
            className={workspacePageStyles.modalButton}
          >
            {completeTaskMutation.isPending ? "..." : "complete"}
          </button>
        )}
        <button
          type="button"
          onClick={close}
          className={workspacePageStyles.modalButton}
        >
          cancel
        </button>
        {!isReadOnly && (
          <button
            type="submit"
            disabled={updateEventMutation.isPending || !summary.trim()}
            className={workspacePageStyles.modalButton}
          >
            {updateEventMutation.isPending ? "..." : "save"}
          </button>
        )}
      </DialogFooter>
    </form>
  );
}

export function EventDetailDialog({
  tagOptions = [],
}: {
  tagOptions?: string[];
}) {
  const { detailEvent: event, setDetailEvent } = useLifeStore();
  const lastEventRef = useRef<CalendarEvent | null>(null);
  if (event) lastEventRef.current = event;
  const displayEvent = event ?? lastEventRef.current;

  return (
    <WorkspaceDialog
      open={!!event}
      onOpenChange={(open) => !open && setDetailEvent(null)}
    >
      <DialogHeader className="gap-1">
        <DialogTitle className="font-normal text-[0.65rem] uppercase tracking-[0.3em]">
          event
        </DialogTitle>
      </DialogHeader>
      {displayEvent && (
        <EventDetailForm
          key={displayEvent.id}
          event={displayEvent}
          tagOptions={tagOptions}
        />
      )}
    </WorkspaceDialog>
  );
}
