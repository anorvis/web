"use client";

import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { WorkspaceMetricButton } from "@/components/layout/workspace";
import {
  AddSourceButton,
  RecordRow,
  Section,
} from "@/components/life-intelligence/record-ui";
import {
  fetchHealthDashboard,
  fetchHevyExerciseTemplates,
  fetchHevyRoutines,
  fetchHevySettings,
  type HevyRoutine,
  postHealthForm,
  saveHevyRoutine,
} from "@/features/health/api/health";
import { fetchRecipes } from "@/features/health/api/recipes";
import {
  EmptyState,
  HealthDialog,
  mealMacroLine,
  nextPageIndex,
  previousPageIndex,
  safePageIndex,
  selectPagedItem,
  WorkoutExerciseHistory,
  WorkoutFlipbook,
} from "@/features/health/components/health-dashboard-panels";
import { HealthTrendsCard } from "@/features/health/components/health-trends";
import { MeasurementsModal } from "@/features/health/components/measurements-modal";
import { NewMealPanel } from "@/features/health/components/new-meal";
import { RecipesModal } from "@/features/health/components/recipe-book";
import { RoutineFlipbook } from "@/features/health/components/routine-book";
import {
  EXERCISE_HISTORY_PAGE_SIZE,
  exerciseHistoryRows,
} from "@/features/health/lib/exercise-history";
import {
  bmi,
  bmiStatus,
  latestMeasurementValue,
} from "@/features/health/lib/health-metrics";
import { hevyRoutineSummaries } from "@/features/health/lib/summaries";
import type { NativeMacroProfile } from "@/features/health/types/native-health";
import type { FoodSearchResult } from "@/features/health/utils/forms";
import { fetchIntegrationsList } from "@/features/overview/api/overview";
import { healthFromDashboard } from "@/lib/life-intelligence/adapters";
import { formatDateTime } from "@/lib/life-intelligence/derive";
import { queryKeys } from "@/lib/query/keys";
import { formatRelativeTime } from "@/lib/workspace/view-utils";

const stableCardClass = "flex h-[28rem] min-h-0 flex-col overflow-hidden";

type HealthModal = "workouts" | "meals" | "measurements" | "recipes" | null;
type WorkoutView = "list" | { exercise: string };

export function HealthDashboard() {
  const queryClient = useQueryClient();
  const [mealStatus, setMealStatus] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<HealthModal>(null);
  const [mealsView, setMealsView] = useState<"history" | "new">("history");
  const [workoutIndex, setWorkoutIndex] = useState(0);
  const [routineIndex, setRoutineIndex] = useState(0);
  const [exerciseHistoryIndex, setExerciseHistoryIndex] = useState(0);
  const [workoutView, setWorkoutView] = useState<WorkoutView>("list");
  const dashboardQuery = useQuery({
    queryKey: queryKeys.health.dashboard(),
    queryFn: fetchHealthDashboard,
  });
  const recipesQuery = useQuery({
    queryKey: queryKeys.health.recipes(),
    queryFn: fetchRecipes,
  });
  const sourceQuery = useQuery({
    queryKey: ["health", "sources"],
    queryFn: fetchHevySettings,
  });
  const integrationsQuery = useQuery({
    queryKey: queryKeys.integrations(),
    queryFn: fetchIntegrationsList,
  });
  const routineQuery = useQuery({
    queryKey: ["health", "hevy-routines"],
    queryFn: fetchHevyRoutines,
  });
  const routineTemplateQuery = useQuery({
    queryKey: ["health", "hevy-exercise-templates"],
    queryFn: fetchHevyExerciseTemplates,
    enabled:
      Boolean(sourceQuery.data?.connected) ||
      Boolean(sourceQuery.data?.hasApiKey),
  });
  const routineMutation = useMutation({
    mutationFn: saveHevyRoutine,
    onSuccess: (routine) => {
      queryClient.setQueryData<{ routines: HevyRoutine[] }>(
        ["health", "hevy-routines"],
        (current) => ({
          routines: (current?.routines ?? []).map((item) =>
            item.id === routine.id ? routine : item,
          ),
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["health", "hevy-routines"] });
    },
  });
  const mealMutation = useMutation({
    mutationFn: (formData: FormData) =>
      postHealthForm("/api/health/meals", formData),
    onSuccess: () => {
      setMealStatus("meal saved");
      setMealsView("history");
      queryClient.invalidateQueries({ queryKey: queryKeys.health.dashboard() });
    },
    onError: () => setMealStatus("meal save failed"),
  });

  const health = healthFromDashboard(dashboardQuery.data);
  const macroProfile = (dashboardQuery.data?.macroProfile ??
    null) as NativeMacroProfile | null;
  const recipes = recipesQuery.data?.recipes ?? [];
  const measurementHistory = dashboardQuery.data?.measurementHistory ?? [];
  const latestWeight = latestMeasurementValue(measurementHistory, "weightKg");
  const bmiProfile =
    macroProfile && latestWeight !== null
      ? { ...macroProfile, weightKg: latestWeight }
      : macroProfile;
  const bmiSummary = bmiStatus(bmiProfile);
  const bmiValue = bmiProfile
    ? bmi(bmiProfile.weightKg, bmiProfile.heightCm)
    : null;
  const measurementCount = measurementHistory.length;
  const selectedWorkout = selectPagedItem(health.workouts, workoutIndex);
  const routines = useMemo(
    () => hevyRoutineSummaries(routineQuery.data?.routines ?? []),
    [routineQuery.data],
  );
  const selectedRoutine = selectPagedItem(routines, routineIndex);
  const selectedHevyRoutine =
    selectedRoutine?.source === "hevy"
      ? (routineQuery.data?.routines.find(
          (routine) => routine.id === selectedRoutine.id,
        ) ?? null)
      : null;
  const selectedExerciseTitle =
    typeof workoutView === "object" ? workoutView.exercise : null;
  const selectedExerciseHistoryRows = selectedExerciseTitle
    ? exerciseHistoryRows(health.workouts, selectedExerciseTitle)
    : [];
  const selectedExerciseHistoryPageCount = Math.ceil(
    selectedExerciseHistoryRows.length / EXERCISE_HISTORY_PAGE_SIZE,
  );
  const hevyIntegration = integrationsQuery.data?.find(
    (integration) => integration.provider === "hevy",
  );
  const connectedSources = [
    "local health",
    ...(sourceQuery.data?.connected || sourceQuery.data?.hasApiKey
      ? ["hevy"]
      : []),
  ];

  const openMealModal = (view: "history" | "new") => {
    setMealsView(view);
    setActiveModal("meals");
  };
  const openExerciseHistory = (exercise: string) => {
    setExerciseHistoryIndex(0);
    setWorkoutView({ exercise });
    setActiveModal("workouts");
  };
  const logFood = (result: FoodSearchResult) => {
    const formData = new FormData();
    formData.set("name", result.name);
    formData.set("mealType", "meal");
    formData.set("loggedAt", new Date().toISOString());
    formData.set("calories", String(result.calories));
    formData.set("proteinGrams", String(result.proteinGrams));
    formData.set("carbsGrams", String(result.carbsGrams));
    formData.set("fatGrams", String(result.fatGrams));
    formData.set("notes", `${result.provider}:${result.id}`);
    mealMutation.mutate(formData);
  };

  return (
    <div className="space-y-4">
      <section className="grid gap-4 xl:grid-cols-4">
        <WorkspaceMetricButton
          label="measurements"
          value={bmiValue === null ? `${measurementCount}` : `${bmiValue}`}
          note={
            bmiSummary
              ? `BMI ${bmiValue} · ${bmiSummary.category}`
              : bmiValue === null
                ? `${measurementCount} body measurement${measurementCount === 1 ? "" : "s"}`
                : `BMI ${bmiValue} · adult range colour unavailable`
          }
          valueStyle={bmiSummary ? { color: bmiSummary.tone } : undefined}
          noteStyle={bmiSummary ? { color: bmiSummary.tone } : undefined}
          onClick={() => setActiveModal("measurements")}
        />
        <WorkspaceMetricButton
          label="workouts"
          value={`${health.workouts.length}`}
          note="click for paginated training log"
          onClick={() => {
            setWorkoutView("list");
            setActiveModal("workouts");
          }}
        />
        <WorkspaceMetricButton
          label="meals"
          value={`${health.meals.length}`}
          note="consumed meal history"
          onClick={() => openMealModal("history")}
          action={
            <button
              type="button"
              aria-label="add meal"
              onClick={(event) => {
                event.stopPropagation();
                openMealModal("new");
              }}
              className="grid size-8 place-items-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            >
              +
            </button>
          }
        />
        <WorkspaceMetricButton
          label="recipes"
          value={`${recipes.length}`}
          note="saved recipes + favourites"
          onClick={() => setActiveModal("recipes")}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Section label="training" title="routines">
          <div className={stableCardClass}>
            {routineQuery.isLoading ? (
              <Skeleton className="h-full rounded-none" />
            ) : routineQuery.isError ? (
              <EmptyState
                title="Hevy routines could not be loaded."
                body="Check that anorvis-os is current and your saved Hevy API key is still valid."
                action={
                  <button
                    type="button"
                    className={workspacePageStyles.modalButton}
                    onClick={() => void routineQuery.refetch()}
                  >
                    retry
                  </button>
                }
              />
            ) : selectedRoutine ? (
              <RoutineFlipbook
                key={selectedRoutine.id}
                routine={selectedRoutine}
                editableRoutine={selectedHevyRoutine}
                templates={routineTemplateQuery.data?.exerciseTemplates ?? []}
                saving={routineMutation.isPending}
                saveError={
                  routineMutation.isError ? "routine save failed" : null
                }
                index={safePageIndex(routineIndex, routines.length)}
                total={routines.length}
                onSave={(routine, onSaved) =>
                  routineMutation.mutate(routine, { onSuccess: onSaved })
                }
                onPrevious={() =>
                  setRoutineIndex((current) =>
                    previousPageIndex(current, routines.length),
                  )
                }
                onNext={() =>
                  setRoutineIndex((current) =>
                    nextPageIndex(current, routines.length),
                  )
                }
                onSelectExercise={openExerciseHistory}
              />
            ) : (
              <EmptyState
                title="No Hevy routines found."
                body="Add a routine in Hevy, then refresh this card."
                action={
                  <button
                    type="button"
                    className={workspacePageStyles.modalButton}
                    onClick={() => void routineQuery.refetch()}
                  >
                    refresh
                  </button>
                }
              />
            )}
          </div>
        </Section>

        <Section label="trends" title="health graph">
          <div className={stableCardClass}>
            <HealthTrendsCard
              dashboard={dashboardQuery.data}
              loading={dashboardQuery.isLoading}
              isError={dashboardQuery.isError}
              onRetry={() => void dashboardQuery.refetch()}
            />
          </div>
        </Section>
      </section>

      <Section
        label="sources"
        title="health setup"
        headerExtra={<AddSourceButton domain="health" />}
      >
        <p className={workspacePageStyles.cardBodyText}>
          Connect workout and nutrition sources here. Metrics above render only
          from saved workouts, meals, measurements, and imported source data.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[0.58rem] uppercase tracking-[0.18em] text-muted-foreground">
            sources
          </span>
          {connectedSources.map((source) => (
            <span
              key={source}
              className="inline-flex items-center gap-1 border border-border px-2 py-1 text-[0.58rem] uppercase tracking-[0.16em] text-foreground"
            >
              <span className="text-emerald-500">●</span>
              {source === "hevy" && hevyIntegration
                ? `${source} connected · synced ${formatRelativeTime(hevyIntegration.sync.lastSyncedAt)}`
                : `${source} connected`}
            </span>
          ))}
        </div>
      </Section>

      <HealthDialog
        open={activeModal === "workouts"}
        onOpenChange={(open) => {
          if (!open) {
            setActiveModal(null);
          }
        }}
        title={selectedExerciseTitle ?? "workout log"}
        description={
          selectedExerciseTitle
            ? "Logged sets for this exercise, paginated by row count."
            : "One workout per page. Click an exercise to open its history."
        }
      >
        {selectedExerciseTitle ? (
          <WorkoutExerciseHistory
            rows={selectedExerciseHistoryRows}
            index={safePageIndex(
              exerciseHistoryIndex,
              selectedExerciseHistoryPageCount,
            )}
            total={selectedExerciseHistoryPageCount}
            onPrevious={() =>
              setExerciseHistoryIndex((current) =>
                previousPageIndex(current, selectedExerciseHistoryPageCount),
              )
            }
            onNext={() =>
              setExerciseHistoryIndex((current) =>
                nextPageIndex(current, selectedExerciseHistoryPageCount),
              )
            }
            onBack={() => {
              setExerciseHistoryIndex(0);
              setWorkoutView("list");
            }}
          />
        ) : selectedWorkout ? (
          <WorkoutFlipbook
            workout={selectedWorkout}
            index={safePageIndex(workoutIndex, health.workouts.length)}
            total={health.workouts.length}
            onPrevious={() =>
              setWorkoutIndex((current) =>
                previousPageIndex(current, health.workouts.length),
              )
            }
            onNext={() =>
              setWorkoutIndex((current) =>
                nextPageIndex(current, health.workouts.length),
              )
            }
            onSelectExercise={openExerciseHistory}
          />
        ) : (
          <EmptyState
            title="No workouts yet."
            body="Add a workout source to populate training records."
          />
        )}
      </HealthDialog>

      <HealthDialog
        open={activeModal === "meals"}
        onOpenChange={(open) => {
          if (!open) {
            setActiveModal(null);
          }
        }}
        title={mealsView === "history" ? "meals" : "new meal"}
        description={
          mealsView === "history"
            ? "Saved meal history. Press + meal to search foods or log manually."
            : "Search foods or saved recipes, or enter a meal manually."
        }
      >
        {mealsView === "history" ? (
          <div className="flex min-h-full flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <p className={workspacePageStyles.cardBodyText}>
                {health.meals.length} saved meals
              </p>
              <button
                type="button"
                className={workspacePageStyles.modalButton}
                onClick={() => setMealsView("new")}
              >
                add a meal
              </button>
            </div>
            {mealStatus ? (
              <p
                className={workspacePageStyles.cardBodyText}
                aria-live="polite"
              >
                {mealStatus}
              </p>
            ) : null}
            {health.meals.length > 0 ? (
              <div className="space-y-0">
                {health.meals.map((meal) => (
                  <RecordRow
                    key={meal.id}
                    label={formatDateTime(meal.time)}
                    value={meal.title}
                    meta={mealMacroLine(meal)}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No meals yet."
                body="Use add a meal above to save your first food record."
              />
            )}
          </div>
        ) : (
          <NewMealPanel
            onBack={() => setMealsView("history")}
            onLogFood={logFood}
            onSubmitMeal={(formData) => mealMutation.mutate(formData)}
            isLogging={mealMutation.isPending}
            logStatus={mealStatus}
          />
        )}
      </HealthDialog>

      <MeasurementsModal
        open={activeModal === "measurements"}
        onOpenChange={(open) => {
          if (!open) {
            setActiveModal(null);
          }
        }}
        dashboard={dashboardQuery.data}
      />

      <RecipesModal
        open={activeModal === "recipes"}
        onOpenChange={(open) => {
          if (!open) {
            setActiveModal(null);
          }
        }}
      />
    </div>
  );
}
