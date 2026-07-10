import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@anorvis/ui/dialog";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ChangeEvent } from "react";
import {
  WorkspaceDialog,
  workspaceModalFooterClass,
} from "@/components/layout/workspace-dialog";
import { useHealthActions } from "@/features/health/components/actions";
import { useHealthStore } from "@/features/health/stores/health-store";
import type {
  FoodSearchResult,
  initialMeal,
} from "@/features/health/utils/forms";

function CollapseIcon({ open }: { open: boolean }) {
  const Icon = open ? ChevronUp : ChevronDown;
  return <Icon className="size-4 shrink-0 text-muted-foreground" />;
}

type Meal = typeof initialMeal;

export type MealDialogActions = {
  meal: Meal;
  search: string;
  setSearch: (value: string) => void;
  loading: boolean;
  provider: string;
  setProvider: (value: string) => void;
  pageCount: number;
  results: FoodSearchResult[];
  visibleResults: FoodSearchResult[];
  selectedKey: string;
  isPending: boolean;
  inputClass: string;
  textareaClass: string;
  setMealValue: (
    field: keyof Meal,
  ) => (
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
  ) => void;
  onClearSearch: () => void;
  searchMeals: () => Promise<void>;
  selectResult: (result: FoodSearchResult) => void;
  onSaveRecipe: () => void;
  onSubmit: (formData: FormData) => void;
  onDelete: () => void;
};

export function MealDialog() {
  const props = useHealthActions<{ meal: MealDialogActions }>().meal;
  const {
    mealOpen,
    mealMode,
    mealSearchPage,
    saveAsRecipe,
    setMealOpen,
    setMealMode,
    setMealSearchPage,
    setSaveAsRecipe,
  } = useHealthStore();

  return (
    <WorkspaceDialog
      open={mealOpen}
      onOpenChange={(open) => {
        setMealOpen(open);
      }}
    >
      <DialogHeader>
        <DialogTitle className={workspacePageStyles.cardTitle}>
          log meal
        </DialogTitle>
        <DialogDescription className={workspacePageStyles.cardBodyText}>
          search known foods or enter macros manually.
        </DialogDescription>
      </DialogHeader>
      <form
        action={(formData) => {
          props.onSaveRecipe();
          props.onSubmit(formData);
        }}
        className="space-y-4"
      >
        {Object.entries(props.meal).map(([key, value]) => (
          <input key={key} type="hidden" name={key} value={value} />
        ))}
        <section className={workspacePageStyles.collapsibleSection}>
          <button
            type="button"
            onClick={() => setMealMode("search")}
            className={`${workspacePageStyles.cardLabel} ${workspacePageStyles.rowButton}`}
          >
            search food database
            <CollapseIcon open={mealMode === "search"} />
          </button>
          {mealMode === "search" && (
            <div className={workspacePageStyles.collapsibleContent}>
              <label className={workspacePageStyles.formLabel}>
                <span className={workspacePageStyles.metricLabel}>
                  database
                </span>
                <select
                  className={props.inputClass}
                  value={props.provider}
                  onChange={(event) => {
                    props.setProvider(event.target.value);
                    setMealSearchPage(0);
                  }}
                >
                  <option value="all">all databases</option>
                  <option value="recipe">saved recipes</option>
                  <option value="openfoodfacts">Open Food Facts</option>
                </select>
              </label>
              <div className="flex gap-2">
                <input
                  className={props.inputClass}
                  placeholder="search food"
                  value={props.search}
                  onChange={(event) => {
                    const value = event.target.value;
                    props.setSearch(value);
                    setMealSearchPage(0);
                    if (!value.trim()) {
                      props.onClearSearch();
                      return;
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    void props.searchMeals();
                  }}
                />
                <button
                  type="button"
                  onClick={() => props.searchMeals()}
                  disabled={props.loading || !props.search.trim()}
                  className={workspacePageStyles.inlineSubmit}
                >
                  search
                </button>
              </div>
              {props.loading ? (
                <p className={workspacePageStyles.cardBodyText}>
                  searching food databases...
                </p>
              ) : null}
              {props.results.length > 0 && (
                <div className={workspacePageStyles.list}>
                  {props.visibleResults.map((result) => (
                    <button
                      key={`${result.provider}-${result.id}`}
                      type="button"
                      onClick={() => props.selectResult(result)}
                      className={`${workspacePageStyles.listRow} w-full text-left ${
                        props.selectedKey === `${result.provider}:${result.id}`
                          ? "border-foreground text-foreground"
                          : ""
                      }`}
                    >
                      <span className={workspacePageStyles.listLabel}>
                        {result.name}
                      </span>
                      <span className={workspacePageStyles.listValue}>
                        {result.provider} · {result.calories} kcal · P
                        {result.proteinGrams}/C{result.carbsGrams}/F
                        {result.fatGrams}
                      </span>
                      {props.selectedKey ===
                      `${result.provider}:${result.id}` ? (
                        <span className={workspacePageStyles.cardBodyText}>
                          selected for logging
                        </span>
                      ) : null}
                    </button>
                  ))}
                  {props.pageCount > 1 ? (
                    <div className={workspacePageStyles.splitRow}>
                      <button
                        type="button"
                        onClick={() =>
                          setMealSearchPage((page) => Math.max(0, page - 1))
                        }
                        className={workspacePageStyles.inlineSubmit}
                        disabled={mealSearchPage === 0}
                      >
                        prev
                      </button>
                      <span className={workspacePageStyles.cardBodyText}>
                        {mealSearchPage + 1} / {props.pageCount}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setMealSearchPage((page) =>
                            Math.min(props.pageCount - 1, page + 1),
                          )
                        }
                        className={workspacePageStyles.inlineSubmit}
                        disabled={mealSearchPage >= props.pageCount - 1}
                      >
                        next
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {props.meal.name && props.meal.notes ? (
                <div className={workspacePageStyles.selectedPanel}>
                  <p className={workspacePageStyles.cardLabel}>selected food</p>
                  <p className={workspacePageStyles.cardBodyText}>
                    {props.meal.name} · {props.meal.calories} kcal · P
                    {props.meal.proteinGrams}
                    /C{props.meal.carbsGrams}/F{props.meal.fatGrams}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </section>
        <section className={workspacePageStyles.collapsibleSection}>
          <button
            type="button"
            onClick={() => setMealMode("manual")}
            className={`${workspacePageStyles.cardLabel} ${workspacePageStyles.rowButton}`}
          >
            manual entry
            <CollapseIcon open={mealMode === "manual"} />
          </button>
          {mealMode === "manual" && (
            <div className={workspacePageStyles.collapsibleContent}>
              <label className={workspacePageStyles.formLabel}>
                <span className={workspacePageStyles.metricLabel}>
                  meal name
                </span>
                <input
                  className={props.inputClass}
                  placeholder="meal name"
                  value={props.meal.name}
                  onChange={props.setMealValue("name")}
                />
              </label>
              <label className={workspacePageStyles.formLabel}>
                <span className={workspacePageStyles.metricLabel}>
                  meal type
                </span>
                <select
                  className={props.inputClass}
                  value={props.meal.mealType}
                  onChange={props.setMealValue("mealType")}
                >
                  <option value="breakfast">breakfast</option>
                  <option value="lunch">lunch</option>
                  <option value="dinner">dinner</option>
                  <option value="snack">snack</option>
                  <option value="meal">meal</option>
                </select>
              </label>
              <div className={workspacePageStyles.twoColumnGrid}>
                <label className={workspacePageStyles.formLabel}>
                  <span className={workspacePageStyles.metricLabel}>
                    calories
                  </span>
                  <input
                    className={props.inputClass}
                    placeholder="kcal"
                    inputMode="numeric"
                    value={props.meal.calories}
                    onChange={props.setMealValue("calories")}
                  />
                </label>
                <label className={workspacePageStyles.formLabel}>
                  <span className={workspacePageStyles.metricLabel}>
                    protein
                  </span>
                  <input
                    className={props.inputClass}
                    placeholder="protein grams"
                    inputMode="decimal"
                    value={props.meal.proteinGrams}
                    onChange={props.setMealValue("proteinGrams")}
                  />
                </label>
                <label className={workspacePageStyles.formLabel}>
                  <span className={workspacePageStyles.metricLabel}>carbs</span>
                  <input
                    className={props.inputClass}
                    placeholder="carbs grams"
                    inputMode="decimal"
                    value={props.meal.carbsGrams}
                    onChange={props.setMealValue("carbsGrams")}
                  />
                </label>
                <label className={workspacePageStyles.formLabel}>
                  <span className={workspacePageStyles.metricLabel}>fat</span>
                  <input
                    className={props.inputClass}
                    placeholder="fat grams"
                    inputMode="decimal"
                    value={props.meal.fatGrams}
                    onChange={props.setMealValue("fatGrams")}
                  />
                </label>
              </div>
              <label className={workspacePageStyles.formLabel}>
                <span className={workspacePageStyles.metricLabel}>notes</span>
                <textarea
                  className={props.textareaClass}
                  placeholder="notes"
                  value={props.meal.notes}
                  onChange={props.setMealValue("notes")}
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={saveAsRecipe}
                  onChange={(event) => setSaveAsRecipe(event.target.checked)}
                />
                <span className={workspacePageStyles.cardBodyText}>
                  save this manual entry as a recipe
                </span>
              </label>
            </div>
          )}
        </section>
        <DialogFooter className={workspaceModalFooterClass}>
          <button
            type="button"
            onClick={props.onDelete}
            disabled={!props.meal.id || props.isPending}
            className={workspacePageStyles.outlineButton}
          >
            remove meal
          </button>
          <button
            type="button"
            onClick={() => setMealOpen(false)}
            className={workspacePageStyles.outlineButton}
          >
            cancel
          </button>
          <button
            disabled={props.isPending}
            type="submit"
            className={workspacePageStyles.outlineButton}
          >
            save meal
          </button>
        </DialogFooter>
      </form>
    </WorkspaceDialog>
  );
}
