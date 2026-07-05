import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { Label } from "@anorvis/ui/label";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { WorkspaceDialog } from "@/components/layout/workspace-dialog";
import { useHealthActions } from "@/features/health/components/actions";
import { useHealthStore } from "@/features/health/stores/health-store";
import type {
  ExerciseSearchResult,
  WorkoutTemplate,
} from "@/features/health/utils/forms";

type Workout = { title: string; durationMinutes: string; notes: string };
type WorkoutExercise = {
  id: string;
  title: string;
  sets: { id: string; weightKg: string; reps: string }[];
};

export type WorkoutDialogActions = {
  workout: Workout;
  templates: WorkoutTemplate[];
  exercises: WorkoutExercise[];
  exercisesForSubmit: unknown[];
  currentExercise: WorkoutExercise | null;
  search: string;
  searchResults: ExerciseSearchResult[];
  isPending: boolean;
  inputClass: string;
  textareaClass: string;
  weightUnitLabel: string;
  setWorkoutValue: (
    field: keyof Workout,
  ) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => void;
  setSetValue: (
    exerciseIndex: number,
    setIndex: number,
    field: "weightKg" | "reps",
    value: string,
  ) => void;
  setSearch: (value: string) => void;
  loadTemplate: (id: string) => void;
  searchExercises: (query?: string) => Promise<void>;
  selectExercise: (result: ExerciseSearchResult) => void;
  addSet: (exerciseIndex: number) => void;
  removeSet: (exerciseIndex: number, setIndex: number) => void;
  removeExercise: (index: number) => void;
  onSaveTemplate: () => void;
  onSubmit: (formData: FormData) => void;
};

export function WorkoutDialog() {
  const props = useHealthActions<{ workout: WorkoutDialogActions }>().workout;
  const {
    workoutOpen,
    exerciseSearchPage,
    saveAsWorkoutTemplate,
    workoutExercisePage,
    setWorkoutOpen,
    setExerciseSearchPage,
    setSaveAsWorkoutTemplate,
    setWorkoutExercisePage,
  } = useHealthStore();

  return (
    <WorkspaceDialog
      open={workoutOpen}
      onOpenChange={(open) => {
        setWorkoutOpen(open);
      }}
    >
      <DialogHeader>
        <DialogTitle className={workspacePageStyles.cardTitle}>
          log workout
        </DialogTitle>
        <DialogDescription className={workspacePageStyles.cardBodyText}>
          add a session and as many exercises as you need.
        </DialogDescription>
      </DialogHeader>
      <form
        action={(formData) => {
          props.onSaveTemplate();
          props.onSubmit(formData);
        }}
        className="space-y-4"
      >
        {Object.entries(props.workout).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <input
          type="hidden"
          name="exercisesJson"
          value={JSON.stringify(props.exercisesForSubmit)}
        />
        <div className="grid gap-3">
          <Label className={workspacePageStyles.cardLabel}>session</Label>
          {props.templates.length ? (
            <select
              className={props.inputClass}
              defaultValue=""
              onChange={(event) => props.loadTemplate(event.target.value)}
            >
              <option value="" disabled>
                load saved workout
              </option>
              {props.templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.title}
                </option>
              ))}
            </select>
          ) : null}
          <input
            className={props.inputClass}
            placeholder="workout title"
            value={props.workout.title}
            onChange={props.setWorkoutValue("title")}
          />
          <input
            className={props.inputClass}
            placeholder="duration minutes"
            inputMode="numeric"
            value={props.workout.durationMinutes}
            onChange={props.setWorkoutValue("durationMinutes")}
          />
          <Label className={workspacePageStyles.cardLabel}>exercises</Label>
          <div className={workspacePageStyles.formPanelCompact}>
            <input
              className={props.inputClass}
              placeholder="search exercise"
              value={props.search}
              onChange={(event) => {
                props.setSearch(event.target.value);
                setExerciseSearchPage(0);
                void props.searchExercises(event.target.value);
              }}
            />
            {(() => {
              const pageSize = 6;
              const pageCount = Math.ceil(
                props.searchResults.length / pageSize,
              );
              const visibleResults = props.searchResults.slice(
                exerciseSearchPage * pageSize,
                exerciseSearchPage * pageSize + pageSize,
              );
              return props.searchResults.length ? (
                <div className="grid gap-2">
                  {visibleResults.map((result) => (
                    <button
                      type="button"
                      key={result.id}
                      onClick={() => props.selectExercise(result)}
                      className={`${workspacePageStyles.outlineButton} justify-between text-left`}
                    >
                      <span>
                        {result.name}
                        <span className="text-muted-foreground">
                          {" "}
                          · {result.muscle ?? "exercise"} ·{" "}
                          {result.equipment ?? result.source}
                        </span>
                      </span>
                    </button>
                  ))}
                  {pageCount > 1 ? (
                    <div className={workspacePageStyles.splitRow}>
                      <button
                        type="button"
                        onClick={() =>
                          setExerciseSearchPage((page) => Math.max(0, page - 1))
                        }
                        className={workspacePageStyles.inlineSubmit}
                        disabled={exerciseSearchPage === 0}
                      >
                        prev
                      </button>
                      <span className={workspacePageStyles.cardBodyText}>
                        {exerciseSearchPage + 1} / {pageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setExerciseSearchPage((page) =>
                            Math.min(pageCount - 1, page + 1),
                          )
                        }
                        className={workspacePageStyles.inlineSubmit}
                        disabled={exerciseSearchPage >= pageCount - 1}
                      >
                        next
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null;
            })()}
          </div>
          {props.currentExercise?.title.trim() ? (
            <div className={workspacePageStyles.formPanel}>
              <div className="min-w-0">
                <p className={workspacePageStyles.cardBodyText}>
                  {props.currentExercise.title}
                </p>
                <p className={workspacePageStyles.metricLabel}>
                  exercise {workoutExercisePage + 1} of {props.exercises.length}{" "}
                  · {props.currentExercise.sets.length} set
                  {props.currentExercise.sets.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className={workspacePageStyles.formScrollable}>
                {props.currentExercise.sets.map((set, setIndex) => (
                  <div key={set.id} className={workspacePageStyles.formGridRow}>
                    <span className={workspacePageStyles.cardBodyText}>
                      set {setIndex + 1}
                    </span>
                    <input
                      className={props.inputClass}
                      placeholder={`weight ${props.weightUnitLabel}`}
                      inputMode="decimal"
                      value={set.weightKg}
                      onChange={(event) =>
                        props.setSetValue(
                          workoutExercisePage,
                          setIndex,
                          "weightKg",
                          event.target.value,
                        )
                      }
                    />
                    <input
                      className={props.inputClass}
                      placeholder="reps"
                      inputMode="numeric"
                      value={set.reps}
                      onChange={(event) =>
                        props.setSetValue(
                          workoutExercisePage,
                          setIndex,
                          "reps",
                          event.target.value,
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        props.removeSet(workoutExercisePage, setIndex)
                      }
                      className={workspacePageStyles.inlineSubmit}
                      disabled={props.currentExercise?.sets.length === 1}
                    >
                      remove set
                    </button>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => props.addSet(workoutExercisePage)}
                className={workspacePageStyles.outlineButton}
              >
                + add set
              </button>
              <div className={workspacePageStyles.formFooter}>
                <button
                  type="button"
                  onClick={() =>
                    setWorkoutExercisePage((page) => Math.max(0, page - 1))
                  }
                  className={workspacePageStyles.inlineSubmit}
                  disabled={workoutExercisePage === 0}
                >
                  prev exercise
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setWorkoutExercisePage((page) =>
                      Math.min(props.exercises.length - 1, page + 1),
                    )
                  }
                  className={workspacePageStyles.inlineSubmit}
                  disabled={workoutExercisePage >= props.exercises.length - 1}
                >
                  next exercise
                </button>
                <button
                  type="button"
                  onClick={() => props.removeExercise(workoutExercisePage)}
                  className={workspacePageStyles.inlineSubmit}
                >
                  remove exercise
                </button>
              </div>
            </div>
          ) : null}
          <Label className={workspacePageStyles.cardLabel}>notes</Label>
          <textarea
            className={props.textareaClass}
            placeholder="notes"
            value={props.workout.notes}
            onChange={props.setWorkoutValue("notes")}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={saveAsWorkoutTemplate}
              onChange={(event) =>
                setSaveAsWorkoutTemplate(event.target.checked)
              }
            />
            <span className={workspacePageStyles.cardBodyText}>
              save this workout as a template
            </span>
          </label>
        </div>
        <div className={workspacePageStyles.formActions}>
          <button
            type="button"
            onClick={() => setWorkoutOpen(false)}
            className={workspacePageStyles.outlineButton}
          >
            cancel
          </button>
          <button
            disabled={props.isPending}
            type="submit"
            className={workspacePageStyles.outlineButton}
          >
            save workout
          </button>
        </div>
      </form>
    </WorkspaceDialog>
  );
}
