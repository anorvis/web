"use client";

import {
  keepPreviousData,
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { searchFood } from "@/features/health/api/health";
import {
  deleteRecipeById,
  importRecipeFromUrl,
  saveRecipe,
  searchExternalRecipes,
  setRecipeFavorite,
} from "@/features/health/api/recipes";
import type {
  ExternalRecipeResult,
  NativeRecipe,
  NativeRecipeInput,
} from "@/features/health/types/native-health";
import type { FoodSearchResult } from "@/features/health/utils/forms";
import { queryKeys } from "@/lib/query/keys";

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;
function waitForSearch(signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(signal.reason);
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const onAbort = () => {
    window.clearTimeout(timeout);
    reject(signal.reason);
  };
  const timeout = window.setTimeout(() => {
    signal.removeEventListener("abort", onAbort);
    resolve();
  }, SEARCH_DEBOUNCE_MS);
  signal.addEventListener("abort", onAbort, { once: true });
  return promise;
}

export interface RecipeSearchState {
  /** The active (debounced, trimmed) query the results correspond to. */
  query: string;
  results: ExternalRecipeResult[];
  isFetching: boolean;
  isError: boolean;
  /** True once the query has >= 2 trimmed chars, i.e. a search is active. */
  hasQuery: boolean;
  refetch: () => void;
}

export interface FoodSearchState {
  query: string;
  results: FoodSearchResult[];
  isFetching: boolean;
  isError: boolean;
  hasQuery: boolean;
  refetch: () => void;
}

export interface RecipeMutations {
  save: UseMutationResult<
    NativeRecipe,
    Error,
    NativeRecipeInput & { id?: string }
  >;
  favorite: UseMutationResult<
    NativeRecipe,
    Error,
    { id: string; isFavorite: boolean }
  >;
  remove: UseMutationResult<unknown, Error, string>;
  importFromUrl: UseMutationResult<NativeRecipe, Error, string>;
}

/**
 * Debounced TheMealDB recipe search backed by React Query. The current query
 * waits 300ms before making a request; consuming the query signal cancels that
 * wait when another key supersedes it. Previous results remain visible while
 * the latest request settles, without stale results overwriting the new key.
 */
export function useRecipeSearch(rawQuery: string): RecipeSearchState {
  const query = rawQuery.trim();
  const hasQuery = query.length >= MIN_QUERY_LENGTH;
  const search = useQuery({
    queryKey: queryKeys.health.recipeSearch(query),
    queryFn: async ({ signal }) => {
      await waitForSearch(signal);
      return searchExternalRecipes(query);
    },
    enabled: hasQuery,
    placeholderData: keepPreviousData,
  });
  return {
    query,
    results: hasQuery ? (search.data?.results ?? []) : [],
    isFetching: hasQuery && search.isFetching,
    isError: hasQuery && search.isError,
    hasQuery,
    refetch: () => {
      void search.refetch();
    },
  };
}

/**
 * Debounced food search over a provider, backed by React Query. The provider
 * remains part of the key so switching databases cancels the pending delay and
 * starts a distinct request rather than allowing stale results to race in.
 */
export function useFoodSearch(
  provider: string,
  rawQuery: string,
): FoodSearchState {
  const query = rawQuery.trim();
  const hasQuery = query.length >= MIN_QUERY_LENGTH;
  const search = useQuery({
    queryKey: queryKeys.health.foodSearch(provider, query),
    queryFn: async ({ signal }) => {
      await waitForSearch(signal);
      return searchFood(query, provider);
    },
    enabled: hasQuery,
    placeholderData: keepPreviousData,
  });
  return {
    query,
    results: hasQuery ? (search.data?.results ?? []) : [],
    isFetching: hasQuery && search.isFetching,
    isError: hasQuery && search.isError,
    hasQuery,
    refetch: () => {
      void search.refetch();
    },
  };
}

/**
 * Owns every recipe write path — save, favourite toggle, delete, and URL
 * import — each invalidating the recipes list on success so the cache resyncs.
 */
export function useRecipeMutations(): RecipeMutations {
  const queryClient = useQueryClient();
  const invalidateRecipes = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.health.recipes() });

  const save = useMutation({
    mutationFn: saveRecipe,
    onSuccess: () => {
      void invalidateRecipes();
    },
  });
  const favorite = useMutation({
    mutationFn: ({ id, isFavorite }: { id: string; isFavorite: boolean }) =>
      setRecipeFavorite(id, isFavorite),
    onSuccess: () => {
      void invalidateRecipes();
    },
  });
  const remove = useMutation({
    mutationFn: deleteRecipeById,
    onSuccess: () => {
      void invalidateRecipes();
    },
  });
  const importFromUrl = useMutation({
    mutationFn: importRecipeFromUrl,
    onSuccess: () => {
      void invalidateRecipes();
    },
  });

  return { save, favorite, remove, importFromUrl };
}
