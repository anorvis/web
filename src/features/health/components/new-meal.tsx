"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useState } from "react";
import {
  EmptyState,
  HealthTabs,
  healthTabPanelProps,
  MealForm,
} from "@/features/health/components/health-dashboard-panels";
import { useFoodSearch } from "@/features/health/hooks/use-recipes";
import type { FoodSearchResult } from "@/features/health/utils/forms";

type MealTab = "food" | "recipe" | "manual";

const TABS: { id: MealTab; label: string }[] = [
  { id: "food", label: "search food" },
  { id: "recipe", label: "search recipes" },
  { id: "manual", label: "manual" },
];

const PANEL_LABEL = "meal entry";

const searchInputClass =
  "h-8 flex-1 rounded-none border border-border bg-transparent px-3 text-[0.65rem] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none";
const selectClass =
  "h-8 rounded-none border border-border bg-transparent px-2 text-[0.65rem] text-foreground focus:border-foreground focus:outline-none";

type MealPrefill = {
  name: string;
  calories: string;
  proteinGrams: string;
  carbsGrams: string;
  fatGrams: string;
  notes: string;
};

/**
 * The meals modal "new" surface: three tabs to log a meal by food search,
 * saved-recipe search (provider "recipe", stored macros), or manual macros.
 * Search food/recipes both flow through the debounced `useFoodSearch`; a
 * result can be logged directly (stored macros) or adopted into the manual
 * form for tweaking. TheMealDB is intentionally absent — it lives only in the
 * recipes modal.
 */
export function NewMealPanel({
  onBack,
  onLogFood,
  onSubmitMeal,
  isLogging,
  logStatus,
}: {
  onBack: () => void;
  onLogFood: (result: FoodSearchResult) => void;
  onSubmitMeal: (formData: FormData) => void;
  isLogging: boolean;
  logStatus: string | null;
}) {
  const [tab, setTab] = useState<MealTab>("food");
  const [foodQuery, setFoodQuery] = useState("");
  const [provider, setProvider] = useState("all");
  const [recipeQuery, setRecipeQuery] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [prefill, setPrefill] = useState<MealPrefill | null>(null);
  const [prefillNonce, setPrefillNonce] = useState(0);

  const isRecipeTab = tab === "recipe";
  const activeProvider = isRecipeTab ? "recipe" : provider;
  const activeQuery = isRecipeTab
    ? recipeQuery
    : tab === "food"
      ? foodQuery
      : "";
  const search = useFoodSearch(activeProvider, activeQuery);

  const adoptResult = (result: FoodSearchResult) => {
    setPrefill({
      name: result.name,
      calories: String(result.calories),
      proteinGrams: String(result.proteinGrams),
      carbsGrams: String(result.carbsGrams),
      fatGrams: String(result.fatGrams),
      notes: `${result.provider}:${result.id}`,
    });
    setPrefillNonce((current) => current + 1);
    setTab("manual");
  };

  return (
    <div className="space-y-3 border border-border p-3">
      <div className="flex items-start justify-between gap-3">
        <HealthTabs
          label={PANEL_LABEL}
          tabs={TABS}
          active={tab}
          onSelect={(id) => setTab(id as MealTab)}
        />
        <button
          type="button"
          className={workspacePageStyles.modalButton}
          onClick={onBack}
        >
          back to meals
        </button>
      </div>

      {tab === "manual" ? (
        <div {...healthTabPanelProps(PANEL_LABEL, tab)}>
          <MealForm
            key={`manual-${prefillNonce}`}
            photoName={photoName}
            mealStatus={logStatus}
            isSaving={isLogging}
            onPhotoName={setPhotoName}
            onSubmit={onSubmitMeal}
            defaultValues={prefill ?? undefined}
          />
        </div>
      ) : (
        <div className="space-y-3" {...healthTabPanelProps(PANEL_LABEL, tab)}>
          <div className="flex flex-wrap gap-2">
            {tab === "food" ? (
              <select
                className={selectClass}
                value={provider}
                onChange={(event) => setProvider(event.target.value)}
              >
                <option value="all">all databases</option>
                <option value="recipe">saved recipes</option>
                <option value="openfoodfacts">Open Food Facts</option>
              </select>
            ) : null}
            <input
              className={searchInputClass}
              placeholder={isRecipeTab ? "search saved recipes" : "search food"}
              value={isRecipeTab ? recipeQuery : foodQuery}
              onChange={(event) => {
                const value = event.target.value;
                if (isRecipeTab) setRecipeQuery(value);
                else setFoodQuery(value);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                search.refetch();
              }}
            />
            <button
              type="button"
              className={workspacePageStyles.inlineSubmit}
              onClick={() => search.refetch()}
              disabled={search.isFetching || !activeQuery.trim()}
            >
              search
            </button>
          </div>

          {search.isFetching ? (
            <p className={workspacePageStyles.cardBodyText}>
              {isRecipeTab
                ? "searching saved recipes…"
                : "searching food databases…"}
            </p>
          ) : search.isError ? (
            <EmptyState
              title="Search failed."
              body="That source could not be reached."
              action={
                <button
                  type="button"
                  className={workspacePageStyles.modalButton}
                  onClick={() => search.refetch()}
                >
                  retry
                </button>
              }
            />
          ) : search.results.length > 0 ? (
            <div className={workspacePageStyles.list} aria-live="polite">
              {search.results.map((result) => (
                <div
                  key={`${result.provider}-${result.id}`}
                  className={workspacePageStyles.listRow}
                >
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => adoptResult(result)}
                  >
                    <p className={workspacePageStyles.listLabel}>
                      {result.name}
                    </p>
                    <p className={workspacePageStyles.listValue}>
                      {result.provider} · {result.calories} kcal · P
                      {result.proteinGrams}/C{result.carbsGrams}/F
                      {result.fatGrams}
                    </p>
                  </button>
                  <button
                    type="button"
                    className={workspacePageStyles.modalButton}
                    onClick={() => onLogFood(result)}
                    disabled={isLogging}
                  >
                    log
                  </button>
                </div>
              ))}
            </div>
          ) : search.hasQuery ? (
            <EmptyState
              title={`No ${isRecipeTab ? "recipes" : "foods"} found for “${search.query}”.`}
              body={
                isRecipeTab
                  ? "Save recipes in the recipe book, then log them here."
                  : "Try a different food or provider."
              }
            />
          ) : null}

          {logStatus ? (
            <p className={workspacePageStyles.cardBodyText} aria-live="polite">
              {logStatus}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
