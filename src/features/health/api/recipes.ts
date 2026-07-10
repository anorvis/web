import type {
  ExternalRecipeResult,
  NativeRecipe,
  NativeRecipeInput,
} from "@/features/health/types/native-health";
import { deleteJson, postJson, requestJson } from "@/lib/effect/http";
import { runEffect } from "@/lib/effect/runtime";

export function fetchRecipes(): Promise<{ recipes: NativeRecipe[] }> {
  return runEffect(
    requestJson<{ recipes: NativeRecipe[] }>("/api/health/recipes"),
  );
}

export function saveRecipe(
  input: NativeRecipeInput & { id?: string },
): Promise<NativeRecipe> {
  return runEffect(postJson<NativeRecipe>("/api/health/recipes", input));
}

export function deleteRecipeById(id: string): Promise<unknown> {
  return runEffect(deleteJson<unknown>("/api/health/recipes", { id }));
}

export function setRecipeFavorite(
  id: string,
  isFavorite: boolean,
): Promise<NativeRecipe> {
  return runEffect(
    postJson<NativeRecipe>("/api/health/recipes/favorite", { id, isFavorite }),
  );
}

export function importRecipeFromUrl(url: string): Promise<NativeRecipe> {
  return runEffect(
    postJson<NativeRecipe>("/api/health/recipes/import", { url }),
  );
}

export function searchExternalRecipes(
  query: string,
): Promise<{ query: string; results: ExternalRecipeResult[] }> {
  return runEffect(
    requestJson<{ query: string; results: ExternalRecipeResult[] }>(
      `/api/health/recipe-search?q=${encodeURIComponent(query)}`,
    ),
  );
}
