"use client";

import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useState } from "react";
import { fetchRecipes } from "@/features/health/api/recipes";
import {
  EmptyState,
  HealthDialog,
  HealthTabs,
  healthTabPanelProps,
} from "@/features/health/components/health-dashboard-panels";
import {
  externalRecipeToInput,
  FavoriteStar,
  metaLine,
  RecipeDetailView,
} from "@/features/health/components/recipe-detail";
import {
  RecipeCreateForm,
  RecipeImportForm,
} from "@/features/health/components/recipe-editor";
import {
  useRecipeMutations,
  useRecipeSearch,
} from "@/features/health/hooks/use-recipes";
import type {
  ExternalRecipeResult,
  NativeRecipe,
  NativeRecipeInput,
} from "@/features/health/types/native-health";
import { usePersistedQuery } from "@/hooks/use-persisted-query";
import { queryKeys } from "@/lib/query/keys";

type RecipeTab = "favourites" | "search" | "create" | "import";
type RecipeView =
  | "tabs"
  | { external: ExternalRecipeResult }
  | { saved: NativeRecipe };

const TABS: { id: RecipeTab; label: string }[] = [
  { id: "favourites", label: "favourites" },
  { id: "search", label: "search" },
  { id: "create", label: "create" },
  { id: "import", label: "import" },
];
const PANEL_LABEL = "recipe book";
const searchInputClass =
  "h-8 w-full rounded-none border border-border bg-transparent px-3 text-[0.65rem] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none";

function mutationError(error: Error | null, fallback: string): string | null {
  return error ? fallback : null;
}

function importError(error: Error | null): string | null {
  if (!error) return null;
  const status = "status" in error ? Number(error.status) : null;
  if (status === 400)
    return "that URL can't be imported — use a public http(s) page";
  if (status === 422) return "no recipe found on that page";
  return "couldn't reach that page — try again";
}

function SavedRecipeRows({
  recipes,
  pendingId,
  onOpen,
  onToggle,
}: {
  recipes: NativeRecipe[];
  pendingId: string | null;
  onOpen: (recipe: NativeRecipe) => void;
  onToggle: (recipe: NativeRecipe) => void;
}) {
  return (
    <div className={workspacePageStyles.list}>
      {recipes.map((recipe) => (
        <div key={recipe.id} className={`${workspacePageStyles.listRow} gap-2`}>
          <FavoriteStar
            compact
            active={recipe.isFavorite}
            pending={pendingId === recipe.id}
            title={recipe.title}
            onToggle={() => onToggle(recipe)}
          />
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpen(recipe)}
          >
            <span className={workspacePageStyles.listLabel}>
              {recipe.title}
            </span>
            <span className={workspacePageStyles.listValue}>
              {[recipe.source, metaLine(recipe.category, recipe.area)]
                .filter(Boolean)
                .join(" · ")}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}

export function RecipesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [tab, setTab] = useState<RecipeTab>("favourites");
  const [view, setView] = useState<RecipeView>("tabs");
  const [searchText, setSearchText] = useState("");
  const recipesQuery = usePersistedQuery({
    queryKey: queryKeys.health.recipes(),
    queryFn: fetchRecipes,
  });
  const search = useRecipeSearch(searchText);
  const mutations = useRecipeMutations();
  const recipes = recipesQuery.hydratedData?.recipes ?? [];
  const favourites = recipes.filter((recipe) => recipe.isFavorite);
  const others = recipes.filter((recipe) => !recipe.isFavorite);
  const pendingFavoriteId = mutations.favorite.isPending
    ? (mutations.favorite.variables?.id ?? null)
    : null;

  const openSaved = (recipe: NativeRecipe) => setView({ saved: recipe });
  const toggleSaved = (recipe: NativeRecipe) => {
    mutations.favorite.mutate(
      { id: recipe.id, isFavorite: !recipe.isFavorite },
      {
        onSuccess: (updated) => {
          if (typeof view === "object" && "saved" in view) {
            setView({ saved: updated });
          }
        },
      },
    );
  };

  const detail = (() => {
    if (typeof view !== "object") return null;
    if ("external" in view) {
      const result = view.external;
      return (
        <RecipeDetailView
          title={result.title}
          meta={metaLine(result.category, result.area)}
          imageUrl={result.imageUrl}
          ingredients={result.ingredients}
          instructions={result.instructions}
          sourceUrl={result.sourceUrl}
          youtubeUrl={result.youtubeUrl}
          onBack={() => setView("tabs")}
          favorite={{
            active: false,
            pending: mutations.save.isPending,
            onToggle: () =>
              mutations.save.mutate(
                { ...externalRecipeToInput(result), isFavorite: true },
                { onSuccess: (saved) => setView({ saved }) },
              ),
          }}
          error={mutationError(mutations.save.error, "could not save recipe")}
        />
      );
    }
    const recipe = view.saved;
    return (
      <RecipeDetailView
        title={recipe.title}
        meta={metaLine(recipe.category, recipe.area)}
        imageUrl={recipe.imageUrl}
        macros={recipe}
        ingredients={recipe.ingredients}
        instructions={recipe.instructions}
        sourceUrl={recipe.sourceUrl}
        youtubeUrl={recipe.youtubeUrl}
        onBack={() => setView("tabs")}
        favorite={{
          active: recipe.isFavorite,
          pending: mutations.favorite.isPending,
          onToggle: () => toggleSaved(recipe),
        }}
        error={
          mutations.favorite.isError || mutations.remove.isError
            ? "recipe update failed — the book was refreshed"
            : null
        }
        actions={
          <button
            type="button"
            className={workspacePageStyles.modalDangerButton}
            disabled={mutations.remove.isPending}
            onClick={() =>
              mutations.remove.mutate(recipe.id, {
                onSuccess: () => setView("tabs"),
              })
            }
          >
            {mutations.remove.isPending ? "deleting…" : "delete recipe"}
          </button>
        }
      />
    );
  })();

  return (
    <HealthDialog
      open={open}
      onOpenChange={onOpenChange}
      title="recipe book"
      description="Favourites, live recipe search, manual recipes, and URL import."
    >
      {detail ?? (
        <div className="flex min-h-full flex-col gap-4">
          <HealthTabs
            label={PANEL_LABEL}
            tabs={TABS}
            active={tab}
            onSelect={(id) => setTab(id as RecipeTab)}
          />

          <div
            className="min-h-0 flex-1"
            {...healthTabPanelProps(PANEL_LABEL, tab)}
          >
            {tab === "favourites" ? (
              recipesQuery.hydrationLoading ? (
                <Skeleton className="h-24 rounded-none" />
              ) : recipesQuery.isError ? (
                <EmptyState
                  title="Saved recipes could not be loaded."
                  body="Check that anorvis-os is current, then retry."
                  action={
                    <button
                      type="button"
                      className={workspacePageStyles.modalButton}
                      onClick={() => void recipesQuery.refetch()}
                    >
                      retry
                    </button>
                  }
                />
              ) : recipes.length === 0 ? (
                <EmptyState
                  title="No recipes saved yet."
                  body="Search TheMealDB, create one, or import from a URL."
                />
              ) : (
                <div className="space-y-4">
                  {favourites.length > 0 ? (
                    <section className="space-y-2">
                      <p className={workspacePageStyles.cardLabel}>
                        favourites
                      </p>
                      <SavedRecipeRows
                        recipes={favourites}
                        pendingId={pendingFavoriteId}
                        onOpen={openSaved}
                        onToggle={toggleSaved}
                      />
                    </section>
                  ) : (
                    <EmptyState
                      title="No favourites yet."
                      body="Use the star beside a recipe name to keep it here."
                    />
                  )}
                  {others.length > 0 ? (
                    <section className="space-y-2">
                      <p className={workspacePageStyles.cardLabel}>
                        other saved
                      </p>
                      <SavedRecipeRows
                        recipes={others}
                        pendingId={pendingFavoriteId}
                        onOpen={openSaved}
                        onToggle={toggleSaved}
                      />
                    </section>
                  ) : null}
                </div>
              )
            ) : tab === "search" ? (
              <div className="space-y-3">
                <input
                  className={searchInputClass}
                  placeholder="search TheMealDB"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  autoFocus
                />
                {search.isFetching ? (
                  <p
                    className={workspacePageStyles.cardBodyText}
                    aria-live="polite"
                  >
                    searching TheMealDB…
                  </p>
                ) : null}
                {search.isError ? (
                  <EmptyState
                    title="Recipe search failed."
                    body="TheMealDB could not be reached."
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
                    {search.results.map((result) => {
                      const saved = recipes.find(
                        (recipe) =>
                          recipe.source === "themealdb" &&
                          recipe.sourceId === result.id,
                      );
                      return (
                        <button
                          key={result.id}
                          type="button"
                          className={`${workspacePageStyles.listRow} w-full text-left`}
                          onClick={() =>
                            setView(saved ? { saved } : { external: result })
                          }
                        >
                          <span className={workspacePageStyles.listLabel}>
                            {saved?.isFavorite ? "★ " : ""}
                            {result.title}
                          </span>
                          <span className={workspacePageStyles.listValue}>
                            {metaLine(result.category, result.area) || "recipe"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : search.hasQuery && !search.isFetching ? (
                  <EmptyState
                    title={`No recipes found for “${search.query}”.`}
                    body="Try a different dish or ingredient."
                  />
                ) : (
                  <p className={workspacePageStyles.cardBodyText}>
                    Type at least two characters. Results update after a short
                    pause.
                  </p>
                )}
                <p className={workspacePageStyles.cardBodyText}>
                  recipe data from TheMealDB (themealdb.com)
                </p>
              </div>
            ) : tab === "create" ? (
              <RecipeCreateForm
                isPending={mutations.save.isPending}
                error={mutationError(
                  mutations.save.error,
                  "could not save recipe",
                )}
                onSave={(input: NativeRecipeInput) =>
                  mutations.save.mutate(input, {
                    onSuccess: (saved) => setView({ saved }),
                  })
                }
              />
            ) : (
              <RecipeImportForm
                isPending={mutations.importFromUrl.isPending}
                error={importError(mutations.importFromUrl.error)}
                onImport={(url) =>
                  mutations.importFromUrl.mutate(url, {
                    onSuccess: (saved) => setView({ saved }),
                  })
                }
              />
            )}
          </div>
        </div>
      )}
    </HealthDialog>
  );
}
