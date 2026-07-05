import { create } from "zustand";
import type { CalendarEvent, LifePriorityTask } from "@/types/workspace";

export type CalendarMode = "day" | "week" | "month";
export type AddEventState = {
  date: Date;
  startTime: string;
  endTime: string;
};

type LifeState = {
  calendarMode: CalendarMode;
  selectedDate: Date;
  addEvent: AddEventState | null;
  detailEvent: CalendarEvent | null;
  detailTask: LifePriorityTask | null;
  isCalendarFullscreen: boolean;
  setCalendarMode: (mode: CalendarMode) => void;
  setSelectedDate: (date: Date) => void;
  setAddEvent: (state: AddEventState | null) => void;
  setDetailEvent: (event: CalendarEvent | null) => void;
  setDetailTask: (task: LifePriorityTask | null) => void;
  setCalendarFullscreen: (value: boolean) => void;
};

export const useLifeStore = create<LifeState>((set) => ({
  calendarMode: "week",
  selectedDate: new Date(0),
  addEvent: null,
  detailEvent: null,
  detailTask: null,
  isCalendarFullscreen: false,
  setCalendarMode: (calendarMode) => set({ calendarMode }),
  setSelectedDate: (selectedDate) => set({ selectedDate }),
  setAddEvent: (addEvent) => set({ addEvent }),
  setDetailEvent: (detailEvent) => set({ detailEvent }),
  setDetailTask: (detailTask) => set({ detailTask }),
  setCalendarFullscreen: (isCalendarFullscreen) =>
    set({ isCalendarFullscreen }),
}));
