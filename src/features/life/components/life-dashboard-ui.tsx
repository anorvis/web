"use client";

import { Button } from "@anorvis/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { Maximize2, Minimize2 } from "lucide-react";
import { useState } from "react";
import {
  WorkspaceDialog,
  workspacePinnedModalFooterClass,
} from "@/components/layout/workspace-dialog";
import { EventDetailForm } from "@/features/life/components/event-detail-dialog";

export { FocusEditView, FocusStartForm } from "./life-dashboard-focus";

import { formatDateTime } from "@/lib/life-intelligence/derive";
import type {
  LifeData,
  Session,
  TimeBlock,
} from "@/lib/life-intelligence/model";
import type { CalendarEvent, LifePriorityTask } from "@/types/workspace";

const BLOCKS_PAGE_SIZE = 8;
const controlButtonClass =
  "h-8 rounded-none px-3 font-[var(--font-cossette)] text-xs hover:border-foreground hover:bg-foreground hover:text-background";
export const modalClass =
  "max-h-[84vh] w-[min(94vw,64rem)] max-w-none overflow-hidden p-0 sm:!max-w-none";
const modalBodyClass =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-y-auto px-5 pb-0";
export const modalFooterClass = workspacePinnedModalFooterClass;
export type TimerMode = "free" | "pomodoro";
export type PomodoroConfig = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
};

export const defaultPomodoroConfig: PomodoroConfig = {
  focusMinutes: 25,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  cyclesBeforeLongBreak: 4,
};

export type DetailModal = "blocks" | "todos" | "focus" | "tags" | null;
export type TodoView = "list" | "create" | { edit: LifePriorityTask };
export type FocusView = "list" | "create" | { edit: Session };

function elapsedLabel(startedAt: string | null, now: number) {
  if (!startedAt) return "00:00";
  const seconds = Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  const restSeconds = seconds % 60;
  if (hours > 0) {
    return `${hours}:${String(restMinutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
  }
  return `${String(restMinutes).padStart(2, "0")}:${String(restSeconds).padStart(2, "0")}`;
}

function pomodoroPhase(
  startedAt: string | null,
  now: number,
  config: PomodoroConfig,
) {
  if (!startedAt) {
    return {
      label: "ready",
      remainingSeconds: config.focusMinutes * 60,
    };
  }
  const focus = Math.max(1, config.focusMinutes) * 60;
  const shortBreak = Math.max(1, config.shortBreakMinutes) * 60;
  const longBreak = Math.max(1, config.longBreakMinutes) * 60;
  const cyclesBeforeLong = Math.max(1, config.cyclesBeforeLongBreak);
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now - Date.parse(startedAt)) / 1000),
  );
  const cycleSeconds = focus + shortBreak;
  const setSeconds = cycleSeconds * (cyclesBeforeLong - 1) + focus + longBreak;
  let cursor = elapsedSeconds % setSeconds;
  for (let cycle = 1; cycle <= cyclesBeforeLong; cycle += 1) {
    if (cursor < focus) {
      return {
        label: `focus ${cycle}/${cyclesBeforeLong}`,
        remainingSeconds: focus - cursor,
      };
    }
    cursor -= focus;
    const breakSeconds = cycle === cyclesBeforeLong ? longBreak : shortBreak;
    if (cursor < breakSeconds) {
      return {
        label:
          cycle === cyclesBeforeLong
            ? "long break"
            : `short break ${cycle}/${cyclesBeforeLong - 1}`,
        remainingSeconds: breakSeconds - cursor,
      };
    }
    cursor -= breakSeconds;
  }
  return { label: "focus", remainingSeconds: focus };
}

export function timerPhaseLabel(
  startedAt: string | null,
  now: number,
  mode: TimerMode,
  config: PomodoroConfig = defaultPomodoroConfig,
) {
  if (mode === "free") return startedAt ? "focus" : "ready";
  return pomodoroPhase(startedAt, now, config).label;
}

export function timerLabel(
  startedAt: string | null,
  now: number,
  mode: TimerMode,
  config: PomodoroConfig = defaultPomodoroConfig,
) {
  if (!startedAt || mode === "free") return elapsedLabel(startedAt, now);
  const remaining = Math.max(
    0,
    Math.floor(pomodoroPhase(startedAt, now, config).remainingSeconds),
  );
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function blockStatus(block: TimeBlock, now: number) {
  if (block.type === "todo" && "completedAt" in block && block.completedAt) {
    return "completed";
  }
  const end = block.endAt ? Date.parse(block.endAt) : null;
  if (end && end < now) return "completed";
  const start = block.startAt ?? block.dueAt;
  if (start && Date.parse(start) < now) return "current";
  return "next";
}

export function blockMeta(block: TimeBlock, tagNames: Map<string, string>) {
  const tags = block.tagIds.map((id) => tagNames.get(id)).filter(Boolean);
  const time = block.startAt ?? block.dueAt ?? block.endAt;
  return [
    block.type,
    time ? formatDateTime(time) : "unscheduled",
    ...tags,
  ].join(" · ");
}

export function MetricButton({
  label,
  value,
  note,
  onClick,
  action,
}: {
  label: string;
  value: string;
  note?: string;
  onClick: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-28 border border-border transition hover:border-foreground hover:bg-foreground/[0.03]">
      <button
        type="button"
        onClick={onClick}
        className="h-full min-h-28 w-full p-3 text-left"
      >
        <p className="pr-10 text-[0.6rem] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-1 text-lg leading-none tracking-[0.04em] text-foreground">
          {value}
        </p>
        {note && <p className="mt-2 text-xs text-muted-foreground">{note}</p>}
      </button>
      {action && <div className="absolute right-3 top-3">{action}</div>}
    </div>
  );
}

type DetailBlock = LifeData["timeBlocks"][number];

export function BlocksDialog({
  open,
  onOpenChange,
  calendarMode,
  periodBlocks,
  clockNow,
  tagNames,
  calendarEvents,
  tagOptions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarMode: "day" | "week" | "month";
  periodBlocks: DetailBlock[];
  clockNow: number;
  tagNames: Map<string, string>;
  calendarEvents: CalendarEvent[];
  tagOptions: string[];
}) {
  const [page, setPage] = useState(0);
  const [selectedBlock, setSelectedBlock] = useState<DetailBlock | null>(null);
  const pageCount = Math.max(
    1,
    Math.ceil(periodBlocks.length / BLOCKS_PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount - 1);
  const visibleBlocks = periodBlocks.slice(
    safePage * BLOCKS_PAGE_SIZE,
    safePage * BLOCKS_PAGE_SIZE + BLOCKS_PAGE_SIZE,
  );
  const selectedTags = selectedBlock?.tagIds
    .map((id) => tagNames.get(id))
    .filter(Boolean)
    .join(", ");
  const selectedEvent =
    selectedBlock?.type === "event"
      ? calendarEvents.find((event) => event.id === selectedBlock.id)
      : null;

  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setSelectedBlock(null);
        onOpenChange(nextOpen);
      }}
      className={modalClass}
    >
      <ModalFrame
        title="blocks"
        description={`Aggregated events, due todos, and focus sessions for the selected ${calendarMode}. Completed items are crossed out and dimmed above the next item.`}
      >
        <div className="flex min-h-0 flex-1 flex-col space-y-2 pt-4 pb-0">
          {selectedBlock ? (
            selectedEvent ? (
              <EventDetailForm
                event={selectedEvent}
                tagOptions={tagOptions}
                onClose={() => setSelectedBlock(null)}
              />
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-4">
                  <p className={workspacePageStyles.cardTitle}>
                    {selectedBlock.title}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="border border-border p-3">
                      <p className={workspacePageStyles.metricLabel}>type</p>
                      <p className="mt-1 text-xs text-foreground">
                        {selectedBlock.type}
                      </p>
                    </div>
                    <div className="border border-border p-3">
                      <p className={workspacePageStyles.metricLabel}>source</p>
                      <p className="mt-1 text-xs text-foreground">time-block</p>
                    </div>
                    <div className="border border-border p-3">
                      <p className={workspacePageStyles.metricLabel}>date</p>
                      <p className="mt-1 text-xs text-foreground">
                        {selectedBlock.startAt
                          ? formatDateTime(selectedBlock.startAt)
                          : selectedBlock.dueAt
                            ? formatDateTime(selectedBlock.dueAt)
                            : "unscheduled"}
                      </p>
                    </div>
                    {"endAt" in selectedBlock && selectedBlock.endAt && (
                      <div className="border border-border p-3">
                        <p className={workspacePageStyles.metricLabel}>end</p>
                        <p className="mt-1 text-xs text-foreground">
                          {formatDateTime(selectedBlock.endAt)}
                        </p>
                      </div>
                    )}
                    {selectedTags && (
                      <div className="border border-border p-3">
                        <p className={workspacePageStyles.metricLabel}>tag</p>
                        <p className="mt-1 text-xs text-foreground">
                          {selectedTags}
                        </p>
                      </div>
                    )}
                  </div>
                  {selectedBlock.notes && (
                    <div className="border border-border p-3">
                      <p className={workspacePageStyles.metricLabel}>
                        description
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                        {selectedBlock.notes}
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter className={modalFooterClass}>
                  <button
                    type="button"
                    className={workspacePageStyles.modalButton}
                    onClick={() => setSelectedBlock(null)}
                  >
                    back to blocks
                  </button>
                </DialogFooter>
              </div>
            )
          ) : periodBlocks.length === 0 ? (
            <p className={workspacePageStyles.cardBodyText}>
              no dated blocks in this time frame
            </p>
          ) : (
            visibleBlocks.map((block) => {
              const status = blockStatus(block, clockNow);
              const completed = status === "completed";
              const rowClass = cn(
                "w-full border border-border px-2.5 py-2 text-left",
                "hover:border-foreground",
                completed && "opacity-55",
                status === "next" &&
                  "border-foreground/60 bg-foreground/[0.03]",
              );
              const content = (
                <>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        "truncate text-[0.72rem] leading-tight text-foreground",
                        completed && "line-through",
                      )}
                    >
                      {block.title}
                    </p>
                    <p className="mt-0.5 text-[0.54rem] uppercase tracking-[0.14em] text-muted-foreground">
                      {blockMeta(block, tagNames)}
                    </p>
                  </div>
                  {block.notes && (
                    <p className="mt-1 text-[0.62rem] leading-snug text-muted-foreground">
                      {block.notes}
                    </p>
                  )}
                </>
              );
              return (
                <button
                  key={block.id}
                  type="button"
                  className={rowClass}
                  onClick={() => setSelectedBlock(block)}
                >
                  {content}
                </button>
              );
            })
          )}
          {!selectedBlock && periodBlocks.length > BLOCKS_PAGE_SIZE && (
            <DialogFooter
              className={`items-center justify-between sm:justify-between ${modalFooterClass}`}
            >
              <p className={workspacePageStyles.metricLabel}>
                {safePage + 1} / {pageCount}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={workspacePageStyles.modalButton}
                  disabled={safePage === 0}
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                >
                  prev
                </button>
                <button
                  type="button"
                  className={workspacePageStyles.modalButton}
                  disabled={safePage >= pageCount - 1}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                >
                  next
                </button>
              </div>
            </DialogFooter>
          )}
        </div>
      </ModalFrame>
    </WorkspaceDialog>
  );
}

export function ModalFrame({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex max-h-[84vh] min-h-[38rem] w-full min-w-0 flex-col overflow-hidden">
      <DialogHeader className="border-b border-border px-5 py-4">
        <DialogTitle className={workspacePageStyles.cardTitle}>
          {title}
        </DialogTitle>
        <DialogDescription className={workspacePageStyles.cardBodyText}>
          {description}
        </DialogDescription>
      </DialogHeader>
      <div className={modalBodyClass}>{children}</div>
    </div>
  );
}

export function TimerPanel({
  startedAt,
  now,
  mode,
  fullscreen,
  pomodoro,
  onModeChange,
  onStart,
  onStop,
  onFullscreenChange,
}: {
  startedAt: string | null;
  now: number;
  mode: TimerMode;
  fullscreen: boolean;
  pomodoro: PomodoroConfig;
  onModeChange: (mode: TimerMode) => void;
  onStart: () => void;
  onStop: () => void;
  onFullscreenChange: (fullscreen: boolean) => void;
}) {
  const renderTimer = (isFullscreen = false) => (
    <div
      className={`flex flex-col items-center justify-center border border-border bg-background p-6 text-center font-[var(--font-cossette)] ${isFullscreen ? "h-full w-full" : "sr-only"}`}
    >
      <p className="text-[0.65rem] uppercase tracking-[0.22em] text-muted-foreground">
        {timerPhaseLabel(startedAt, now, mode, pomodoro)}
      </p>
      <p className="mt-5 font-mono text-6xl tracking-[-0.05em] text-foreground md:text-7xl">
        {timerLabel(startedAt, now, mode, pomodoro)}
      </p>
      <p className="mt-4 font-[var(--font-cossette)] text-xs text-muted-foreground">
        {startedAt ? `started ${formatDateTime(startedAt)}` : "ready"}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className={controlButtonClass}
          onClick={startedAt ? onStop : onStart}
        >
          {startedAt ? "stop" : "start"}
        </Button>
        {!startedAt && (
          <Button
            size="sm"
            variant="outline"
            className={controlButtonClass}
            onClick={() => onModeChange(mode === "free" ? "pomodoro" : "free")}
          >
            {mode === "free" ? "pomodoro" : "free form"}
          </Button>
        )}
        {!isFullscreen && startedAt && (
          <Button
            size="sm"
            variant="outline"
            className={controlButtonClass}
            onClick={() => onFullscreenChange(true)}
            aria-label="fullscreen timer"
          >
            <Maximize2 className="size-3" />
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {renderTimer()}
      <WorkspaceDialog
        open={fullscreen}
        onOpenChange={onFullscreenChange}
        showCloseButton={false}
        className="!fixed !inset-0 !left-0 !top-0 !h-dvh !w-dvw !max-w-none !translate-x-0 !translate-y-0 rounded-none border-0 bg-background p-0 shadow-none duration-0 sm:!max-w-none data-[state=open]:zoom-in-100"
      >
        <DialogTitle className="sr-only">focus timer</DialogTitle>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="fixed right-4 top-4 z-[80] h-8 rounded-none px-2 text-xs hover:border-foreground hover:bg-foreground hover:text-background"
          onClick={() => onFullscreenChange(false)}
          aria-label="close fullscreen timer"
        >
          <Minimize2 className="size-3" />
        </Button>
        {renderTimer(true)}
      </WorkspaceDialog>
    </>
  );
}
