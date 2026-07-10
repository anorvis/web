"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useRef, useState } from "react";
import type { NativeRecipeInput } from "@/features/health/types/native-health";

const inputClass =
  "h-8 w-full rounded-none border border-border bg-transparent px-3 text-[0.65rem] text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none";
const textareaClass =
  "min-h-24 w-full resize-y rounded-none border border-border bg-transparent px-3 py-2 text-[0.65rem] leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-foreground focus:outline-none";

type IngredientDraft = { id: number; name: string; quantity: string };

export function RecipeCreateForm({
  onSave,
  isPending,
  error,
}: {
  onSave: (input: NativeRecipeInput) => void;
  isPending: boolean;
  error: string | null;
}) {
  const nextIngredientId = useRef(2);
  const [ingredients, setIngredients] = useState<IngredientDraft[]>([
    { id: 1, name: "", quantity: "" },
  ]);
  const [steps, setSteps] = useState("");

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const number = (name: string) => {
          const value = Number(data.get(name));
          return Number.isFinite(value) && value >= 0 ? value : 0;
        };
        onSave({
          title: String(data.get("title") ?? "").trim(),
          source: "manual",
          sourceId: null,
          sourceUrl: String(data.get("sourceUrl") ?? "").trim() || null,
          imageUrl: String(data.get("imageUrl") ?? "").trim() || null,
          youtubeUrl: String(data.get("youtubeUrl") ?? "").trim() || null,
          category: String(data.get("category") ?? "").trim() || null,
          area: String(data.get("area") ?? "").trim() || null,
          calories: number("calories"),
          proteinGrams: number("proteinGrams"),
          carbsGrams: number("carbsGrams"),
          fatGrams: number("fatGrams"),
          isFavorite: false,
          notes: String(data.get("notes") ?? "").trim() || null,
          ingredients: ingredients
            .map((ingredient) => ({
              name: ingredient.name.trim(),
              quantity: ingredient.quantity.trim() || null,
            }))
            .filter((ingredient) => ingredient.name.length > 0),
          instructions: steps
            .split(/\r?\n/)
            .map((step) => step.trim())
            .filter(Boolean),
        });
      }}
    >
      <div className="space-y-2 border border-border p-3">
        <label className="block space-y-1">
          <span className={workspacePageStyles.cardLabel}>title</span>
          <input
            name="title"
            className={inputClass}
            required
            placeholder="recipe title"
          />
        </label>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className={workspacePageStyles.cardLabel}>category</span>
            <input
              name="category"
              className={inputClass}
              placeholder="dinner"
            />
          </label>
          <label className="block space-y-1">
            <span className={workspacePageStyles.cardLabel}>area</span>
            <input name="area" className={inputClass} placeholder="Italian" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["calories", "kcal"],
            ["proteinGrams", "protein g"],
            ["carbsGrams", "carbs g"],
            ["fatGrams", "fat g"],
          ].map(([name, placeholder]) => (
            <input
              key={name}
              name={name}
              className={inputClass}
              inputMode="decimal"
              placeholder={placeholder}
            />
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            name="sourceUrl"
            type="url"
            className={inputClass}
            placeholder="original recipe URL"
          />
          <input
            name="imageUrl"
            type="url"
            className={inputClass}
            placeholder="image URL"
          />
          <input
            name="youtubeUrl"
            type="url"
            className={inputClass}
            placeholder="YouTube URL"
          />
        </div>
      </div>

      <div className="space-y-2 border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className={workspacePageStyles.cardLabel}>ingredients</p>
          <button
            type="button"
            className={workspacePageStyles.inlineAction}
            onClick={() => {
              const id = nextIngredientId.current;
              nextIngredientId.current += 1;
              setIngredients((current) => [
                ...current,
                { id, name: "", quantity: "" },
              ]);
            }}
          >
            + ingredient
          </button>
        </div>
        <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
          {ingredients.map((ingredient) => (
            <div
              key={ingredient.id}
              className="grid gap-2 sm:grid-cols-[1fr_0.7fr_auto]"
            >
              <input
                className={inputClass}
                value={ingredient.name}
                placeholder="ingredient"
                aria-label="ingredient name"
                onChange={(event) =>
                  setIngredients((current) =>
                    current.map((item) =>
                      item.id === ingredient.id
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <input
                className={inputClass}
                value={ingredient.quantity}
                placeholder="quantity"
                aria-label="ingredient quantity"
                onChange={(event) =>
                  setIngredients((current) =>
                    current.map((item) =>
                      item.id === ingredient.id
                        ? { ...item, quantity: event.target.value }
                        : item,
                    ),
                  )
                }
              />
              <button
                type="button"
                aria-label="remove ingredient"
                className="grid size-8 place-items-center border border-border text-muted-foreground hover:border-foreground hover:text-foreground disabled:opacity-40"
                disabled={ingredients.length === 1}
                onClick={() =>
                  setIngredients((current) =>
                    current.filter((item) => item.id !== ingredient.id),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <label className="block space-y-1">
        <span className={workspacePageStyles.cardLabel}>
          steps — one per line
        </span>
        <textarea
          className={textareaClass}
          value={steps}
          onChange={(event) => setSteps(event.target.value)}
          placeholder={"Prepare the ingredients\nCook until ready\nServe"}
        />
      </label>
      <label className="block space-y-1">
        <span className={workspacePageStyles.cardLabel}>notes</span>
        <textarea
          name="notes"
          className={textareaClass}
          placeholder="optional notes"
        />
      </label>
      {error ? (
        <p className="text-[0.65rem] text-destructive">{error}</p>
      ) : null}
      <div className="flex justify-end border-t border-border pt-3">
        <button
          type="submit"
          className={workspacePageStyles.modalButton}
          disabled={isPending}
        >
          {isPending ? "saving…" : "save recipe"}
        </button>
      </div>
    </form>
  );
}

export function RecipeImportForm({
  onImport,
  isPending,
  error,
}: {
  onImport: (url: string) => void;
  isPending: boolean;
  error: string | null;
}) {
  const [url, setUrl] = useState("");
  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault();
        const value = url.trim();
        if (value) onImport(value);
      }}
    >
      <p className={workspacePageStyles.cardBodyText}>
        Paste a recipe page URL. Sites publishing standard recipe data import
        automatically.
      </p>
      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          className={inputClass}
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://…"
          required
        />
        <button
          type="submit"
          className={workspacePageStyles.inlineSubmit}
          disabled={isPending || !url.trim()}
        >
          {isPending ? "importing…" : "import"}
        </button>
      </div>
      {isPending ? (
        <p className={workspacePageStyles.cardBodyText} aria-live="polite">
          importing recipe…
        </p>
      ) : null}
      {error ? (
        <p className="text-[0.65rem] text-destructive">{error}</p>
      ) : null}
    </form>
  );
}
