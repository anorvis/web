import type {
  ExternalRecipeResult,
  NativeRecipe,
  NativeRecipeInput,
} from "@/features/health/types/native-health";
import { convexClient } from "@/lib/convex-client";
import { convexApi } from "@/lib/convex-functions";

type ConvexRecord = Record<string, unknown>;

function stringId(value: ConvexRecord): string {
  return String(value._id ?? value.id ?? "");
}

function isoFromMillis(value: unknown): string {
  const millis =
    typeof value === "number" && Number.isFinite(value) ? value : Date.now();
  return new Date(millis).toISOString();
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function records(value: unknown): ConvexRecord[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is ConvexRecord =>
          typeof item === "object" && item !== null && !Array.isArray(item),
      )
    : [];
}

function mapRecipe(recipe: ConvexRecord): NativeRecipe {
  return {
    id: stringId(recipe),
    title: String(recipe.title ?? "Recipe"),
    source: String(recipe.source ?? "manual"),
    sourceId: optionalString(recipe.sourceId),
    sourceUrl: optionalString(recipe.sourceUrl),
    imageUrl: optionalString(recipe.imageUrl),
    youtubeUrl: optionalString(recipe.youtubeUrl),
    category: optionalString(recipe.category),
    area: optionalString(recipe.area),
    calories: optionalNumber(recipe.calories),
    proteinGrams: optionalNumber(recipe.proteinGrams),
    carbsGrams: optionalNumber(recipe.carbsGrams),
    fatGrams: optionalNumber(recipe.fatGrams),
    isFavorite: Boolean(recipe.favorite ?? recipe.isFavorite),
    notes: optionalString(recipe.notes),
    ingredients: records(recipe.ingredients).map((ingredient) => ({
      id: stringId(ingredient),
      name: String(ingredient.name ?? ""),
      quantity: optionalString(ingredient.quantity),
    })),
    instructions: Array.isArray(recipe.instructions)
      ? recipe.instructions.map((instruction) =>
          typeof instruction === "string"
            ? instruction
            : String((instruction as ConvexRecord).text ?? ""),
        )
      : [],
    createdAt: isoFromMillis(recipe.createdAt),
    updatedAt: isoFromMillis(recipe.updatedAt),
  };
}

function saveInput(input: NativeRecipeInput & { id?: string }) {
  return {
    id: input.id || undefined,
    title: input.title,
    source: input.source as
      | "manual"
      | "agent"
      | "import"
      | "google"
      | "hevy"
      | "snaptrade"
      | "csv"
      | "url"
      | "themealdb",
    sourceId: input.sourceId ?? undefined,
    sourceUrl: input.sourceUrl ?? undefined,
    imageUrl: input.imageUrl ?? undefined,
    youtubeUrl: input.youtubeUrl ?? undefined,
    category: input.category ?? undefined,
    area: input.area ?? undefined,
    calories: input.calories,
    proteinGrams: input.proteinGrams,
    carbsGrams: input.carbsGrams,
    fatGrams: input.fatGrams,
    favorite: input.isFavorite,
    notes: input.notes ?? undefined,
    ingredients: input.ingredients,
    instructions: input.instructions,
  };
}

export async function fetchRecipes(): Promise<{ recipes: NativeRecipe[] }> {
  const recipes = (await convexClient.query(
    convexApi.recipes.list,
    {},
  )) as ConvexRecord[];
  return { recipes: recipes.map(mapRecipe) };
}

export async function saveRecipe(
  input: NativeRecipeInput & { id?: string },
): Promise<NativeRecipe> {
  const id = (await convexClient.mutation(
    convexApi.recipes.save,
    saveInput(input),
  )) as string;
  const recipe = (await convexClient.query(convexApi.recipes.get, {
    id,
  })) as ConvexRecord;
  return mapRecipe(recipe);
}

export function deleteRecipeById(id: string): Promise<unknown> {
  return convexClient.mutation(convexApi.recipes.remove, { id });
}

export async function setRecipeFavorite(
  id: string,
  isFavorite: boolean,
): Promise<NativeRecipe> {
  await convexClient.mutation(convexApi.recipes.setFavorite, {
    id,
    favorite: isFavorite,
  });
  const recipe = (await convexClient.query(convexApi.recipes.get, {
    id,
  })) as ConvexRecord;
  return mapRecipe(recipe);
}
export async function importRecipeFromUrl(url: string): Promise<NativeRecipe> {
  const recipe = await convexClient.action(
    convexApi.healthSearch.importRecipe,
    {
      url,
    },
  );
  return mapRecipe(recipe as ConvexRecord);
}

export function searchExternalRecipes(
  query: string,
): Promise<{ query: string; results: ExternalRecipeResult[] }> {
  return convexClient.action(convexApi.healthSearch.searchRecipes, {
    query,
  }) as Promise<{ query: string; results: ExternalRecipeResult[] }>;
}
