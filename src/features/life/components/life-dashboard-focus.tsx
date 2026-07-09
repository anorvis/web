"use client";

import { DialogFooter } from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useState } from "react";
import { workspaceModalFooterClass } from "@/components/layout/workspace-dialog";
import { TagSelect } from "@/features/life/components/tag-select";
import { formatDateTime } from "@/lib/life-intelligence/derive";
import type { Session } from "@/lib/life-intelligence/model";

const modalFooterClass = `${workspaceModalFooterClass} flex-row items-center`;

type TimerMode = "free" | "pomodoro";

type PomodoroConfig = {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  cyclesBeforeLongBreak: number;
};

export function FocusStartForm({
  onCancel,
  onStart,
  defaultMode,
  defaultPomodoro,
  tagOptions,
}: {
  onCancel: () => void;
  onStart: (input: {
    title: string;
    notes: string;
    tag: string;
    mode: TimerMode;
    pomodoro: PomodoroConfig;
  }) => void;
  defaultMode: TimerMode;
  defaultPomodoro: PomodoroConfig;
  tagOptions: string[];
}) {
  const [title, setTitle] = useState("focus session");
  const [notes, setNotes] = useState("");
  const [tag, setTag] = useState("");
  const [mode, setMode] = useState<TimerMode>(defaultMode);
  const [pomodoro, setPomodoro] = useState<PomodoroConfig>(defaultPomodoro);
  const updatePomodoro = (field: keyof PomodoroConfig, value: number) => {
    setPomodoro((current) => ({
      ...current,
      [field]: Math.max(1, Number.isFinite(value) ? value : current[field]),
    }));
  };
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        onStart({ title, notes, tag, mode, pomodoro });
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        <label className="block space-y-1">
          <span className={workspacePageStyles.metricLabel}>title</span>
          <input
            className={`w-full ${workspacePageStyles.inlineInput}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className={workspacePageStyles.metricLabel}>description</span>
          <textarea
            className={`min-h-24 w-full resize-none ${workspacePageStyles.inlineInput}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <TagSelect value={tag} onChange={setTag} options={tagOptions} />
        <div className="grid grid-cols-2 border border-border">
          {(["free", "pomodoro"] as const).map((option) => (
            <button
              key={option}
              type="button"
              className={cn(
                "h-9 border-border text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground",
                option === "pomodoro" && "border-l",
                mode === option && "bg-foreground text-background",
              )}
              onClick={() => setMode(option)}
            >
              {option === "free" ? "default" : "pomodoro"}
            </button>
          ))}
        </div>
        {mode === "pomodoro" && (
          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ["focusMinutes", "focus min"],
                ["shortBreakMinutes", "short break"],
                ["longBreakMinutes", "long break"],
                ["cyclesBeforeLongBreak", "cycles before long"],
              ] as const
            ).map(([field, label]) => (
              <label key={field} className="block space-y-1">
                <span className={workspacePageStyles.metricLabel}>{label}</span>
                <input
                  type="number"
                  min={1}
                  className={`w-full ${workspacePageStyles.inlineInput}`}
                  value={pomodoro[field]}
                  onChange={(event) =>
                    updatePomodoro(field, event.target.valueAsNumber)
                  }
                />
              </label>
            ))}
          </div>
        )}
      </div>
      <DialogFooter className={modalFooterClass}>
        <button
          className={workspacePageStyles.modalButton}
          type="button"
          onClick={onCancel}
        >
          cancel
        </button>
        <button className={workspacePageStyles.modalButton} type="submit">
          start
        </button>
      </DialogFooter>
    </form>
  );
}

export function FocusEditView({
  session,
  tagName,
  tagOptions,
  onBack,
  onDelete,
  onSave,
}: {
  session: Session;
  tagName: string;
  tagOptions: string[];
  onBack: () => void;
  onDelete: (sessionId: string) => void;
  onSave: (session: Session, tagName: string) => void;
}) {
  const [title, setTitle] = useState(session.title);
  const [notes, setNotes] = useState(session.notes ?? "");
  const [tag, setTag] = useState(tagName);
  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(
          {
            ...session,
            title: title.trim() || session.title,
            notes: notes.trim() || undefined,
            updatedAt: new Date().toISOString(),
          },
          tag,
        );
      }}
    >
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-4">
        <p className={workspacePageStyles.cardBodyText}>
          {session.startAt ? formatDateTime(session.startAt) : "unscheduled"}
        </p>
        <label className="block space-y-1">
          <span className={workspacePageStyles.metricLabel}>title</span>
          <input
            className={`w-full ${workspacePageStyles.inlineInput}`}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="block space-y-1">
          <span className={workspacePageStyles.metricLabel}>description</span>
          <textarea
            className={`min-h-24 w-full resize-none ${workspacePageStyles.inlineInput}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <TagSelect value={tag} onChange={setTag} options={tagOptions} />
      </div>
      <DialogFooter className={modalFooterClass}>
        <button
          className={workspacePageStyles.modalButton}
          type="button"
          onClick={() => onDelete(session.id)}
        >
          delete
        </button>
        <button
          className={workspacePageStyles.modalButton}
          type="button"
          onClick={onBack}
        >
          cancel
        </button>
        <button className={workspacePageStyles.modalButton} type="submit">
          save
        </button>
      </DialogFooter>
    </form>
  );
}
