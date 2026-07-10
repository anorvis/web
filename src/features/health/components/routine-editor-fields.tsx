"use client";

import { Input } from "@anorvis/ui/input";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import type {
  HevyExerciseTemplate,
  HevyRoutine,
  HevyRoutineSet,
} from "@/features/health/api/health";
import type { UnitSystem } from "@/features/health/stores/health-store";
import {
  feetToMeters,
  formatUnitValue,
  kgToLb,
  lbToKg,
  metersToFeet,
} from "@/features/health/utils/forms";

const inputClass =
  "block h-6 rounded-none px-1.5 text-[0.55rem] leading-none placeholder:text-[0.55rem] md:text-[0.55rem]";
const setTypes = ["normal", "warmup", "dropset", "failure"] as const;

type RoutineExercise = HevyRoutine["exercises"][number];
type RoutineSetPatch = Partial<HevyRoutineSet>;

export function ExerciseTemplatePicker({
  query,
  selectedTemplate,
  results,
  onQueryChange,
  onSelect,
  onAdd,
}: {
  query: string;
  selectedTemplate: HevyExerciseTemplate | null;
  results: HevyExerciseTemplate[];
  onQueryChange: (query: string) => void;
  onSelect: (template: HevyExerciseTemplate) => void;
  onAdd: () => void;
}) {
  const hasQuery = Boolean(query.trim());
  return (
    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <Input
          type="search"
          className={inputClass}
          placeholder="search Hevy exercises"
          aria-label="search Hevy exercises"
          role="combobox"
          aria-expanded={!selectedTemplate && hasQuery && results.length > 0}
          aria-controls="routine-exercise-search-results"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {selectedTemplate ? (
          <p className="mt-1 text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
            selected · {selectedTemplate.title}
          </p>
        ) : hasQuery ? (
          <div
            id="routine-exercise-search-results"
            role="listbox"
            className="mt-1 max-h-28 overflow-y-auto border border-border"
          >
            {results.length > 0 ? (
              results.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="block w-full border-b border-border px-2 py-1.5 text-left text-[0.65rem] text-foreground last:border-b-0 hover:bg-foreground/[0.04]"
                  onClick={() => onSelect(template)}
                >
                  {template.title}
                </button>
              ))
            ) : (
              <p className="px-2 py-2 text-[0.62rem] text-muted-foreground">
                no matching Hevy exercises
              </p>
            )}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={cn(workspacePageStyles.modalButton, "h-6")}
        disabled={!selectedTemplate}
        onClick={onAdd}
      >
        add selected
      </button>
    </div>
  );
}

export function ExerciseEditorHeader({
  page,
  exerciseTitle,
  previousDisabled,
  nextDisabled,
  onPrevious,
  onNext,
}: {
  page: string;
  exerciseTitle: string;
  previousDisabled: boolean;
  nextDisabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border pb-2">
      <div className="min-w-0">
        <p className={workspacePageStyles.cardLabel}>exercise {page}</p>
        <p className="truncate text-xs text-foreground">{exerciseTitle}</p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={workspacePageStyles.inlineSubmit}
          disabled={previousDisabled}
          onClick={onPrevious}
        >
          previous
        </button>
        <button
          type="button"
          className={workspacePageStyles.inlineSubmit}
          disabled={nextDisabled}
          onClick={onNext}
        >
          next
        </button>
      </div>
    </div>
  );
}

export function RoutineExerciseEditor({
  exercise,
  unitSystem,
  onExerciseChange,
  onSetChange,
  onAddSet,
  onRemoveSet,
}: {
  exercise: RoutineExercise;
  unitSystem: UnitSystem;
  onExerciseChange: (patch: Partial<RoutineExercise>) => void;
  onSetChange: (setIndex: number, patch: RoutineSetPatch) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
}) {
  return (
    <section className="py-2">
      <label className="mt-2 block">
        <span className={workspacePageStyles.metricLabel}>notes</span>
        <textarea
          className="min-h-16 w-full resize-y rounded-none border border-border bg-transparent px-2 py-1.5 text-[0.55rem] leading-relaxed text-foreground placeholder:text-[0.55rem] placeholder:text-muted-foreground/50 focus:border-foreground focus:outline-none"
          value={exercise.notes ?? ""}
          placeholder="exercise notes"
          aria-label={`${exercise.title} notes`}
          onChange={(event) =>
            onExerciseChange({ notes: event.target.value || null })
          }
        />
      </label>
      <div className="mt-2">
        {exercise.sets.map((set, setIndex) => (
          <RoutineSetEditor
            key={`${exercise.exerciseTemplateId}-${setIndex}`}
            set={set}
            setIndex={setIndex}
            unitSystem={unitSystem}
            canRemove={exercise.sets.length > 1}
            onChange={(patch) => onSetChange(setIndex, patch)}
            onRemove={() => onRemoveSet(setIndex)}
          />
        ))}
      </div>
      <div className="flex items-end justify-between gap-2">
        <button
          type="button"
          className={workspacePageStyles.modalButton}
          onClick={onAddSet}
        >
          + set
        </button>
        <div className="w-24">
          <NullableNumberInput
            label="rest sec"
            ariaLabel={`${exercise.title} rest seconds`}
            value={exercise.restSeconds}
            integer
            onChange={(restSeconds) => onExerciseChange({ restSeconds })}
          />
        </div>
      </div>
    </section>
  );
}

function RoutineSetEditor({
  set,
  setIndex,
  unitSystem,
  canRemove,
  onChange,
  onRemove,
}: {
  set: HevyRoutineSet;
  setIndex: number;
  unitSystem: UnitSystem;
  canRemove: boolean;
  onChange: (patch: RoutineSetPatch) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid items-end gap-2 border-t border-border/60 py-2 sm:grid-cols-2 lg:grid-cols-[2.5rem_5.5rem_repeat(6,minmax(3.5rem,1fr))_auto]">
      <p className="pb-1 text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
        {setIndex + 1}
      </p>
      <label>
        <span className={workspacePageStyles.metricLabel}>type</span>
        <select
          className={`w-full ${inputClass}`}
          aria-label={`set ${setIndex + 1} type`}
          value={set.type}
          onChange={(event) => onChange({ type: event.target.value })}
        >
          {setTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <NullableNumberInput
        label="reps"
        ariaLabel={`set ${setIndex + 1} exact reps`}
        value={set.reps}
        integer
        onChange={(reps) =>
          onChange({ reps, ...(reps === null ? {} : { repRange: null }) })
        }
      />
      <NullableNumberInput
        label="min reps"
        ariaLabel={`set ${setIndex + 1} minimum reps`}
        value={set.repRange?.start ?? null}
        integer
        onChange={(start) =>
          onChange({
            reps: null,
            repRange: repRange(start, set.repRange?.end ?? null),
          })
        }
      />
      <NullableNumberInput
        label="max reps"
        ariaLabel={`set ${setIndex + 1} maximum reps`}
        value={set.repRange?.end ?? null}
        integer
        onChange={(end) =>
          onChange({
            reps: null,
            repRange: repRange(set.repRange?.start ?? null, end),
          })
        }
      />
      <NullableNumberInput
        label={unitSystem === "imperial" ? "lb" : "kg"}
        value={displayUnitValue(set.weightKg, unitSystem, kgToLb)}
        onChange={(weight) =>
          onChange({
            weightKg:
              unitSystem === "imperial" && weight !== null
                ? lbToKg(weight)
                : weight,
          })
        }
        ariaLabel={`set ${setIndex + 1} weight ${unitSystem === "imperial" ? "pounds" : "kilograms"}`}
      />
      <NullableNumberInput
        label="seconds"
        value={set.durationSeconds}
        integer
        ariaLabel={`set ${setIndex + 1} duration seconds`}
        onChange={(durationSeconds) => onChange({ durationSeconds })}
      />
      <NullableNumberInput
        label={unitSystem === "imperial" ? "ft" : "m"}
        value={displayUnitValue(set.distanceMeters, unitSystem, metersToFeet)}
        ariaLabel={`set ${setIndex + 1} distance ${unitSystem === "imperial" ? "feet" : "meters"}`}
        onChange={(distance) =>
          onChange({
            distanceMeters:
              unitSystem === "imperial" && distance !== null
                ? feetToMeters(distance)
                : distance,
          })
        }
      />
      <button
        type="button"
        className={workspacePageStyles.modalDangerButton}
        disabled={!canRemove}
        onClick={onRemove}
      >
        remove
      </button>
    </div>
  );
}

function displayUnitValue(
  value: number | null,
  unitSystem: UnitSystem,
  toImperial: (value: number) => number,
) {
  if (value === null || unitSystem === "metric") return value;
  const formatted = formatUnitValue(toImperial(value));
  return formatted ? Number(formatted) : null;
}

function NullableNumberInput({
  ariaLabel,
  label,
  value,
  integer = false,
  onChange,
}: {
  ariaLabel: string;
  label: string;
  value: number | null;
  integer?: boolean;
  onChange: (value: number | null) => void;
}) {
  return (
    <div>
      <p className={workspacePageStyles.metricLabel}>{label}</p>
      <Input
        type="number"
        className={inputClass}
        min={0}
        step={integer ? 1 : 0.1}
        inputMode={integer ? "numeric" : "decimal"}
        value={value ?? ""}
        aria-label={ariaLabel}
        onChange={(event) =>
          onChange(nullableNumber(event.target.value, integer))
        }
      />
    </div>
  );
}

function nullableNumber(value: string, integer: boolean) {
  if (!value.trim()) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return integer ? Math.max(0, Math.round(parsed)) : Math.max(0, parsed);
}

function repRange(start: number | null, end: number | null) {
  return start === null && end === null ? null : { start, end };
}
