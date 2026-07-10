"use client";

import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { Input } from "@anorvis/ui/input";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { type CSSProperties, type ReactNode, useRef } from "react";
import { WorkspaceDialog } from "@/components/layout/workspace-dialog";
import {
  EXERCISE_HISTORY_PAGE_SIZE,
  type ExerciseHistoryRow,
} from "@/features/health/lib/exercise-history";
import {
  durationSecondsLabel,
  roundOne,
  setLine,
} from "@/features/health/lib/summaries";
import type { NativeMacroProfile } from "@/features/health/types/native-health";
import { formatDateTime } from "@/lib/life-intelligence/derive";
import type { Meal, Workout } from "@/lib/life-intelligence/model";

const inputClass =
  "h-7 rounded-none px-2 text-[0.6rem] placeholder:text-[0.6rem]";
const buttonClass =
  "h-7 rounded-none px-2 text-[0.6rem] hover:border-foreground hover:bg-foreground hover:text-background";
const fileInputId = "meal-photo-input";
const stableScrollClass = "min-h-0 flex-1 overflow-y-auto";
const healthModalClass =
  "h-[min(84vh,48rem)] w-[min(94vw,64rem)] max-w-none overflow-hidden p-0 sm:!max-w-none";

export function WorkoutFlipbook({
  workout,
  index,
  total,
  onPrevious,
  onNext,
  onSelectExercise,
}: {
  workout: Workout;
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onSelectExercise: (exercise: string) => void;
}) {
  const setCount = workout.exercises.reduce(
    (sum, exercise) => sum + exercise.sets.length,
    0,
  );
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-3">
      <FlipbookHeader
        label="workout log"
        page={`${index + 1}/${total}`}
        onPrevious={onPrevious}
        onNext={onNext}
        disabled={total <= 1}
      />
      <div>
        <p className="text-sm text-foreground">{workout.title}</p>
        <p className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
          {formatDateTime(workout.startAt)} · {durationLabel(workout)} ·{" "}
          {workout.exercises.length} exercises · {setCount} sets
        </p>
      </div>
      <div className={`${stableScrollClass} space-y-2 pr-1`}>
        {workout.exercises.map((exercise) => (
          <button
            key={exercise.title}
            type="button"
            className="grid w-full flex-none items-center gap-x-4 gap-y-2 border border-border/70 px-3 py-2 text-left hover:border-foreground hover:bg-foreground/[0.03] md:grid-cols-[minmax(10rem,0.7fr)_minmax(0,1.8fr)]"
            onClick={() => onSelectExercise(exercise.title)}
          >
            <div className="min-w-0">
              <p className="truncate text-[0.72rem] text-foreground">
                {exercise.title}
              </p>
              <p className="mt-1 text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
                {exercise.sets.length} sets
              </p>
            </div>
            <div className="grid min-w-0 gap-x-3 gap-y-1 sm:grid-cols-2 lg:grid-cols-4">
              {exercise.sets.map((set, setIndex) => (
                <p
                  key={`${exercise.title}-${setIndex}`}
                  className="truncate text-[0.6rem] text-muted-foreground"
                >
                  {setIndex + 1}. {setLine(set)}
                </p>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function WorkoutExerciseHistory({
  rows,
  index,
  total,
  onPrevious,
  onNext,
  onBack,
}: {
  rows: ExerciseHistoryRow[];
  index: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const start = index * EXERCISE_HISTORY_PAGE_SIZE;
  const visibleRows = rows.slice(start, start + EXERCISE_HISTORY_PAGE_SIZE);
  const end = start + visibleRows.length;
  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className={workspacePageStyles.cardBodyText}>
          {rows.length} logged set rows · {EXERCISE_HISTORY_PAGE_SIZE} per page
        </p>
        <button
          type="button"
          className={workspacePageStyles.modalButton}
          onClick={onBack}
        >
          back
        </button>
      </div>
      {visibleRows.length > 0 ? (
        <div className="flex min-h-0 flex-1 flex-col space-y-3">
          <FlipbookHeader
            label="exercise history"
            page={`${index + 1}/${total} · ${start + 1}–${end} of ${rows.length} rows`}
            onPrevious={onPrevious}
            onNext={onNext}
            disabled={total <= 1}
          />
          <div className="min-h-0 flex-1 overflow-y-auto border-y border-border">
            {visibleRows.map((row) => (
              <div
                key={row.key}
                className="grid gap-x-3 gap-y-1 border-b border-border/60 py-2 last:border-b-0 sm:grid-cols-[minmax(9rem,0.8fr)_3.5rem_minmax(0,1fr)]"
              >
                <div className="min-w-0">
                  <p className="truncate text-[0.65rem] text-foreground">
                    {row.workoutTitle}
                  </p>
                  <p className="text-[0.56rem] uppercase tracking-[0.14em] text-muted-foreground">
                    {formatDateTime(row.startedAt)}
                  </p>
                </div>
                <p className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
                  set {row.setNumber}
                </p>
                <p className="text-[0.65rem] text-muted-foreground">
                  {setLine(row.set)}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No exercise history."
          body="This exercise has no saved sets in the currently loaded workout log."
        />
      )}
    </div>
  );
}

export function MealForm({
  photoName,
  mealStatus,
  isSaving,
  onPhotoName,
  onSubmit,
  defaultValues,
}: {
  photoName: string | null;
  mealStatus: string | null;
  isSaving: boolean;
  onPhotoName: (name: string | null) => void;
  onSubmit: (formData: FormData) => void;
  defaultValues?: {
    name: string;
    calories: string;
    proteinGrams: string;
    carbsGrams: string;
    fatGrams: string;
    notes: string;
  };
}) {
  return (
    <form
      className="space-y-3 border border-border p-3"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(new FormData(event.currentTarget));
      }}
    >
      <Input
        name="name"
        placeholder="meal name"
        defaultValue={defaultValues?.name}
        required
        className={inputClass}
      />
      <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr]">
        <label
          htmlFor={fileInputId}
          className={`${buttonClass} inline-flex cursor-pointer items-center justify-center border border-border`}
        >
          browse
        </label>
        <p className="truncate text-[0.6rem] text-muted-foreground">
          {photoName ?? "no photo selected"}
        </p>
        <input
          id={fileInputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(event) =>
            onPhotoName(event.currentTarget.files?.[0]?.name ?? null)
          }
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Input
          name="calories"
          defaultValue={defaultValues?.calories}
          placeholder="kcal"
          inputMode="numeric"
          className={inputClass}
        />
        <Input
          name="proteinGrams"
          defaultValue={defaultValues?.proteinGrams}
          placeholder="protein"
          inputMode="numeric"
          className={inputClass}
        />
        <Input
          name="carbsGrams"
          defaultValue={defaultValues?.carbsGrams}
          placeholder="carbs"
          inputMode="numeric"
          className={inputClass}
        />
        <Input
          name="fatGrams"
          defaultValue={defaultValues?.fatGrams}
          placeholder="fat"
          inputMode="numeric"
          className={inputClass}
        />
      </div>
      <input type="hidden" name="mealType" value="meal" />
      <input type="hidden" name="loggedAt" value={new Date().toISOString()} />
      <Input
        name="notes"
        defaultValue={defaultValues?.notes}
        placeholder={photoName ? `photo selected: ${photoName}` : "notes"}
        className={inputClass}
      />
      <button
        type="submit"
        className={workspacePageStyles.modalButton}
        disabled={isSaving}
      >
        {isSaving ? "saving" : "save meal"}
      </button>
      {mealStatus && (
        <p className="text-xs text-muted-foreground">{mealStatus}</p>
      )}
    </form>
  );
}

function FlipbookHeader({
  label,
  page,
  disabled,
  onPrevious,
  onNext,
}: {
  label: string;
  page: string;
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className={workspacePageStyles.cardLabel}>{label}</p>
        <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
          {page}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={workspacePageStyles.inlineSubmit}
          onClick={onPrevious}
          disabled={disabled}
        >
          previous
        </button>
        <button
          type="button"
          className={workspacePageStyles.inlineSubmit}
          onClick={onNext}
          disabled={disabled}
        >
          next
        </button>
      </div>
    </div>
  );
}

function healthTabId(label: string, id: string): string {
  return `health-tab-${label}-${id}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
}

export function healthTabPanelProps(label: string, id: string) {
  return {
    role: "tabpanel" as const,
    id: `${healthTabId(label, id)}-panel`,
    "aria-labelledby": healthTabId(label, id),
  };
}

export function HealthTabs({
  label,
  tabs,
  active,
  onSelect,
}: {
  label: string;
  tabs: readonly { id: string; label: string }[];
  active: string;
  onSelect: (id: string) => void;
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);
  return (
    <div
      role="tablist"
      aria-label={label}
      className="flex flex-wrap items-center gap-2"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          ref={(element) => {
            refs.current[index] = element;
          }}
          type="button"
          role="tab"
          id={healthTabId(label, tab.id)}
          aria-selected={active === tab.id}
          aria-controls={`${healthTabId(label, tab.id)}-panel`}
          tabIndex={active === tab.id ? 0 : -1}
          className={cn(
            workspacePageStyles.toggleButton,
            active === tab.id && "border-foreground text-foreground",
          )}
          onClick={() => onSelect(tab.id)}
          onKeyDown={(event) => {
            let nextIndex: number | null = null;
            if (event.key === "ArrowRight")
              nextIndex = (index + 1) % tabs.length;
            if (event.key === "ArrowLeft")
              nextIndex = (index - 1 + tabs.length) % tabs.length;
            if (event.key === "Home") nextIndex = 0;
            if (event.key === "End") nextIndex = tabs.length - 1;
            if (nextIndex === null) return;
            event.preventDefault();
            const next = tabs[nextIndex];
            if (!next) return;
            onSelect(next.id);
            refs.current[nextIndex]?.focus();
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function HealthDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <WorkspaceDialog
      open={open}
      onOpenChange={onOpenChange}
      className={healthModalClass}
    >
      <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className={workspacePageStyles.cardTitle}>
            {title}
          </DialogTitle>
          <DialogDescription className={workspacePageStyles.cardBodyText}>
            {description}
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 flex-col space-y-3 overflow-y-auto px-5 py-4">
          {children}
        </div>
      </div>
    </WorkspaceDialog>
  );
}

export function MacroCell({
  label,
  value,
  valueStyle,
}: {
  label: string;
  value: string;
  valueStyle?: CSSProperties;
}) {
  return (
    <div className={workspacePageStyles.metricCell}>
      <p className={workspacePageStyles.metricLabel}>{label}</p>
      <p className={workspacePageStyles.metricValue} style={valueStyle}>
        {value}
      </p>
    </div>
  );
}

function durationLabel(workout: Workout) {
  if (!workout.endAt) return "duration unknown";
  const seconds = Math.max(
    0,
    Math.round(
      (Date.parse(workout.endAt) - Date.parse(workout.startAt)) / 1000,
    ),
  );
  return durationSecondsLabel(seconds);
}

export function mealMacroLine(meal: Meal) {
  return `${meal.macro?.calories ?? 0} kcal · ${meal.macro?.protein ?? 0}g protein`;
}

export function measurementLine(profile: NativeMacroProfile | null) {
  if (!profile) return "measurements ---";
  return `${roundOne(profile.weightKg)}kg · ${roundOne(profile.heightCm)}cm`;
}

export function weightLabel(profile: NativeMacroProfile | null) {
  return profile ? `${roundOne(profile.weightKg)}kg` : "---";
}

export function heightLabel(profile: NativeMacroProfile | null) {
  return profile ? `${roundOne(profile.heightCm)}cm` : "---";
}

export function bodyFatLabel(profile: NativeMacroProfile | null) {
  return profile?.bodyFatPercent
    ? `${roundOne(profile.bodyFatPercent)}%`
    : "---";
}

export function selectPagedItem<T>(items: T[], index: number) {
  if (items.length === 0) return null;
  return items[safePageIndex(index, items.length)] ?? null;
}

export function safePageIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}

export function previousPageIndex(index: number, total: number) {
  if (total <= 1) return index;
  return safePageIndex(index - 1, total);
}

export function nextPageIndex(index: number, total: number) {
  if (total <= 1) return index;
  return safePageIndex(index + 1, total);
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="border border-dashed border-border p-4">
      <p className="text-xs text-foreground">{title}</p>
      <p className={workspacePageStyles.cardBodyText}>{body}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
