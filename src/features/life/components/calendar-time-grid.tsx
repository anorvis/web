"use client";

import { calendarStyles } from "@anorvis/ui/styles";
import { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  getVisibleRange,
  layoutEvents,
} from "@/features/life/lib/calendar-layout";
import {
  formatHour,
  formatMinuteRange,
  toDateString,
  weekHeaderDays,
} from "@/features/life/lib/calendar-utils";
import { useMountEffect } from "@/hooks/use-mount-effect";
import type { CalendarEvent, LayoutEvent } from "@/types/workspace";

// ── Constants ────────────────────────────────────

const GUTTER_WIDTH = 48;
const PX_PER_HOUR = 55;
const GRID_PAD_TOP = Math.round(PX_PER_HOUR / 2);
const DRAG_PREVIEW_ID_SUFFIX = "::drag-preview";
const TASK_EVENT_TYPES = new Set<CalendarEvent["type"]>([
  "plannedTask",
  "taskDeadline",
]);

// ── Helpers ──────────────────────────────────────

function pct(minute: number, from: number, len: number) {
  return ((minute - from) / len) * 100;
}

function getNowMinute() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function getEventBlockTone(event: CalendarEvent) {
  if (event.type === "taskDeadline") return getTaskTone("deadline");
  if (event.type === "plannedTask") return getTaskTone("session");
  if (event.type === "focusTime" && event.source === "time-block")
    return "border-l-purple-500 bg-purple-500/10 text-purple-800 dark:text-purple-100";
  if (event.source === "google-calendar") {
    return getGoogleCalendarTone(event.calendarId ?? event.id);
  }
  const tagTone = getTagTone(event.tag);
  if (tagTone) return tagTone;
  if (event.source === "local") {
    return "border-l-foreground bg-foreground/10 text-foreground";
  }
  return "border-l-foreground bg-foreground/5 text-foreground";
}

function getTaskTone(kind: "deadline" | "session") {
  if (kind === "deadline") {
    return "border-l-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  }
  return "border-l-teal-500 border-dashed bg-teal-500/10 text-teal-800 dark:text-teal-100";
}

function getGoogleCalendarTone(seed: string) {
  const tones = [
    "border-l-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-200",
    "border-l-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-200",
    "border-l-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
    "border-l-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-200",
    "border-l-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-200",
  ];
  const hash = Array.from(seed).reduce(
    (sum, char) => sum + char.charCodeAt(0),
    0,
  );
  return tones[hash % tones.length];
}

function getTagTone(tag?: string | null) {
  switch (tag?.toLowerCase()) {
    case "work":
      return "border-l-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-200";
    case "personal":
      return "border-l-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-200";
    case "health":
      return "border-l-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200";
    case "social":
      return "border-l-pink-500 bg-pink-500/10 text-pink-700 dark:text-pink-200";
    case "travel":
      return "border-l-orange-500 bg-orange-500/10 text-orange-700 dark:text-orange-200";
    default:
      return "";
  }
}

function createDragImage() {
  const image = document.createElement("canvas");
  image.width = 1;
  image.height = 1;
  return image;
}

function clampStartMinute(minute: number, event: CalendarEvent) {
  const duration = Math.max(1, event.endMinute - event.startMinute);
  return Math.max(0, Math.min(1440 - duration, minute));
}

function isDraggableTaskEvent(event: CalendarEvent) {
  return TASK_EVENT_TYPES.has(event.type) && Boolean(event.taskId);
}

function taskDragPreviewEvent(event: CalendarEvent): CalendarEvent {
  if (!isDraggableTaskEvent(event)) return event;
  const startMinute = Math.min(event.startMinute, 23 * 60);
  return {
    ...event,
    allDay: false,
    startMinute,
    endMinute: Math.min(1440, startMinute + 60),
  };
}

// ── Event block ──────────────────────────────────

const EventBlock = memo(function EventBlock({
  event,
  from,
  len,
  onClick,
  onDragStart,
  onDragEnd,
  isDragging,
  isDragPreview,
}: {
  event: LayoutEvent;
  from: number;
  len: number;
  onClick?: (event: CalendarEvent) => void;
  onDragStart?: (event: CalendarEvent) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
  isDragPreview?: boolean;
}) {
  const start = Math.max(from, event.startMinute);
  const end = Math.min(from + len, event.endMinute);
  const duration = end - start;
  const isShort = duration < 45;
  const leftPct = (event.column / event.totalColumns) * 100;
  const widthPct = (1 / event.totalColumns) * 100;

  return (
    <button
      type="button"
      className={`${calendarStyles.eventBlock} ${isDragPreview ? calendarStyles.dragHoverBlock : ""} ${getEventBlockTone(event)} ${onClick && !isDragPreview ? "cursor-pointer" : ""} ${onDragStart ? "cursor-grab active:cursor-grabbing" : ""} ${isDragging ? "opacity-0" : ""}`}
      style={{
        top: `${pct(start, from, len)}%`,
        height: `${(duration / len) * 100}%`,
        minHeight: "14px",
        left: `${leftPct}%`,
        width: `${widthPct}%`,
      }}
      title={`${event.summary}\n${formatMinuteRange(event.startMinute, event.endMinute)}`}
      data-event-block
      onClick={onClick && !isDragPreview ? () => onClick(event) : undefined}
      onKeyDown={
        onClick && !isDragPreview
          ? (keyEvent) => {
              if (keyEvent.key === "Enter" || keyEvent.key === " ") {
                keyEvent.preventDefault();
                onClick(event);
              }
            }
          : undefined
      }
      tabIndex={onClick && !isDragPreview ? 0 : undefined}
      aria-label={`${event.summary} ${formatMinuteRange(event.startMinute, event.endMinute)}`}
      draggable={!!onDragStart && !isDragPreview}
      onDragStart={
        onDragStart
          ? (dragEvent) => {
              dragEvent.dataTransfer.effectAllowed = "move";
              dragEvent.dataTransfer.setData("text/plain", event.id);
              dragEvent.dataTransfer.setDragImage(createDragImage(), 0, 0);
              onDragStart(event);
            }
          : undefined
      }
      onDragEnd={onDragEnd}
    >
      <p className={calendarStyles.eventBlockTitle}>
        {event.type === "taskDeadline" ? "due: " : ""}
        {event.tag ? `[${event.tag}] ` : ""}
        {event.summary}
      </p>
      {!isShort && (
        <p className={calendarStyles.eventBlockTime}>
          {formatMinuteRange(event.startMinute, event.endMinute)}
        </p>
      )}
    </button>
  );
});

// ── Current time indicator ──────────────────────

function TimeIndicator({ from, len }: { from: number; len: number }) {
  const [nowMinute, setNowMinute] = useState<number | null>(null);

  useMountEffect(() => {
    setNowMinute(getNowMinute());
    const id = setInterval(() => setNowMinute(getNowMinute()), 60_000);
    return () => clearInterval(id);
  });

  if (nowMinute === null || nowMinute < from || nowMinute > from + len) {
    return null;
  }

  return (
    <div
      className={calendarStyles.timeIndicator}
      style={{ top: `${pct(nowMinute, from, len)}%` }}
    >
      <div className={calendarStyles.timeIndicatorDot} />
    </div>
  );
}

// ── Column (one day) ─────────────────────────────

const DayCol = memo(function DayCol({
  events,
  from,
  len,
  isToday,
  onEmptyClick,
  onEventClick,
  onEventMove,
  onEventDragStart,
  onEventDragEnd,
  onEventDragPreview,
  draggingEventId,
  dragPreview,
}: {
  events: CalendarEvent[];
  from: number;
  len: number;
  isToday: boolean;
  onEmptyClick?: (minute: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventMove?: (minute: number) => void;
  onEventDragStart?: (event: CalendarEvent) => void;
  onEventDragEnd?: () => void;
  onEventDragPreview?: (minute: number) => void;
  draggingEventId?: string | null;
  dragPreview?: DragPreview | null;
}) {
  const timed = useMemo(() => {
    const base = events.filter((e) => !e.allDay);
    if (!dragPreview) return base;
    const duration = Math.max(
      1,
      dragPreview.event.endMinute - dragPreview.event.startMinute,
    );
    return [
      ...base.filter((event) => event.id !== dragPreview.event.id),
      {
        ...dragPreview.event,
        id: `${dragPreview.event.id}${DRAG_PREVIEW_ID_SUFFIX}`,
        startMinute: dragPreview.minute,
        endMinute: Math.min(1440, dragPreview.minute + duration),
      },
    ];
  }, [dragPreview, events]);
  const laid = useMemo(() => layoutEvents(timed), [timed]);
  const hiddenDragSource = useMemo<LayoutEvent | null>(() => {
    if (!dragPreview || draggingEventId !== dragPreview.event.id) return null;
    return {
      ...dragPreview.event,
      column: 0,
      totalColumns: 1,
    };
  }, [dragPreview, draggingEventId]);
  const renderedEvents = useMemo(
    () => (hiddenDragSource ? [hiddenDragSource, ...laid] : laid),
    [hiddenDragSource, laid],
  );

  const openEmptySlot = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onEmptyClick) return;
      if ((e.target as HTMLElement).closest("[data-event-block]")) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const minute = Math.floor((from + (y / rect.height) * len) / 60) * 60;
      onEmptyClick(minute);
    },
    [onEmptyClick, from, len],
  );

  const openEmptySlotFromKeyboard = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!onEmptyClick || (e.key !== "Enter" && e.key !== " ")) return;
      e.preventDefault();
      onEmptyClick(Math.floor(from / 60) * 60);
    },
    [from, onEmptyClick],
  );

  const minuteFromPointer = useCallback(
    (e: React.MouseEvent<HTMLDivElement> | React.DragEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      return Math.floor((from + (y / rect.height) * len) / 15) * 15;
    },
    [from, len],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!onEventMove) return;
      e.preventDefault();
      onEventMove(Math.max(0, Math.min(1439, minuteFromPointer(e))));
    },
    [minuteFromPointer, onEventMove],
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      if (!onEventMove) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      onEventDragPreview?.(Math.max(0, Math.min(1439, minuteFromPointer(e))));
    },
    [minuteFromPointer, onEventDragPreview, onEventMove],
  );

  const hourCells = useMemo(() => {
    const cells: number[] = [];
    const start = Math.ceil(from / 60);
    const end = Math.floor((from + len) / 60);
    for (let h = start; h < end; h++) cells.push(h);
    return cells;
  }, [from, len]);

  return (
    <div
      className={`${calendarStyles.dayCol} ${onEmptyClick ? "cursor-pointer" : ""}`}
      onClick={openEmptySlot}
      onKeyDown={openEmptySlotFromKeyboard}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      tabIndex={onEmptyClick ? 0 : undefined}
      title={onEmptyClick ? "Create event in empty time slot" : undefined}
    >
      {hourCells.map((h) => (
        <div
          key={`hc-${h}`}
          className={calendarStyles.hourCellHover}
          style={{
            top: `${pct(h * 60, from, len)}%`,
            height: `${(60 / len) * 100}%`,
          }}
        />
      ))}
      {isToday && <TimeIndicator from={from} len={len} />}
      {renderedEvents.map((ev) => (
        <EventBlock
          key={ev.id}
          event={ev}
          from={from}
          len={len}
          onClick={onEventClick}
          onDragStart={
            ev.readOnly ||
            ev.allDay ||
            ev.type === "taskDeadline" ||
            ev.id.endsWith(DRAG_PREVIEW_ID_SUFFIX)
              ? undefined
              : onEventDragStart
          }
          onDragEnd={onEventDragEnd}
          isDragging={draggingEventId === ev.id}
          isDragPreview={ev.id.endsWith(DRAG_PREVIEW_ID_SUFFIX)}
        />
      ))}
    </div>
  );
});

// ── All-day row ─────────────────────────────────

const AllDayRow = memo(function AllDayRow({
  columns,
  gridCols,
  onEventClick,
  onEventDragStart,
  onEventDragEnd,
  onEventDateMove,
  draggingEventId,
}: {
  columns: TimeGridColumn[];
  gridCols: string;
  onEventClick?: (event: CalendarEvent) => void;
  onEventDragStart?: (
    event: CalendarEvent,
    dragState?: { x: number; y: number; offsetX: number; offsetY: number },
  ) => void;
  onEventDragEnd?: () => void;
  onEventDateMove?: (colKey: string) => void;
  draggingEventId?: string | null;
}) {
  const hasAllDay = columns.some((col) =>
    col.events.some((event) => event.allDay),
  );
  if (!hasAllDay) return null;

  return (
    <div
      className={calendarStyles.allDayRow}
      style={{ gridTemplateColumns: gridCols }}
    >
      <div className={calendarStyles.allDayGutter}>all day</div>
      {columns.map((col) => {
        const allDay = col.events.filter((event) => event.allDay);
        return (
          <div
            key={col.key}
            className={calendarStyles.allDayCol}
            onDragOver={
              onEventDateMove
                ? (dragEvent) => {
                    dragEvent.preventDefault();
                    dragEvent.dataTransfer.dropEffect = "move";
                  }
                : undefined
            }
            onDrop={
              onEventDateMove
                ? (dragEvent) => {
                    dragEvent.preventDefault();
                    onEventDateMove(col.key);
                  }
                : undefined
            }
          >
            {allDay.map((event) => (
              <button
                key={event.id}
                type="button"
                className={`${
                  event.type === "taskDeadline"
                    ? calendarStyles.deadlineAllDayChip
                    : event.type === "plannedTask"
                      ? "block w-full min-w-0 overflow-hidden border-l-2 border-l-teal-500 border-dashed bg-teal-500/10 px-1.5 py-0.5 text-left text-teal-800 hover:bg-teal-500/15 dark:text-teal-100"
                      : event.source === "google-calendar"
                        ? calendarStyles.googleAllDayChip
                        : calendarStyles.allDayChip
                } ${onEventClick ? "cursor-pointer" : ""} ${
                  isDraggableTaskEvent(event)
                    ? "cursor-grab active:cursor-grabbing"
                    : ""
                } ${draggingEventId === event.id ? "opacity-0" : ""}`}
                data-event-block
                onClick={onEventClick ? () => onEventClick(event) : undefined}
                draggable={
                  Boolean(onEventDragStart) && isDraggableTaskEvent(event)
                }
                onDragStart={
                  onEventDragStart && isDraggableTaskEvent(event)
                    ? (dragEvent) => {
                        dragEvent.dataTransfer.effectAllowed = "move";
                        dragEvent.dataTransfer.setData("text/plain", event.id);
                        dragEvent.dataTransfer.setDragImage(
                          createDragImage(),
                          0,
                          0,
                        );
                        const rect =
                          dragEvent.currentTarget.getBoundingClientRect();
                        onEventDragStart(event, {
                          x: dragEvent.clientX,
                          y: dragEvent.clientY,
                          offsetX: dragEvent.clientX - rect.left,
                          offsetY: dragEvent.clientY - rect.top,
                        });
                      }
                    : undefined
                }
                onDragEnd={onEventDragEnd}
              >
                <span className={calendarStyles.eventBlockTitle}>
                  {event.summary}
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
});

// ── Week column headers ──────────────────────────

function WeekHeader({
  columns,
  selectedDate,
  today,
}: {
  columns: TimeGridColumn[];
  selectedDate: Date;
  today: Date;
}) {
  const days = weekHeaderDays(selectedDate);
  const todayKey = toDateString(today);
  return (
    <div
      className="grid shrink-0"
      style={{
        gridTemplateColumns: `${GUTTER_WIDTH}px repeat(7, minmax(0, 1fr))`,
      }}
    >
      <div className={calendarStyles.columnHeader} />
      {columns.map((col, i) => {
        const day = days[i];
        return (
          <div
            key={col.key}
            className={
              day.dateKey === todayKey
                ? calendarStyles.columnHeaderToday
                : calendarStyles.columnHeader
            }
          >
            {day.weekday} {day.dayOfMonth}
          </div>
        );
      })}
    </div>
  );
}

// ── Main TimeGrid ────────────────────────────────

type TimeGridColumn = { key: string; events: CalendarEvent[] };
type DragPreview = {
  event: CalendarEvent;
  colKey: string;
  minute: number;
};
type DragGhost = {
  event: CalendarEvent;
  x: number;
  y: number;
  offsetX: number;
  offsetY: number;
};

type TimeGridProps = {
  columns: TimeGridColumn[];
  today: Date;
  selectedDate: Date;
  showHeader?: boolean;
  todayKey?: string;
  onSlotClick?: (colKey: string, minute: number) => void;
  onEventClick?: (event: CalendarEvent) => void;
  onEventMove?: (event: CalendarEvent, colKey: string, minute: number) => void;
};

export function TimeGrid({
  columns,
  today,
  selectedDate,
  showHeader,
  todayKey,
  onSlotClick,
  onEventClick,
  onEventMove,
}: TimeGridProps) {
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [dragGhost, setDragGhost] = useState<DragGhost | null>(null);
  const draggedEventRef = useRef<CalendarEvent | null>(null);
  const dragGhostRef = useRef<DragGhost | null>(null);
  draggedEventRef.current = draggedEvent;
  dragGhostRef.current = dragGhost;
  const allEvents = useMemo(
    () => columns.flatMap((col) => col.events),
    [columns],
  );
  const timedEvents = useMemo(
    () => allEvents.filter((e) => !e.allDay),
    [allEvents],
  );
  const range = useMemo(() => getVisibleRange(timedEvents), [timedEvents]);
  const from = range.fromMinute;
  const len = range.toMinute - range.fromMinute;

  const scrollContainer = useRef<HTMLDivElement>(null);

  // Scroll to sensible position on mount (parent uses key= to remount on nav)
  useMountEffect(() => {
    const node = scrollContainer.current;
    if (!node) return;
    const totalHeight = range.hours.length * PX_PER_HOUR;

    let targetMinute: number;
    if (todayKey) {
      targetMinute = Math.max(getNowMinute() - 60, from);
    } else if (timedEvents.length > 0) {
      const earliest = Math.min(...timedEvents.map((e) => e.startMinute));
      targetMinute = Math.max(earliest - 60, from);
    } else {
      targetMinute = from;
    }

    node.scrollTop = GRID_PAD_TOP + ((targetMinute - from) / len) * totalHeight;
  });

  const colCount = columns.length;
  const gridCols =
    colCount === 1
      ? `${GUTTER_WIDTH}px minmax(0, 1fr)`
      : `${GUTTER_WIDTH}px repeat(${colCount}, minmax(0, 1fr))`;

  const clearDrag = useCallback(() => {
    setDraggedEvent(null);
    setDragPreview(null);
    setDragGhost(null);
  }, []);

  const startAllDayDrag = useCallback(
    (
      event: CalendarEvent,
      dragState?: { x: number; y: number; offsetX: number; offsetY: number },
    ) => {
      setDraggedEvent(event);
      setDragPreview(null);
      setDragGhost({
        event,
        x: dragState?.x ?? 0,
        y: dragState?.y ?? 0,
        offsetX: dragState?.offsetX ?? 12,
        offsetY: dragState?.offsetY ?? 12,
      });
    },
    [],
  );

  useMountEffect(() => {
    const updateGhost = (event: DragEvent) => {
      const currentEvent = draggedEventRef.current;
      if (!currentEvent || !isDraggableTaskEvent(currentEvent)) return;
      if (!event.clientX && !event.clientY) return;
      setDragGhost({
        event: currentEvent,
        x: event.clientX,
        y: event.clientY,
        offsetX: dragGhostRef.current?.offsetX ?? 12,
        offsetY: dragGhostRef.current?.offsetY ?? 12,
      });
    };
    window.addEventListener("dragover", updateGhost);
    window.addEventListener("drag", updateGhost);
    window.addEventListener("drop", clearDrag);
    window.addEventListener("dragend", clearDrag);
    return () => {
      window.removeEventListener("dragover", updateGhost);
      window.removeEventListener("drag", updateGhost);
      window.removeEventListener("drop", clearDrag);
      window.removeEventListener("dragend", clearDrag);
    };
  });

  const createAllDayMove = useCallback(
    (colKey: string) => {
      if (!onEventMove || !draggedEvent) return undefined;
      return () => {
        onEventMove(draggedEvent, colKey, draggedEvent.startMinute);
        clearDrag();
      };
    },
    [clearDrag, draggedEvent, onEventMove],
  );

  const createColumnDragPreview = useCallback(
    (colKey: string) =>
      draggedEvent
        ? (minute: number) => {
            const previewEvent = taskDragPreviewEvent(draggedEvent);
            const nextMinute = clampStartMinute(minute, previewEvent);
            setDragPreview((current) =>
              current?.event.id === previewEvent.id &&
              current.colKey === colKey &&
              current.minute === nextMinute
                ? current
                : {
                    event: previewEvent,
                    colKey,
                    minute: nextMinute,
                  },
            );
          }
        : undefined,
    [draggedEvent],
  );

  const createColumnDragStart = useCallback(
    (colKey: string) => (event: CalendarEvent) => {
      const previewEvent = taskDragPreviewEvent(event);
      setDraggedEvent(event);
      setDragPreview({
        event: previewEvent,
        colKey,
        minute: previewEvent.startMinute,
      });
    },
    [],
  );

  const createColumnMove = useCallback(
    (colKey: string) =>
      onEventMove && draggedEvent
        ? (minute: number) => {
            const previewEvent = taskDragPreviewEvent(draggedEvent);
            onEventMove(
              draggedEvent,
              colKey,
              clampStartMinute(minute, previewEvent),
            );
            clearDrag();
          }
        : undefined,
    [clearDrag, draggedEvent, onEventMove],
  );

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <WeekHeader
          columns={columns}
          selectedDate={selectedDate}
          today={today}
        />
      )}
      <AllDayRow
        columns={columns}
        gridCols={gridCols}
        onEventClick={onEventClick}
        onEventDragStart={startAllDayDrag}
        onEventDragEnd={clearDrag}
        onEventDateMove={
          draggedEvent ? (colKey) => createAllDayMove(colKey)?.() : undefined
        }
        draggingEventId={draggedEvent?.id ?? null}
      />
      {dragGhost && !dragPreview && (dragGhost.x || dragGhost.y) && (
        <div
          className={`${calendarStyles.dragGhost} ${getTaskTone("deadline")}`}
          style={{
            transform: `translate3d(${dragGhost.x - dragGhost.offsetX}px, ${dragGhost.y - dragGhost.offsetY}px, 0)`,
          }}
        >
          <p className={calendarStyles.eventBlockTitle}>
            {dragGhost.event.summary}
          </p>
        </div>
      )}
      <div ref={scrollContainer} className={calendarStyles.scrollContainer}>
        <div style={{ height: `${GRID_PAD_TOP}px` }} />
        <div
          className="relative"
          style={{ height: `${range.hours.length * PX_PER_HOUR}px` }}
        >
          {range.hours.map((h) => (
            <div
              key={`h-${h}`}
              className={calendarStyles.hourRow}
              style={{ top: `${pct(h * 60, from, len)}%` }}
            >
              <span className={calendarStyles.hourLabel}>{formatHour(h)}</span>
            </div>
          ))}

          {range.hours.map((h) => (
            <div
              key={`hh-${h}`}
              className={calendarStyles.halfHourRow}
              style={{ top: `${pct(h * 60 + 30, from, len)}%` }}
            />
          ))}

          <div
            className={calendarStyles.gridOverlay}
            style={{ gridTemplateColumns: gridCols }}
          >
            <div className="relative h-full" />
            {columns.map((col) => (
              <DayCol
                key={col.key}
                events={col.events}
                from={from}
                len={len}
                isToday={col.key === todayKey}
                onEmptyClick={
                  onSlotClick
                    ? (minute) => onSlotClick(col.key, minute)
                    : undefined
                }
                onEventClick={onEventClick}
                onEventDragStart={createColumnDragStart(col.key)}
                onEventDragEnd={clearDrag}
                onEventDragPreview={createColumnDragPreview(col.key)}
                onEventMove={createColumnMove(col.key)}
                draggingEventId={draggedEvent?.id ?? null}
                dragPreview={
                  dragPreview?.colKey === col.key ? dragPreview : null
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
