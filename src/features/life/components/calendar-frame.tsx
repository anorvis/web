"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@anorvis/ui/dropdown-menu";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from "lucide-react";
import type { CalendarMode } from "@/features/life/components/calendar-view";
import type { CalendarEvent, LifePriorityTask } from "@/types/workspace";
import { AddEventDialog } from "./add-event-dialog";
import { MonthGrid } from "./calendar-month-grid";
import { TimeGrid } from "./calendar-time-grid";
import { EventDetailDialog } from "./event-detail-dialog";
import { TaskEditDialog } from "./task-edit-dialog";

export function CalendarFrame(props: {
  mode: CalendarMode;
  selectedDate: Date;
  today: Date;
  isToday: boolean;
  isFullscreen: boolean;
  navLabel: string;
  fetchError: string | null;
  scrollKey: string;
  dayColumns: { key: string; events: CalendarEvent[] }[];
  weekColumns: { key: string; events: CalendarEvent[] }[];
  todayKey?: string;
  events: CalendarEvent[];
  detailTask: LifePriorityTask | null;
  tagOptions: string[];
  onGoToday: () => void;
  onNavigate: (delta: number) => void;
  onModeChange: (mode: CalendarMode) => void;
  onToggleFullscreen: () => void;
  onSlotClick: (colKey: string, minute: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventMove: (event: CalendarEvent, colKey: string, minute: number) => void;
  onDayClick: (date: Date) => void;
  onTaskDialogOpenChange: (open: boolean) => void;
}) {
  return (
    <div
      className={`flex flex-col h-[640px] ${
        props.isFullscreen
          ? "fixed inset-0 z-50 box-border h-dvh max-h-dvh overflow-hidden bg-background p-4 font-mono"
          : ""
      }`}
    >
      <CalendarToolbar
        mode={props.mode}
        isToday={props.isToday}
        isFullscreen={props.isFullscreen}
        onGoToday={props.onGoToday}
        onNavigate={props.onNavigate}
        onModeChange={props.onModeChange}
        onToggleFullscreen={props.onToggleFullscreen}
      />
      <div className="flex items-center justify-between shrink-0 mt-2">
        <span className={workspacePageStyles.cardBodyText}>
          {props.navLabel}
        </span>
      </div>
      {props.fetchError && (
        <p className={workspacePageStyles.errorText}>{props.fetchError}</p>
      )}
      <CalendarGrid {...props} />
      <AddEventDialog tagOptions={props.tagOptions} />
      <EventDetailDialog tagOptions={props.tagOptions} />
      <TaskEditDialog
        task={props.detailTask}
        onOpenChange={props.onTaskDialogOpenChange}
      />
    </div>
  );
}

function CalendarToolbar({
  mode,
  isToday,
  isFullscreen,
  onGoToday,
  onNavigate,
  onModeChange,
  onToggleFullscreen,
}: {
  mode: CalendarMode;
  isToday: boolean;
  isFullscreen: boolean;
  onGoToday: () => void;
  onNavigate: (delta: number) => void;
  onModeChange: (mode: CalendarMode) => void;
  onToggleFullscreen: () => void;
}) {
  return (
    <div className="flex items-center justify-between shrink-0">
      <p className={workspacePageStyles.cardLabel}>{"// calendar"}</p>
      <div className="flex items-center gap-2">
        {!isToday && (
          <button
            type="button"
            onClick={onGoToday}
            className={`${workspacePageStyles.toggleButton} h-8 px-3`}
          >
            today
          </button>
        )}
        <div className="flex items-center gap-1">
          <NavButton label={`Previous ${mode}`} onClick={() => onNavigate(-1)}>
            <ChevronLeft className="size-4" />
          </NavButton>
          <NavButton label={`Next ${mode}`} onClick={() => onNavigate(1)}>
            <ChevronRight className="size-4" />
          </NavButton>
        </div>
        <ModeMenu mode={mode} onModeChange={onModeChange} />
        <NavButton
          label={isFullscreen ? "Exit fullscreen" : "Open fullscreen"}
          onClick={onToggleFullscreen}
        >
          {isFullscreen ? (
            <Minimize2 className="size-3" />
          ) : (
            <Maximize2 className="size-3" />
          )}
        </NavButton>
      </div>
    </div>
  );
}

function NavButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${workspacePageStyles.toggleButton} flex h-8 w-8 items-center justify-center p-0`}
      aria-label={label}
    >
      {children}
    </button>
  );
}

function ModeMenu({
  mode,
  onModeChange,
}: {
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
}) {
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`${workspacePageStyles.toggleButton} h-8 min-w-24 px-3`}
        >
          {mode} ▾
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className={workspacePageStyles.dropdownContent}
      >
        {(["day", "week", "month"] as const).map((value) => (
          <DropdownMenuItem
            key={value}
            className={workspacePageStyles.dropdownItem}
            onSelect={() => onModeChange(value)}
          >
            {value}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CalendarGrid({
  mode,
  selectedDate,
  today,
  scrollKey,
  dayColumns,
  weekColumns,
  todayKey,
  events,
  onSlotClick,
  onEventClick,
  onEventMove,
  onDayClick,
}: {
  mode: CalendarMode;
  selectedDate: Date;
  today: Date;
  scrollKey: string;
  dayColumns: { key: string; events: CalendarEvent[] }[];
  weekColumns: { key: string; events: CalendarEvent[] }[];
  todayKey?: string;
  events: CalendarEvent[];
  onSlotClick: (colKey: string, minute: number) => void;
  onEventClick: (event: CalendarEvent) => void;
  onEventMove: (event: CalendarEvent, colKey: string, minute: number) => void;
  onDayClick: (date: Date) => void;
}) {
  return (
    <div className="flex-1 min-h-0 mt-2">
      {mode === "day" && (
        <TimeGrid
          key={scrollKey}
          columns={dayColumns}
          today={today}
          selectedDate={selectedDate}
          todayKey={todayKey}
          onSlotClick={onSlotClick}
          onEventClick={onEventClick}
          onEventMove={onEventMove}
        />
      )}
      {mode === "week" && (
        <TimeGrid
          key={scrollKey}
          columns={weekColumns}
          today={today}
          selectedDate={selectedDate}
          showHeader
          todayKey={todayKey}
          onSlotClick={onSlotClick}
          onEventClick={onEventClick}
          onEventMove={onEventMove}
        />
      )}
      {mode === "month" && (
        <MonthGrid
          date={selectedDate}
          today={today}
          events={events}
          onDayClick={onDayClick}
        />
      )}
    </div>
  );
}
