"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  fetchCalendarEvents,
  moveTaskSession,
  updateCalendarEvent,
  updateTask,
} from "@/features/life/api/life";
import {
  DAY_KEYS,
  groupByDay,
  invalidateAll,
} from "@/features/life/lib/calendar-cache";
import {
  calendarQueryKey,
  calendarRangeParams,
} from "@/features/life/lib/calendar-query";
import {
  formatDateLabel,
  formatMonthLabel,
  formatWeekLabel,
  getWeekStart,
  isSameDate,
  minuteToTime,
  toDateString,
  toWeekKey,
} from "@/features/life/lib/calendar-utils";
import { useLifeStore } from "@/features/life/stores/life-store";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { queryKeys } from "@/lib/query/keys";
import type { CalendarEvent, LifePriorityTask } from "@/types/workspace";
import { CalendarFrame } from "./calendar-frame";

export type CalendarMode = "day" | "week" | "month";
const CALENDAR_STALE_TIME_MS = 15 * 60_000;
const CALENDAR_GC_TIME_MS = 24 * 60 * 60_000;
const CALENDAR_PREFETCH_RADIUS = 2;

function eventInView(
  event: CalendarEvent,
  mode: CalendarMode,
  selectedDate: Date,
) {
  if (mode === "day") return event.date === toDateString(selectedDate);
  if (mode === "week") {
    const weekStart = getWeekStart(selectedDate);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);
    return (
      event.date >= toDateString(weekStart) &&
      event.date <= toDateString(weekEnd)
    );
  }
  return (
    event.date >=
      toDateString(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1),
      ) &&
    event.date <=
      toDateString(
        new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0),
      )
  );
}

function invalidateDateCache(value: number | string | null | undefined) {
  if (value === null || value === undefined) return;
  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) invalidateAll(date);
}

// ── Main component ───────────────────────────────

interface CalendarViewProps {
  hasCalendar: boolean;
  today: Date;
  tasks?: LifePriorityTask[];
  events?: CalendarEvent[];
  tagOptions?: string[];
}

export function CalendarView(props: CalendarViewProps) {
  return useCalendarViewContent(props);
}

function useCalendarViewContent({
  hasCalendar,
  today,
  tasks = [],
  events: modelEvents,
  tagOptions = [],
}: CalendarViewProps) {
  const todayRef = useRef(today);
  const queryClient = useQueryClient();
  const {
    calendarMode: mode,
    selectedDate,
    isCalendarFullscreen: isFullscreen,
    detailEvent,
    detailTask,
    setCalendarMode: setMode,
    setSelectedDate,
    setAddEvent,
    setDetailEvent,
    setDetailTask,
    setCalendarFullscreen,
  } = useLifeStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [optimisticMoves, setOptimisticMoves] = useState<
    Map<string, CalendarEvent>
  >(new Map());
  const moveSequenceRef = useRef(new Map<string, number>());
  const updateEventMutation = useMutation({
    mutationFn: updateCalendarEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
    },
  });
  const updateTaskMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: unknown }) =>
      updateTask(id, input),
    onSuccess: (_data, variables) => {
      const task = tasks.find((candidate) => candidate.id === variables.id);
      invalidateDateCache(task?.dueAt);
      if (
        typeof variables.input === "object" &&
        variables.input !== null &&
        "dueAt" in variables.input
      ) {
        invalidateDateCache(variables.input.dueAt as string | null | undefined);
      }
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
    },
  });
  const moveTaskSessionMutation = useMutation({
    mutationFn: moveTaskSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["life", "calendar"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.snapshot() });
      queryClient.invalidateQueries({ queryKey: queryKeys.life.tasks() });
    },
  });
  const viewDate =
    selectedDate.getTime() === 0 ? todayRef.current : selectedDate;
  const isToday = isSameDate(viewDate, todayRef.current);
  const fallbackCalendarData = isHydrated
    ? cachedCalendarData(queryClient, mode, viewDate)
    : null;

  const usesModelEvents = modelEvents !== undefined;
  const isRealDate = viewDate.getTime() !== 0;
  const calendarQuery = useQuery({
    queryKey: calendarQueryKey(mode, viewDate),
    queryFn: () => fetchAndCacheCalendarRange(queryClient, viewDate, mode),
    enabled: hasCalendar && !usesModelEvents && isHydrated && isRealDate,
    staleTime: CALENDAR_STALE_TIME_MS,
    gcTime: CALENDAR_GC_TIME_MS,
    placeholderData: fallbackCalendarData ?? undefined,
  });

  const events = useMemo(
    () =>
      (modelEvents ?? calendarQuery.data ?? [])
        .filter((event) => eventInView(event, mode, viewDate))
        .map((event) => optimisticMoves.get(event.id) ?? event),
    [calendarQuery.data, mode, modelEvents, optimisticMoves, viewDate],
  );
  const fetchError =
    !usesModelEvents && calendarQuery.isError ? "couldn't load events" : null;

  const prefetchView = useCallback(
    (date: Date, viewMode: CalendarMode) => {
      if (!hasCalendar) return;
      queryClient.prefetchQuery({
        queryKey: calendarQueryKey(viewMode, date),
        queryFn: () => fetchAndCacheCalendarRange(queryClient, date, viewMode),
        staleTime: CALENDAR_STALE_TIME_MS,
        gcTime: CALENDAR_GC_TIME_MS,
      });
    },
    [hasCalendar, queryClient],
  );

  const prefetchWindow = useCallback(
    (date: Date, viewMode: CalendarMode) => {
      if (!hasCalendar) return;

      for (
        let offset = -CALENDAR_PREFETCH_RADIUS;
        offset <= CALENDAR_PREFETCH_RADIUS;
        offset += 1
      ) {
        prefetchView(shiftCalendarDate(date, viewMode, offset), viewMode);
      }

      if (viewMode !== "month") {
        for (
          let offset = -CALENDAR_PREFETCH_RADIUS;
          offset <= CALENDAR_PREFETCH_RADIUS;
          offset += 1
        ) {
          prefetchView(
            new Date(date.getFullYear(), date.getMonth() + offset, 1),
            "month",
          );
        }
      }
    },
    [hasCalendar, prefetchView],
  );

  useMountEffect(() => {
    setIsHydrated(true);
    const timer = window.setTimeout(() => prefetchWindow(viewDate, mode), 500);
    return () => window.clearTimeout(timer);
  });

  const navigate = (delta: number) => {
    const next = new Date(viewDate);
    if (mode === "day") next.setDate(next.getDate() + delta);
    else if (mode === "week") next.setDate(next.getDate() + delta * 7);
    else next.setMonth(next.getMonth() + delta);
    setSelectedDate(next);
    prefetchWindow(next, mode);
  };

  const goToday = () => {
    const now = new Date();
    todayRef.current = now;
    setSelectedDate(now);
    prefetchWindow(now, mode);
  };

  const handleDayClick = useCallback(
    (d: Date) => {
      setSelectedDate(d);
      setMode("day");
      prefetchWindow(d, "day");
    },
    [setMode, setSelectedDate, prefetchWindow],
  );

  const handleSlotClick = useCallback(
    (colKey: string, minute: number) => {
      let date: Date;
      if (colKey === "day-0") {
        date = viewDate;
      } else {
        const weekStart = getWeekStart(viewDate);
        const dayIdx = DAY_KEYS.indexOf(colKey);
        date = new Date(weekStart);
        date.setDate(date.getDate() + (dayIdx >= 0 ? dayIdx : 0));
      }
      const startTime = minuteToTime(minute);
      const endMin = Math.min(minute + 60, 1440);
      const endTime = minuteToTime(endMin);
      setAddEvent({ date, startTime, endTime });
    },
    [viewDate, setAddEvent],
  );

  const handleEventClick = useCallback(
    (ev: CalendarEvent) => {
      if (
        (ev.type === "taskDeadline" || ev.type === "plannedTask") &&
        ev.taskId
      ) {
        const task = tasks.find((candidate) => candidate.id === ev.taskId);
        if (task) {
          setDetailEvent(null);
          setDetailTask(task);
          return;
        }
      }
      setDetailTask(null);
      setDetailEvent(ev);
    },
    [setDetailEvent, setDetailTask, tasks],
  );

  const dateForColumn = useCallback(
    (colKey: string) => {
      if (colKey === "day-0") return viewDate;
      const weekStart = getWeekStart(viewDate);
      const dayIdx = DAY_KEYS.indexOf(colKey);
      const date = new Date(weekStart);
      date.setDate(date.getDate() + (dayIdx >= 0 ? dayIdx : 0));
      return date;
    },
    [viewDate],
  );

  const handleEventMove = useCallback(
    async (event: CalendarEvent, colKey: string, minute: number) => {
      if (event.readOnly || event.source === "google-calendar") return;
      const isTaskDeadline = event.type === "taskDeadline";
      const isPlannedTask = event.type === "plannedTask";
      const taskSessionId = isPlannedTask ? event.sessionId : undefined;
      if (event.allDay && !isTaskDeadline) return;
      if (isTaskDeadline && !event.taskId) return;
      if (isPlannedTask && !taskSessionId) return;
      const date = dateForColumn(colKey);
      const duration = Math.max(1, event.endMinute - event.startMinute);
      const start = new Date(date);
      start.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
      const end = new Date(start.getTime() + duration * 60_000);
      const taskDate = toDateString(date);
      const moved: CalendarEvent = {
        ...event,
        startMinute: isTaskDeadline
          ? event.startMinute
          : start.getHours() * 60 + start.getMinutes(),
        endMinute: isTaskDeadline
          ? event.endMinute
          : Math.min(
              1440,
              start.getHours() * 60 + start.getMinutes() + duration,
            ),
        dayIndex: date.getDay(),
        date: isTaskDeadline ? taskDate : toDateString(start),
        allDay: isTaskDeadline,
      };
      setOptimisticMoves((current) => {
        const next = new Map(current);
        next.set(moved.id, moved);
        return next;
      });
      const sequence = (moveSequenceRef.current.get(moved.id) ?? 0) + 1;
      moveSequenceRef.current.set(moved.id, sequence);
      if (detailEvent?.id === moved.id) setDetailEvent(moved);

      try {
        if (isPlannedTask && taskSessionId) {
          await moveTaskSessionMutation.mutateAsync({
            id: taskSessionId,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
          });
        } else if (isTaskDeadline && event.taskId) {
          await updateTaskMutation.mutateAsync({
            id: event.taskId,
            input: { dueAt: new Date(`${taskDate}T23:59:00`).toISOString() },
          });
        } else {
          await updateEventMutation.mutateAsync({
            id: event.id,
            summary: event.summary,
            startAt: start.toISOString(),
            endAt: end.toISOString(),
            tag: event.tag ?? undefined,
          });
        }
        if (moveSequenceRef.current.get(moved.id) !== sequence) return;
        void queryClient.invalidateQueries({
          queryKey: ["life", "calendar"],
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.life.snapshot(),
        });
      } catch {
        if (moveSequenceRef.current.get(moved.id) !== sequence) return;
        setOptimisticMoves((current) => {
          const next = new Map(current);
          next.delete(moved.id);
          return next;
        });
        if (detailEvent?.id === moved.id) setDetailEvent(event);
      }
    },
    [
      dateForColumn,
      detailEvent,
      queryClient,
      setDetailEvent,
      updateEventMutation,
      updateTaskMutation,
      moveTaskSessionMutation,
    ],
  );

  const dayColumns = useMemo(() => [{ key: "day-0", events }], [events]);
  const weekColumns = useMemo(() => groupByDay(events), [events]);

  const isCurrentWeek = isSameDate(
    getWeekStart(viewDate),
    getWeekStart(todayRef.current),
  );
  const todayDayIdx = todayRef.current.getDay();
  const todayKey =
    mode === "week" && isCurrentWeek
      ? DAY_KEYS[todayDayIdx]
      : mode === "day" && isToday
        ? "day-0"
        : undefined;

  const scrollKey = `${mode}-${mode === "day" ? toDateString(viewDate) : toWeekKey(viewDate)}`;

  const navLabel =
    mode === "day"
      ? formatDateLabel(viewDate)
      : mode === "week"
        ? formatWeekLabel(viewDate)
        : formatMonthLabel(viewDate);

  if (!hasCalendar) {
    return (
      <div className="space-y-2">
        <p className={workspacePageStyles.cardLabel}>{"// calendar"}</p>
        <p className={workspacePageStyles.cardBodyText}>calendar unavailable</p>
      </div>
    );
  }

  return (
    <CalendarFrame
      mode={mode}
      selectedDate={viewDate}
      today={todayRef.current}
      isToday={isToday}
      isFullscreen={isFullscreen}
      navLabel={navLabel}
      fetchError={fetchError}
      scrollKey={scrollKey}
      dayColumns={dayColumns}
      weekColumns={weekColumns}
      todayKey={todayKey}
      events={events}
      detailTask={detailTask}
      tagOptions={tagOptions}
      onGoToday={goToday}
      onNavigate={navigate}
      onModeChange={(newMode) => {
        setMode(newMode);
        prefetchWindow(viewDate, newMode);
      }}
      onToggleFullscreen={() => setCalendarFullscreen(!isFullscreen)}
      onSlotClick={handleSlotClick}
      onEventClick={handleEventClick}
      onEventMove={handleEventMove}
      onDayClick={handleDayClick}
      onTaskDialogOpenChange={(open) => !open && setDetailTask(null)}
    />
  );
}

function shiftCalendarDate(date: Date, mode: CalendarMode, offset: number) {
  const shifted = new Date(date);
  if (mode === "day") shifted.setDate(shifted.getDate() + offset);
  else if (mode === "week") shifted.setDate(shifted.getDate() + offset * 7);
  else shifted.setMonth(shifted.getMonth() + offset);
  return shifted;
}

function cachedCalendarData(
  queryClient: QueryClient,
  mode: CalendarMode,
  date: Date,
) {
  const exact = queryClient.getQueryData<CalendarEvent[]>(
    calendarQueryKey(mode, date),
  );
  if (exact) return exact;

  if (mode === "day") {
    const dayKey = toDateString(date);
    const week = queryClient.getQueryData<CalendarEvent[]>(
      calendarQueryKey("week", date),
    );
    if (week) return week.filter((event) => event.date === dayKey);
    const month = queryClient.getQueryData<CalendarEvent[]>(
      calendarQueryKey("month", date),
    );
    if (month) return month.filter((event) => event.date === dayKey);
  }

  if (mode === "week") {
    const weekStart = getWeekStart(date);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const month = queryClient.getQueryData<CalendarEvent[]>(
      calendarQueryKey("month", date),
    );
    if (month) {
      return month.filter((event) => {
        const eventDate = new Date(`${event.date}T12:00:00`);
        return eventDate >= weekStart && eventDate < weekEnd;
      });
    }
  }

  return null;
}

async function fetchAndCacheCalendarRange(
  queryClient: QueryClient,
  date: Date,
  mode: CalendarMode,
) {
  const events = await fetchCalendarRange(date, mode);
  seedCalendarCaches(queryClient, date, mode, events);
  return events;
}

function fetchCalendarRange(date: Date, mode: CalendarMode) {
  return fetchCalendarEvents(calendarRangeParams(date, mode));
}

function seedCalendarCaches(
  queryClient: QueryClient,
  date: Date,
  mode: CalendarMode,
  events: CalendarEvent[],
) {
  queryClient.setQueryData(calendarQueryKey(mode, date), events);

  if (mode === "day") return;

  const eventsByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const dayEvents = eventsByDay.get(event.date) ?? [];
    dayEvents.push(event);
    eventsByDay.set(event.date, dayEvents);
  }
  for (const [dateKey, dayEvents] of eventsByDay) {
    queryClient.setQueryData(
      queryKeys.life.calendar("day", dateKey),
      dayEvents,
    );
  }
}
