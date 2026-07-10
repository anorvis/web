"use client";

import { Input } from "@anorvis/ui/input";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { cn } from "@anorvis/ui/utils";
import { useMemo, useState } from "react";
import {
  WorkspaceDialog,
  WorkspaceModalFrame,
  workspacePinnedModalFooterClass,
} from "@/components/layout/workspace-dialog";
import type {
  HevyExerciseTemplate,
  HevyRoutine,
  HevyRoutineSet,
} from "@/features/health/api/health";
import {
  ExerciseEditorHeader,
  ExerciseTemplatePicker,
  RoutineExerciseEditor,
} from "@/features/health/components/routine-editor-fields";
import {
  emptyHevyRoutineSet,
  hevyRoutineSetLine,
  type RoutineSummary,
  routineExerciseFromTemplate,
} from "@/features/health/lib/summaries";
import {
  type UnitSystem,
  useHealthStore,
} from "@/features/health/stores/health-store";
import { formatDateTime } from "@/lib/life-intelligence/derive";

const inputClass =
  "block h-6 rounded-none px-1.5 text-[0.55rem] leading-none placeholder:text-[0.55rem] md:text-[0.55rem]";
const routineEditorModalClass =
  "h-[min(84vh,48rem)] w-[min(94vw,64rem)] max-w-none overflow-hidden p-0 sm:!max-w-none";

type RoutineExercise = HevyRoutine["exercises"][number];
type RoutineSetPatch = Partial<HevyRoutineSet>;

export function RoutineFlipbook({
  routine,
  editableRoutine,
  templates,
  saving,
  saveError,
  index,
  total,
  onSave,
  onPrevious,
  onNext,
  onSelectExercise,
}: {
  routine: RoutineSummary;
  editableRoutine: HevyRoutine | null;
  templates: HevyExerciseTemplate[];
  saving: boolean;
  saveError: string | null;
  index: number;
  total: number;
  onSave: (routine: HevyRoutine, onSaved: () => void) => void;
  onPrevious: () => void;
  onNext: () => void;
  onSelectExercise: (exercise: string) => void;
}) {
  const unitSystem = useHealthStore((state) => state.unitSystem);
  const [editorOpen, setEditorOpen] = useState(false);
  const [draft, setDraft] = useState<HevyRoutine | null>(editableRoutine);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    null,
  );
  const exercises = editableRoutine?.exercises ?? [];
  const selectedTemplate = templates.find(
    (template) => template.id === selectedTemplateId,
  );
  const searchResults = useMemo(() => {
    const query = exerciseSearch.trim().toLowerCase();
    if (!query || selectedTemplateId) return [];
    return templates
      .filter((template) => template.title.toLowerCase().includes(query))
      .slice(0, 8);
  }, [exerciseSearch, selectedTemplateId, templates]);
  const safeExerciseIndex = safeIndex(
    exerciseIndex,
    draft?.exercises.length ?? 0,
  );
  const selectedExercise = draft?.exercises[safeExerciseIndex] ?? null;
  const canEdit = Boolean(editableRoutine);
  const canSave = Boolean(
    draft?.title.trim() &&
      draft.exercises.length > 0 &&
      draft.exercises.every(
        (exercise) =>
          exercise.title.trim() &&
          exercise.exerciseTemplateId &&
          exercise.sets.length > 0,
      ),
  );

  const updateExercise = (
    update: (exercise: RoutineExercise) => RoutineExercise,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            exercises: current.exercises.map((exercise, currentIndex) =>
              currentIndex === safeExerciseIndex ? update(exercise) : exercise,
            ),
          }
        : current,
    );
  };

  const updateSet = (setIndex: number, patch: RoutineSetPatch) => {
    updateExercise((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, currentIndex) =>
        currentIndex === setIndex ? { ...set, ...patch } : set,
      ),
    }));
  };

  const resetEditor = () => {
    setDraft(editableRoutine);
    setExerciseIndex(0);
    setExerciseSearch("");
    setSelectedTemplateId(null);
    setEditorOpen(false);
  };

  const addExercise = () => {
    if (!draft || !selectedTemplate) return;
    const nextExerciseIndex = draft.exercises.length;
    setDraft({
      ...draft,
      exercises: [
        ...draft.exercises,
        routineExerciseFromTemplate(selectedTemplate),
      ],
    });
    setExerciseIndex(nextExerciseIndex);
    setExerciseSearch("");
    setSelectedTemplateId(null);
  };

  const removeCurrentExercise = () => {
    if (!draft || draft.exercises.length <= 1) return;
    const exercisesAfterRemoval = draft.exercises.filter(
      (_, currentIndex) => currentIndex !== safeExerciseIndex,
    );
    setDraft({ ...draft, exercises: exercisesAfterRemoval });
    setExerciseIndex(
      Math.min(safeExerciseIndex, exercisesAfterRemoval.length - 1),
    );
  };

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col space-y-3">
        <RoutineBookHeader
          page={`${index + 1}/${total}`}
          onPrevious={onPrevious}
          onNext={onNext}
          disabled={total <= 1}
        />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-foreground">{routine.title}</p>
            <p className="mt-1 text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
              from Hevy routines
              {routine.latestAt
                ? ` · latest ${formatDateTime(routine.latestAt)}`
                : ""}
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              className={workspacePageStyles.modalButton}
              onClick={() => {
                setDraft(editableRoutine);
                setExerciseIndex(0);
                setEditorOpen(true);
              }}
            >
              edit
            </button>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 space-y-0 overflow-y-auto pr-1">
          {exercises.map((exercise, exerciseIndex) => (
            <RoutineExerciseRow
              key={`${exercise.exerciseTemplateId ?? exercise.title}-${exerciseIndex}`}
              exercise={exercise}
              unitSystem={unitSystem}
              onClick={() => onSelectExercise(exercise.title)}
            />
          ))}
        </div>
        {!canEdit ? (
          <p className={workspacePageStyles.cardBodyText}>
            Hevy routine details are unavailable; sync routines again before
            editing.
          </p>
        ) : null}
      </div>

      <WorkspaceDialog
        open={editorOpen}
        onOpenChange={(open) => {
          if (!open) resetEditor();
        }}
        className={routineEditorModalClass}
      >
        <WorkspaceModalFrame
          title={`edit ${routine.title}`}
          description="Edit one exercise per page. Search Hevy templates to add an exercise, then configure its sets before saving."
          className="h-full min-h-0 max-h-none"
        >
          <div className="flex h-full min-h-0 flex-1 flex-col pt-4">
            {draft ? (
              <>
                <div className="shrink-0">
                  <div>
                    <p className={workspacePageStyles.metricLabel}>
                      routine title
                    </p>
                    <Input
                      value={draft.title}
                      onChange={(event) =>
                        setDraft({ ...draft, title: event.target.value })
                      }
                      className={inputClass}
                      aria-label="routine title"
                    />
                  </div>
                  <div className="mt-2">
                    <ExerciseTemplatePicker
                      query={exerciseSearch}
                      selectedTemplate={selectedTemplate ?? null}
                      results={searchResults}
                      onQueryChange={(query) => {
                        setExerciseSearch(query);
                        setSelectedTemplateId(null);
                      }}
                      onSelect={(template) => {
                        setExerciseSearch(template.title);
                        setSelectedTemplateId(template.id);
                      }}
                      onAdd={addExercise}
                    />
                  </div>
                </div>
                {saveError ? (
                  <p className={`mt-2 ${workspacePageStyles.errorText}`}>
                    {saveError}
                  </p>
                ) : null}
                {selectedExercise ? (
                  <div className="mt-3 flex min-h-0 flex-1 flex-col">
                    <ExerciseEditorHeader
                      page={`${safeExerciseIndex + 1}/${draft.exercises.length}`}
                      exerciseTitle={selectedExercise.title}
                      previousDisabled={draft.exercises.length <= 1}
                      nextDisabled={draft.exercises.length <= 1}
                      onPrevious={() =>
                        setExerciseIndex((current) =>
                          safeIndex(current - 1, draft.exercises.length),
                        )
                      }
                      onNext={() =>
                        setExerciseIndex((current) =>
                          safeIndex(current + 1, draft.exercises.length),
                        )
                      }
                    />
                    <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                      <RoutineExerciseEditor
                        exercise={selectedExercise}
                        unitSystem={unitSystem}
                        onExerciseChange={(patch) =>
                          updateExercise((current) => ({
                            ...current,
                            ...patch,
                          }))
                        }
                        onSetChange={updateSet}
                        onAddSet={() =>
                          updateExercise((current) => ({
                            ...current,
                            sets: [...current.sets, emptyHevyRoutineSet()],
                          }))
                        }
                        onRemoveSet={(setIndex) =>
                          updateExercise((current) => ({
                            ...current,
                            sets:
                              current.sets.length > 1
                                ? current.sets.filter(
                                    (_, currentIndex) =>
                                      currentIndex !== setIndex,
                                  )
                                : current.sets,
                          }))
                        }
                      />
                    </div>
                  </div>
                ) : null}
                <div
                  className={cn(
                    workspacePinnedModalFooterClass,
                    "justify-between",
                  )}
                >
                  <button
                    type="button"
                    className={workspacePageStyles.modalDangerButton}
                    disabled={saving || draft.exercises.length <= 1}
                    onClick={removeCurrentExercise}
                  >
                    remove exercise
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={workspacePageStyles.modalButton}
                      disabled={saving || !canSave}
                      onClick={() =>
                        onSave(draft, () => {
                          setEditorOpen(false);
                          setExerciseSearch("");
                          setSelectedTemplateId(null);
                        })
                      }
                    >
                      {saving ? "saving" : "save routine"}
                    </button>
                    <button
                      type="button"
                      className={workspacePageStyles.modalButton}
                      disabled={saving}
                      onClick={resetEditor}
                    >
                      cancel
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </WorkspaceModalFrame>
      </WorkspaceDialog>
    </>
  );
}

function RoutineExerciseRow({
  exercise,
  unitSystem,
  onClick,
}: {
  exercise: RoutineExercise;
  unitSystem: UnitSystem;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className="grid w-full gap-2 border-t border-border py-2 text-left hover:bg-foreground/[0.03] sm:grid-cols-[minmax(9rem,0.7fr)_minmax(0,1.8fr)] sm:items-center"
      onClick={onClick}
    >
      <div className="min-w-0 px-2">
        <p className="truncate text-[0.72rem] text-foreground">
          {exercise.title}
        </p>
        <p className="text-[0.58rem] uppercase tracking-[0.14em] text-muted-foreground">
          {exercise.sets.length} sets
          {exercise.restSeconds !== null
            ? ` · ${exercise.restSeconds}s rest`
            : ""}
        </p>
      </div>
      <div className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 px-2">
        {exercise.sets.map((set, setIndex) => (
          <p
            key={`${exercise.exerciseTemplateId}-${setIndex}`}
            className="text-[0.6rem] text-muted-foreground"
          >
            {setIndex + 1}. {hevyRoutineSetLine(set, unitSystem)}
          </p>
        ))}
      </div>
    </button>
  );
}

function RoutineBookHeader({
  page,
  disabled,
  onPrevious,
  onNext,
}: {
  page: string;
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className={workspacePageStyles.cardLabel}>routine book</p>
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

function safeIndex(index: number, total: number) {
  if (total <= 0) return 0;
  return ((index % total) + total) % total;
}
