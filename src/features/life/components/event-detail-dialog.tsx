"use client";

import { DialogHeader, DialogTitle } from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import { WorkspaceDialog } from "@/components/layout/workspace-dialog";
import {
  completeTask,
  deleteCalendarEvent,
  deleteTask,
  updateCalendarEvent,
} from "@/features/life/api/life";
import { minuteToTime } from "@/features/life/lib/calendar-utils";
import { useLifeStore } from "@/features/life/stores/life-store";
import { queryKeys } from "@/lib/query/keys";
import type { CalendarEvent, LifeSnapshot } from "@/types/workspace";

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

function EventDetailForm({ event }: { event: CalendarEvent }) {
  const queryClient = useQueryClient();
  const { setDetailEvent } = useLifeStore();
  const [summary, setSummary] = useState(event.summary);
  const [dateStr, setDateStr] = useState(event.date);
  const [startTime, setStartTime] = useState(minuteToTime(event.startMinute));
  const [endTime, setEndTime] = useState(minuteToTime(event.endMinute));
  const [tag, setTag] = useState(event.tag ?? "");
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
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] }),
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
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
    },
  });
  const isTaskDeadline = event.type === "taskDeadline";
  const isTask = isTaskDeadline || event.type === "plannedTask";
  const isGoogleEvent = event.source === "google-calendar" || event.readOnly;
  const isReadOnly = isTask || isGoogleEvent;
  const canDelete =
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
        const startDateTime = new Date(`${dateStr}T${startTime}`).toISOString();
        const endDateTime = new Date(`${dateStr}T${endTime}`).toISOString();
        await updateEventMutation.mutateAsync({
          id: event.id,
          summary: summary.trim(),
          startDateTime,
          endDateTime,
          tag: tag.trim().toLowerCase(),
        });
        setDetailEvent(null);
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
      tag,
      isReadOnly,
      updateEventMutation,
      queryClient,
      setDetailEvent,
    ],
  );

  const remove = useCallback(async () => {
    if (!canDelete) return;
    setError(null);
    setDetailEvent(null);
    try {
      if (isTaskDeadline && event.taskId) {
        await deleteTaskMutation.mutateAsync(event.taskId);
      } else {
        await deleteEventMutation.mutateAsync(event.id);
      }
    } catch {
      setError(
        isTaskDeadline ? "couldn't remove task" : "couldn't remove event",
      );
    }
  }, [
    canDelete,
    event.id,
    event.taskId,
    isTaskDeadline,
    setDetailEvent,
    deleteEventMutation,
    deleteTaskMutation,
  ]);

  const complete = useCallback(async () => {
    if (!event.taskId) return;
    setError(null);
    setDetailEvent(null);
    try {
      await completeTaskMutation.mutateAsync(event.taskId);
    } catch {
      setError("couldn't complete task");
    }
  }, [completeTaskMutation, event.taskId, setDetailEvent]);

  return (
    <form onSubmit={submit} className={workspacePageStyles.formGroup}>
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
        value={tag}
        onChange={(e) => setTag(e.target.value)}
        placeholder="tag"
        className={`w-full ${workspacePageStyles.inlineInput}`}
        readOnly={isReadOnly}
      />
      {error && <p className={workspacePageStyles.errorText}>{error}</p>}
      <div className={workspacePageStyles.formActions}>
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
              : "remove"}
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
          onClick={() => setDetailEvent(null)}
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
      </div>
    </form>
  );
}

export function EventDetailDialog() {
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
        <EventDetailForm key={displayEvent.id} event={displayEvent} />
      )}
    </WorkspaceDialog>
  );
}
