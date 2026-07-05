import { create } from "zustand";
import { defaultOpenSections } from "@/features/health/config";

export type UnitSystem = "metric" | "imperial";

const unitStorageKey = "anorvis.health.units";

function readUnitSystem(): UnitSystem {
  if (typeof window === "undefined") return "metric";
  return window.localStorage.getItem(unitStorageKey) === "imperial"
    ? "imperial"
    : "metric";
}

type HealthStore = {
  unitSystem: UnitSystem;
  quizOpen: boolean;
  quizStep: number;
  mealOpen: boolean;
  mealMode: "search" | "manual";
  mealSearchPage: number;
  saveAsRecipe: boolean;
  workoutOpen: boolean;
  exerciseSearchPage: number;
  saveAsWorkoutTemplate: boolean;
  workoutExercisePage: number;
  weekOffset: number;
  openSections: { diet: boolean; fitness: boolean; medical: boolean };
  hydrateUnitSystem: () => void;
  setUnitSystem: (unitSystem: UnitSystem) => void;
  setQuizOpen: (quizOpen: boolean) => void;
  setQuizStep: (quizStep: number | ((current: number) => number)) => void;
  setMealOpen: (mealOpen: boolean) => void;
  setMealMode: (mealMode: "search" | "manual") => void;
  setMealSearchPage: (
    mealSearchPage: number | ((current: number) => number),
  ) => void;
  setSaveAsRecipe: (saveAsRecipe: boolean) => void;
  setWorkoutOpen: (workoutOpen: boolean) => void;
  setExerciseSearchPage: (
    exerciseSearchPage: number | ((current: number) => number),
  ) => void;
  setSaveAsWorkoutTemplate: (saveAsWorkoutTemplate: boolean) => void;
  setWorkoutExercisePage: (
    workoutExercisePage: number | ((current: number) => number),
  ) => void;
  setWeekOffset: (weekOffset: number | ((current: number) => number)) => void;
  toggleSection: (section: "diet" | "fitness" | "medical") => void;
};

export const useHealthStore = create<HealthStore>((set) => ({
  unitSystem: "metric",
  quizOpen: false,
  quizStep: 0,
  mealOpen: false,
  mealMode: "search",
  mealSearchPage: 0,
  saveAsRecipe: false,
  workoutOpen: false,
  exerciseSearchPage: 0,
  saveAsWorkoutTemplate: false,
  workoutExercisePage: 0,
  weekOffset: 0,
  openSections: defaultOpenSections,
  hydrateUnitSystem: () => set({ unitSystem: readUnitSystem() }),
  setUnitSystem: (unitSystem) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(unitStorageKey, unitSystem);
    }
    set({ unitSystem });
  },
  setQuizOpen: (quizOpen) => set({ quizOpen }),
  setQuizStep: (quizStep) =>
    set((state) => ({
      quizStep:
        typeof quizStep === "function" ? quizStep(state.quizStep) : quizStep,
    })),
  setMealOpen: (mealOpen) => set({ mealOpen }),
  setMealMode: (mealMode) => set({ mealMode }),
  setMealSearchPage: (mealSearchPage) =>
    set((state) => ({
      mealSearchPage:
        typeof mealSearchPage === "function"
          ? mealSearchPage(state.mealSearchPage)
          : mealSearchPage,
    })),
  setSaveAsRecipe: (saveAsRecipe) => set({ saveAsRecipe }),
  setWorkoutOpen: (workoutOpen) => set({ workoutOpen }),
  setExerciseSearchPage: (exerciseSearchPage) =>
    set((state) => ({
      exerciseSearchPage:
        typeof exerciseSearchPage === "function"
          ? exerciseSearchPage(state.exerciseSearchPage)
          : exerciseSearchPage,
    })),
  setSaveAsWorkoutTemplate: (saveAsWorkoutTemplate) =>
    set({ saveAsWorkoutTemplate }),
  setWorkoutExercisePage: (workoutExercisePage) =>
    set((state) => ({
      workoutExercisePage:
        typeof workoutExercisePage === "function"
          ? workoutExercisePage(state.workoutExercisePage)
          : workoutExercisePage,
    })),
  setWeekOffset: (weekOffset) =>
    set((state) => ({
      weekOffset:
        typeof weekOffset === "function"
          ? weekOffset(state.weekOffset)
          : weekOffset,
    })),
  toggleSection: (section) =>
    set((state) => ({
      openSections: {
        ...(state.openSections ?? defaultOpenSections),
        [section]: !(state.openSections ?? defaultOpenSections)[section],
      },
    })),
}));
