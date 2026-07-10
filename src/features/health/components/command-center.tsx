"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ChangeEvent } from "react";
import { useRef, useState } from "react";
import { searchExercise, searchFood } from "@/features/health/api/health";
import { saveRecipe } from "@/features/health/api/recipes";
import { HealthActionsProvider } from "@/features/health/components/actions";
import { QuizPrompt } from "@/features/health/components/intro";
import { MealDialog } from "@/features/health/components/meal";
import { MacroQuiz } from "@/features/health/components/quiz";
import {
  DietSection,
  FitnessSection,
  MedicalSection,
} from "@/features/health/components/sections";
import { WorkoutDialog } from "@/features/health/components/workout";
import { useHealthController } from "@/features/health/hooks/use-health-controller";
import { useHealthStore } from "@/features/health/stores/health-store";
import type { NativeHealthDashboard } from "@/features/health/types/native-health";
import {
  cmToIn,
  createWorkoutExercise,
  createWorkoutSet,
  type ExerciseSearchResult,
  type FoodSearchResult,
  formatUnitValue,
  initialMeal,
  initialWorkout,
  type initialWorkoutExercise,
  inToCm,
  kgToLb,
  lbToKg,
  readWorkoutTemplates,
  sumMeals,
  type WorkoutTemplate,
  weekDays,
  workoutTemplateStorageKey,
} from "@/features/health/utils/forms";
import { toDateString } from "@/features/life/lib/calendar-utils";
import { useMountEffect } from "@/hooks/use-mount-effect";
import { queryKeys } from "@/lib/query/keys";
export function HealthCommandCenter({
  dashboard,
}: {
  dashboard: NativeHealthDashboard;
}) {
  const {
    unitSystem,
    quizOpen,
    quizStep,
    mealSearchPage,
    saveAsRecipe,
    saveAsWorkoutTemplate,
    workoutExercisePage,
    hydrateUnitSystem,
    weekOffset,
    setQuizOpen,
    setQuizStep,
    setMealOpen,
    setMealMode,
    setMealSearchPage,
    setSaveAsRecipe,
    setWorkoutOpen,
    setExerciseSearchPage,
    setSaveAsWorkoutTemplate,
    setWorkoutExercisePage,
  } = useHealthStore();
  const {
    deleteMeal: deleteMealMutation,
    error,
    isPending,
    submit,
  } = useHealthController();
  const queryClient = useQueryClient();
  const recipeMutation = useMutation({
    mutationFn: saveRecipe,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.health.recipes() }),
  });
  const mealSearchRequestId = useRef(0);
  const profile = dashboard.macroProfile;
  const [mealSearch, setMealSearch] = useState("");
  const [mealSearchLoading, setMealSearchLoading] = useState(false);
  const [mealProvider, setMealProvider] = useState("all");
  const [mealSearchResults, setMealSearchResults] = useState<
    FoodSearchResult[]
  >([]);
  const [exerciseSearch, setExerciseSearch] = useState("");
  const [exerciseSearchResults, setExerciseSearchResults] = useState<
    ExerciseSearchResult[]
  >([]);
  const [savedWorkoutTemplates, setSavedWorkoutTemplates] = useState<
    WorkoutTemplate[]
  >([]);
  const [workoutExercises, setWorkoutExercises] = useState<
    (typeof initialWorkoutExercise)[]
  >([]);

  useMountEffect(() => {
    hydrateUnitSystem();
    setSavedWorkoutTemplates(readWorkoutTemplates());
  });
  const [quiz, setQuiz] = useState({
    birthdate: profile?.birthdate ?? "",
    heightCm: profile
      ? unitSystem === "imperial"
        ? formatUnitValue(cmToIn(profile.heightCm))
        : String(profile.heightCm)
      : "",
    weightKg: profile
      ? unitSystem === "imperial"
        ? formatUnitValue(kgToLb(profile.weightKg))
        : String(profile.weightKg)
      : "",
    bodyFatPercent: profile?.bodyFatPercent
      ? String(profile.bodyFatPercent)
      : "",
    sex: profile?.sex ?? "male",
    goal: profile?.goal ?? "maintain",
    trainingDaysPerWeek: profile ? String(profile.trainingDaysPerWeek) : "",
    activityLevel: profile?.activityLevel ?? "moderate",
    targetCalories: profile ? String(profile.targetCalories) : "",
    proteinGrams: profile ? String(profile.proteinGrams) : "",
    carbsGrams: profile ? String(profile.carbsGrams) : "",
    fatGrams: profile ? String(profile.fatGrams) : "",
  });
  const [meal, setMeal] = useState(initialMeal);
  const [workout, setWorkout] = useState(initialWorkout);
  const totals = sumMeals(dashboard.todayMeals);
  const latestWorkout = dashboard.recentWorkouts[0];
  const days = weekDays(weekOffset);
  const weekLabel =
    weekOffset === 0
      ? "this week"
      : weekOffset === -1
        ? "last week"
        : weekOffset === 1
          ? "next week"
          : weekOffset < 0
            ? `${Math.abs(weekOffset)} weeks ago`
            : `${weekOffset} weeks ahead`;
  const todayKey = toDateString(new Date());
  const inputClass = `w-full ${workspacePageStyles.inlineInput}`;
  const textareaClass = `min-h-20 w-full resize-none ${workspacePageStyles.inlineInput}`;
  const heightUnitLabel = unitSystem === "imperial" ? "in" : "cm";
  const weightUnitLabel = unitSystem === "imperial" ? "lb" : "kg";
  const mealPageSize = 6;
  const mealPageCount = Math.ceil(mealSearchResults.length / mealPageSize);
  const visibleMealResults = mealSearchResults.slice(
    mealSearchPage * mealPageSize,
    mealSearchPage * mealPageSize + mealPageSize,
  );
  const currentWorkoutExercisePage = Math.min(
    workoutExercisePage,
    Math.max(0, workoutExercises.length - 1),
  );
  const currentWorkoutExercise =
    workoutExercises[currentWorkoutExercisePage] ?? null;
  const selectedMealKey = meal.notes;
  const quizRequiredComplete = Boolean(
    quiz.birthdate.trim() &&
      quiz.heightCm.trim() &&
      quiz.weightKg.trim() &&
      quiz.sex.trim() &&
      quiz.goal.trim() &&
      quiz.trainingDaysPerWeek.trim() &&
      quiz.activityLevel.trim(),
  );
  const workoutExercisesForSubmit = workoutExercises.map((exercise) => ({
    ...exercise,
    sets: exercise.sets.map((set) => ({
      ...set,
      weightKg:
        unitSystem === "imperial" && set.weightKg.trim()
          ? formatUnitValue(lbToKg(Number(set.weightKg)))
          : set.weightKg,
    })),
  }));

  function setQuizValue(field: keyof typeof quiz) {
    return (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setQuiz((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function setMealValue(field: keyof typeof meal) {
    return (
      event: ChangeEvent<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >,
    ) => {
      setMeal((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function setWorkoutValue(field: keyof typeof workout) {
    return (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setWorkout((current) => ({ ...current, [field]: event.target.value }));
    };
  }

  function setWorkoutSetValue(
    exerciseIndex: number,
    setIndex: number,
    field: "weightKg" | "reps",
    value: string,
  ) {
    setWorkoutExercises((current) =>
      current.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exercise,
              sets: exercise.sets.map((set, currentSetIndex) =>
                currentSetIndex === setIndex ? { ...set, [field]: value } : set,
              ),
            }
          : exercise,
      ),
    );
  }

  function setQuizField(field: keyof typeof quiz, value: string) {
    setQuiz((current) => ({ ...current, [field]: value }));
  }

  function addWorkoutSet(exerciseIndex: number) {
    setWorkoutExercises((current) =>
      current.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? { ...exercise, sets: [...exercise.sets, createWorkoutSet()] }
          : exercise,
      ),
    );
  }

  function removeWorkoutSet(exerciseIndex: number, setIndex: number) {
    setWorkoutExercises((current) =>
      current.map((exercise, currentExerciseIndex) =>
        currentExerciseIndex === exerciseIndex
          ? {
              ...exercise,
              sets:
                exercise.sets.length <= 1
                  ? exercise.sets
                  : exercise.sets.filter((_, index) => index !== setIndex),
            }
          : exercise,
      ),
    );
  }

  function removeWorkoutExercise(index: number) {
    setWorkoutExercises((current) =>
      current.filter((_, currentIndex) => currentIndex !== index),
    );
    setWorkoutExercisePage((page) => Math.max(0, page - 1));
  }

  async function searchMeals(query = mealSearch) {
    const requestId = mealSearchRequestId.current + 1;
    mealSearchRequestId.current = requestId;
    if (!query.trim()) {
      setMealSearchResults([]);
      setMealSearchPage(0);
      return;
    }
    setMealSearchLoading(true);
    try {
      const payload = await searchFood(query, mealProvider);
      if (mealSearchRequestId.current === requestId) {
        setMealSearchResults(payload.results ?? []);
        setMealSearchPage(0);
      }
    } finally {
      if (mealSearchRequestId.current === requestId) {
        setMealSearchLoading(false);
      }
    }
  }

  async function searchExercises(query = exerciseSearch) {
    if (!query.trim()) {
      setExerciseSearchResults([]);
      setExerciseSearchPage(0);
      return;
    }
    const payload = (await searchExercise(query)) as {
      results?: ExerciseSearchResult[];
    };
    setExerciseSearchResults(payload.results ?? []);
    setExerciseSearchPage(0);
  }

  function selectExercise(result: ExerciseSearchResult) {
    const exercise = {
      ...createWorkoutExercise(),
      title: result.name,
    };
    setWorkoutExercises((current) => [...current, exercise]);
    setWorkoutExercisePage(workoutExercises.length);
    setExerciseSearch("");
    setExerciseSearchPage(0);
    setExerciseSearchResults([]);
  }

  function selectMealResult(result: FoodSearchResult) {
    mealSearchRequestId.current += 1;
    setMeal((current) => ({
      ...current,
      name: result.name,
      calories: String(result.calories),
      proteinGrams: String(result.proteinGrams),
      carbsGrams: String(result.carbsGrams),
      fatGrams: String(result.fatGrams),
      notes: `${result.provider}:${result.id}`,
    }));
    setMealSearch("");
    setMealSearchResults([]);
    setMealSearchPage(0);
    setMealSearchLoading(false);
  }

  function deleteMeal() {
    if (!meal.id) return;
    deleteMealMutation(meal.id, () => setMealOpen(false));
  }

  function maybeSaveRecipe() {
    if (!saveAsRecipe || !meal.name.trim()) return;
    recipeMutation.mutate({
      title: meal.name.trim(),
      source: "manual",
      sourceId: null,
      sourceUrl: null,
      imageUrl: null,
      youtubeUrl: null,
      category: null,
      area: null,
      calories: Number(meal.calories) || 0,
      proteinGrams: Number(meal.proteinGrams) || 0,
      carbsGrams: Number(meal.carbsGrams) || 0,
      fatGrams: Number(meal.fatGrams) || 0,
      isFavorite: false,
      notes: meal.notes.trim() || null,
      ingredients: [],
      instructions: [],
    });
  }

  function maybeSaveWorkoutTemplate() {
    if (!saveAsWorkoutTemplate) return;
    const exercises = workoutExercises.filter((exercise) =>
      exercise.title.trim(),
    );
    if (!exercises.length) return;
    const template: WorkoutTemplate = {
      id: crypto.randomUUID(),
      title: workout.title.trim() || "workout",
      exercises: exercises.map((exercise) => ({
        ...exercise,
        id: crypto.randomUUID(),
        sets: exercise.sets.map(() => createWorkoutSet()),
      })),
    };
    const next = [template, ...savedWorkoutTemplates];
    setSavedWorkoutTemplates(next);
    localStorage.setItem(workoutTemplateStorageKey, JSON.stringify(next));
  }

  function loadWorkoutTemplate(templateId: string) {
    const template = savedWorkoutTemplates.find(
      (item) => item.id === templateId,
    );
    if (!template) return;
    setWorkout((current) => ({ ...current, title: template.title }));
    const exercises = template.exercises.map((exercise) => ({
      ...exercise,
      id: crypto.randomUUID(),
      sets: exercise.sets.map(() => createWorkoutSet()),
    }));
    setWorkoutExercises(exercises);
    setWorkoutExercisePage(0);
  }

  function openMealForDay(day: string) {
    setMeal({
      ...initialMeal,
      loggedAt: new Date(`${day}T12:00:00`).toISOString(),
    });
    setMealMode("search");
    setMealSearch("");
    setMealSearchResults([]);
    setMealSearchPage(0);
    setSaveAsRecipe(false);
    setMealOpen(true);
  }

  function openMealForEdit(
    entry: NativeHealthDashboard["recentMeals"][number],
  ) {
    setMeal({
      id: entry.id,
      name: entry.name,
      mealType: entry.mealType,
      calories: String(entry.calories),
      proteinGrams: String(entry.proteinGrams),
      carbsGrams: String(entry.carbsGrams),
      fatGrams: String(entry.fatGrams),
      notes: entry.notes ?? "",
      loggedAt: entry.loggedAt,
    });
    setMealMode("manual");
    setMealSearch("");
    setMealSearchResults([]);
    setMealSearchPage(0);
    setSaveAsRecipe(false);
    setMealOpen(true);
  }

  function openWorkoutForDay(day: string) {
    setWorkout({
      ...initialWorkout,
      startedAt: new Date(`${day}T12:00:00`).toISOString(),
    });
    setWorkoutExercises([]);
    setWorkoutExercisePage(0);
    setExerciseSearch("");
    setExerciseSearchPage(0);
    setExerciseSearchResults([]);
    setSaveAsWorkoutTemplate(false);
    setWorkoutOpen(true);
  }

  function openWorkoutForEdit(
    entry: NativeHealthDashboard["recentWorkouts"][number],
  ) {
    setWorkout({
      id: entry.id,
      title: entry.title,
      durationMinutes: String(Math.round(entry.durationSeconds / 60)),
      notes: entry.notes ?? "",
      startedAt: entry.startedAt,
    });
    const exercises = entry.exercises.map((exercise) => ({
      id: crypto.randomUUID(),
      title: exercise.title,
      sets: exercise.sets.length
        ? exercise.sets.map((set) => ({
            id: crypto.randomUUID(),
            weightKg:
              set.weightKg === null
                ? ""
                : unitSystem === "imperial"
                  ? formatUnitValue(kgToLb(set.weightKg))
                  : String(set.weightKg),
            reps: set.reps === null ? "" : String(set.reps),
          }))
        : [createWorkoutSet()],
    }));
    setWorkoutExercises(exercises);
    setWorkoutExercisePage(0);
    setExerciseSearch("");
    setExerciseSearchPage(0);
    setExerciseSearchResults([]);
    setSaveAsWorkoutTemplate(false);
    setWorkoutOpen(true);
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p className="border border-destructive/40 p-3 text-xs text-destructive">
          {error}
        </p>
      ) : null}

      <QuizPrompt
        hasProfile={Boolean(profile)}
        onStart={() => {
          setQuizStep(0);
          setQuizOpen(true);
        }}
      />

      <MacroQuiz
        open={quizOpen}
        onOpenChange={setQuizOpen}
        step={quizStep}
        setStep={setQuizStep}
        quiz={quiz}
        setValue={setQuizValue}
        setField={setQuizField}
        inputClass={inputClass}
        heightUnitLabel={heightUnitLabel}
        weightUnitLabel={weightUnitLabel}
        requiredComplete={quizRequiredComplete}
        isPending={isPending}
        onCalculate={() => {
          if (!quizRequiredComplete) return;
          const formData = new FormData();
          for (const [key, value] of Object.entries(quiz)) {
            formData.set(key, value);
          }
          if (unitSystem === "imperial") {
            formData.set(
              "heightCm",
              formatUnitValue(inToCm(Number(quiz.heightCm))),
            );
            formData.set(
              "weightKg",
              formatUnitValue(lbToKg(Number(quiz.weightKg))),
            );
          }
          submit("/api/health/macro-profile", () => {
            setQuizOpen(false);
          })(formData);
        }}
      />

      <HealthActionsProvider
        value={{
          meal: {
            meal,
            search: mealSearch,
            setSearch: setMealSearch,
            loading: mealSearchLoading,
            provider: mealProvider,
            setProvider: setMealProvider,
            pageCount: mealPageCount,
            results: mealSearchResults,
            visibleResults: visibleMealResults,
            selectedKey: selectedMealKey,
            isPending,
            inputClass,
            textareaClass,
            setMealValue,
            onClearSearch: () => {
              mealSearchRequestId.current += 1;
              setMealSearchResults([]);
              setMealSearchLoading(false);
            },
            searchMeals,
            selectResult: selectMealResult,
            onSaveRecipe: maybeSaveRecipe,
            onDelete: deleteMeal,
            onSubmit: (formData: FormData) => {
              submit("/api/health/meals", () => {
                setMealOpen(false);
              })(formData);
            },
          },
          workout: {
            workout,
            templates: savedWorkoutTemplates,
            exercises: workoutExercises,
            exercisesForSubmit: workoutExercisesForSubmit,
            currentExercise: currentWorkoutExercise,
            search: exerciseSearch,
            searchResults: exerciseSearchResults,
            isPending,
            inputClass,
            textareaClass,
            weightUnitLabel,
            setWorkoutValue,
            setSetValue: setWorkoutSetValue,
            setSearch: setExerciseSearch,
            loadTemplate: loadWorkoutTemplate,
            searchExercises,
            selectExercise,
            addSet: addWorkoutSet,
            removeSet: removeWorkoutSet,
            removeExercise: removeWorkoutExercise,
            onSaveTemplate: maybeSaveWorkoutTemplate,
            onSubmit: (formData: FormData) => {
              submit("/api/health/native-workouts", () => {
                setWorkoutOpen(false);
              })(formData);
            },
          },
        }}
      >
        <MealDialog />
        <WorkoutDialog />
      </HealthActionsProvider>

      <DietSection
        dashboard={dashboard}
        profile={profile}
        totals={totals}
        days={days}
        todayKey={todayKey}
        weekLabel={weekLabel}
        openMealForDay={openMealForDay}
        openMealForEdit={openMealForEdit}
      />
      <FitnessSection
        dashboard={dashboard}
        latestWorkout={latestWorkout}
        days={days}
        todayKey={todayKey}
        weekLabel={weekLabel}
        openWorkoutForDay={openWorkoutForDay}
        openWorkoutForEdit={openWorkoutForEdit}
      />
      <MedicalSection />
    </div>
  );
}
