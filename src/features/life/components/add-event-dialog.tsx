"use client";

import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState } from "react";
import {
  WorkspaceDialog,
  workspaceModalFooterClass,
} from "@/components/layout/workspace-dialog";
import { createCalendarEvent } from "@/features/life/api/life";
import { TagSelect } from "@/features/life/components/tag-select";
import { invalidateAll } from "@/features/life/lib/calendar-cache";
import { calendarQueryKey } from "@/features/life/lib/calendar-query";
import {
  formatDateLabel,
  toDateString,
} from "@/features/life/lib/calendar-utils";
import { useLifeStore } from "@/features/life/stores/life-store";
import type { CalendarEvent } from "@/types/workspace";

export type AddEventState = {
  date: Date;
  startTime: string;
  endTime: string;
};

function timeToMinute(value: string) {
  const [hour = "0", minute = "0"] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function EventForm({
  state,
  tagOptions,
}: {
  state: AddEventState;
  tagOptions: string[];
}) {
  const queryClient = useQueryClient();
  const { calendarMode, selectedDate, setAddEvent } = useLifeStore();
  const [summary, setSummary] = useState("");
  const [dateStr, setDateStr] = useState(toDateString(state.date));
  const [startTime, setStartTime] = useState(state.startTime);
  const [endTime, setEndTime] = useState(state.endTime);
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const createEventMutation = useMutation({ mutationFn: createCalendarEvent });
  const [tag, setTag] = useState("");

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!summary.trim()) return;
      try {
        const startAt = new Date(`${dateStr}T${startTime}`).toISOString();
        const endAt = new Date(`${dateStr}T${endTime}`).toISOString();
        const trimmedTag = tag.trim();
        const optimisticEvent: CalendarEvent = {
          id: `optimistic-${crypto.randomUUID()}`,
          summary: summary.trim(),
          startMinute: timeToMinute(startTime),
          endMinute: Math.max(
            timeToMinute(startTime) + 1,
            timeToMinute(endTime),
          ),
          type: "default",
          dayIndex: new Date(`${dateStr}T12:00:00`).getDay(),
          date: dateStr,
          tag: trimmedTag || null,
          location: location.trim() || undefined,
          description: description.trim() || undefined,
        };
        queryClient.setQueryData<CalendarEvent[]>(
          calendarQueryKey(calendarMode, selectedDate),
          (events) => [...(events ?? []), optimisticEvent],
        );
        setAddEvent(null);
        await createEventMutation.mutateAsync({
          summary: summary.trim(),
          startAt,
          endAt,
          ...(location.trim() && { location: location.trim() }),
          ...(description.trim() && { description: description.trim() }),
          ...(trimmedTag && { tag: trimmedTag }),
        });
        invalidateAll(new Date(startAt));
        await queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      } catch {
        await queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      }
    },
    [
      summary,
      dateStr,
      startTime,
      endTime,
      location,
      description,
      tag,
      calendarMode,
      selectedDate,
      createEventMutation,
      queryClient,
      setAddEvent,
    ],
  );

  return (
    <form onSubmit={submit} className={workspacePageStyles.formGroup}>
      <input
        type="text"
        value={summary}
        onChange={(e) => setSummary(e.target.value)}
        placeholder="event title"
        className={`w-full ${workspacePageStyles.inlineInput}`}
        autoFocus
      />
      <input
        type="date"
        value={dateStr}
        onChange={(e) => setDateStr(e.target.value)}
        className={`w-full ${workspacePageStyles.inlineInputSmall}`}
      />
      <div className={workspacePageStyles.timeInputRow}>
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className={workspacePageStyles.inlineInputSmall}
        />
        <span className={workspacePageStyles.cardBodyText}>→</span>
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className={workspacePageStyles.inlineInputSmall}
        />
      </div>
      <input
        type="text"
        value={location}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="location"
        className={`w-full ${workspacePageStyles.inlineInput}`}
      />
      <TagSelect value={tag} onChange={setTag} options={tagOptions} />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="description"
        rows={2}
        className={`w-full resize-none ${workspacePageStyles.inlineInput}`}
      />
      <DialogFooter className={workspaceModalFooterClass}>
        <button
          type="button"
          onClick={() => setAddEvent(null)}
          className={workspacePageStyles.modalButton}
        >
          cancel
        </button>
        <button
          type="submit"
          disabled={createEventMutation.isPending || !summary.trim()}
          className={workspacePageStyles.modalButton}
        >
          {createEventMutation.isPending ? "..." : "create"}
        </button>
      </DialogFooter>
    </form>
  );
}

export function AddEventDialog({ tagOptions = [] }: { tagOptions?: string[] }) {
  const { addEvent: state, setAddEvent } = useLifeStore();
  const lastStateRef = useRef<AddEventState | null>(null);
  if (state) lastStateRef.current = state;
  const displayState = state ?? lastStateRef.current;

  return (
    <WorkspaceDialog
      open={!!state}
      onOpenChange={(open) => !open && setAddEvent(null)}
    >
      <DialogHeader className="gap-1">
        <DialogTitle className="font-normal text-[0.65rem] uppercase tracking-[0.3em]">
          add event
        </DialogTitle>
        {displayState && (
          <DialogDescription className="text-[0.6rem] text-muted-foreground">
            {formatDateLabel(displayState.date)}
          </DialogDescription>
        )}
      </DialogHeader>
      {displayState && (
        <EventForm
          key={`${displayState.date.getTime()}-${displayState.startTime}`}
          state={displayState}
          tagOptions={tagOptions}
        />
      )}
    </WorkspaceDialog>
  );
}
