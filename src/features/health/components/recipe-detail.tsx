"use client";

import { workspacePageStyles } from "@anorvis/ui/styles";
import { useState } from "react";
import { workspacePinnedModalFooterClass } from "@/components/layout/workspace-dialog";
import { MacroCell } from "@/features/health/components/health-dashboard-panels";
import { youtubeEmbedUrl } from "@/features/health/lib/recipe-video";
import type { ExternalRecipeResult } from "@/features/health/types/native-health";

const linkClass =
  "inline-block break-all text-[0.56rem] uppercase tracking-[0.14em] text-foreground underline decoration-border underline-offset-4 hover:text-muted-foreground";
const metaClass =
  "text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground";

export function metaLine(category: string | null, area: string | null): string {
  return [area, category].filter(Boolean).join(" · ");
}

export function externalRecipeToInput(result: ExternalRecipeResult) {
  return {
    title: result.title,
    source: "themealdb",
    sourceId: result.id,
    sourceUrl: result.sourceUrl,
    imageUrl: result.imageUrl,
    youtubeUrl: result.youtubeUrl,
    category: result.category,
    area: result.area,
    calories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
    isFavorite: true,
    notes: null,
    ingredients: result.ingredients,
    instructions: result.instructions,
  };
}

export function FavoriteStar({
  active,
  pending,
  title,
  onToggle,
  compact = false,
}: {
  active: boolean;
  pending: boolean;
  title: string;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={`favourite ${title}`}
      aria-pressed={active}
      aria-busy={pending}
      disabled={pending}
      onClick={onToggle}
      className={`${compact ? "size-7" : "size-8"} grid shrink-0 place-items-center border text-sm transition ${
        active
          ? "border-foreground text-foreground"
          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      } disabled:opacity-50`}
    >
      {active ? "★" : "☆"}
    </button>
  );
}

function RecipeMedia({
  title,
  imageUrl,
  youtubeUrl,
}: {
  title: string;
  imageUrl: string | null;
  youtubeUrl: string | null;
}) {
  const [playing, setPlaying] = useState(false);
  const embedUrl = youtubeEmbedUrl(youtubeUrl);
  if (playing && embedUrl) {
    return (
      <iframe
        src={`${embedUrl}?autoplay=1`}
        title={`${title} — video`}
        loading="lazy"
        allow="autoplay; encrypted-media; picture-in-picture"
        allowFullScreen
        className="aspect-video w-full border border-border"
      />
    );
  }
  if (embedUrl) {
    return (
      <button
        type="button"
        aria-label={`play ${title} video`}
        onClick={() => setPlaying(true)}
        className="relative grid aspect-video w-full place-items-center overflow-hidden border border-border bg-foreground/[0.03] bg-cover bg-center"
        style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
      >
        {imageUrl ? (
          <span className="absolute inset-0 bg-background/55" />
        ) : null}
        <span className={`relative ${workspacePageStyles.modalButton}`}>
          ▶ video
        </span>
      </button>
    );
  }
  return (
    <div
      role="img"
      aria-label={`${title} recipe`}
      className="grid aspect-video w-full place-items-center overflow-hidden border border-border bg-foreground/[0.03] bg-contain bg-center bg-no-repeat"
      style={imageUrl ? { backgroundImage: `url(${imageUrl})` } : undefined}
    >
      {!imageUrl ? (
        <span className={workspacePageStyles.cardBodyText}>
          recipe image unavailable
        </span>
      ) : null}
    </div>
  );
}

export function RecipeDetailView({
  title,
  meta,
  imageUrl,
  macros,
  ingredients,
  instructions,
  sourceUrl,
  youtubeUrl,
  onBack,
  favorite,
  actions,
  error,
}: {
  title: string;
  meta: string;
  imageUrl: string | null;
  macros?: {
    calories: number;
    proteinGrams: number;
    carbsGrams: number;
    fatGrams: number;
  } | null;
  ingredients: { name: string; quantity: string | null }[];
  instructions: string[];
  sourceUrl: string | null;
  youtubeUrl: string | null;
  onBack: () => void;
  favorite: {
    active: boolean;
    pending: boolean;
    onToggle: () => void;
  };
  actions?: React.ReactNode;
  error?: string | null;
}) {
  const showMacros = Boolean(macros && macros.calories > 0);
  return (
    <div className="flex min-h-full flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="min-w-0 truncate text-sm text-foreground">{title}</p>
            <FavoriteStar
              active={favorite.active}
              pending={favorite.pending}
              title={title}
              onToggle={favorite.onToggle}
            />
          </div>
          {meta ? <p className={`mt-1 ${metaClass}`}>{meta}</p> : null}
        </div>
        <button
          type="button"
          className={workspacePageStyles.modalButton}
          onClick={onBack}
        >
          back
        </button>
      </div>

      {showMacros && macros ? (
        <div className="grid gap-3 sm:grid-cols-4">
          <MacroCell label="calories" value={`${macros.calories}`} />
          <MacroCell label="protein" value={`${macros.proteinGrams}g`} />
          <MacroCell label="carbs" value={`${macros.carbsGrams}g`} />
          <MacroCell label="fat" value={`${macros.fatGrams}g`} />
        </div>
      ) : null}

      <RecipeMedia title={title} imageUrl={imageUrl} youtubeUrl={youtubeUrl} />

      {ingredients.length > 0 ? (
        <div className="space-y-1">
          <p className={workspacePageStyles.cardLabel}>ingredients</p>
          <ul className="space-y-1">
            {ingredients.map((ingredient, index) => (
              <li
                key={`${ingredient.name}-${index}`}
                className="text-[0.65rem] text-muted-foreground"
              >
                {ingredient.name}
                {ingredient.quantity ? ` — ${ingredient.quantity}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {instructions.length > 0 ? (
        <div className="space-y-1">
          <p className={workspacePageStyles.cardLabel}>steps</p>
          <ol className="space-y-2">
            {instructions.map((step, index) => (
              <li
                // biome-ignore lint/suspicious/noArrayIndexKey: Recipe steps are ordered and never reordered.
                key={`${step}-${index}`}
                className="text-[0.65rem] leading-relaxed text-muted-foreground"
              >
                {index + 1}. {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {sourceUrl || youtubeUrl ? (
        <div className="flex flex-wrap gap-4">
          {sourceUrl ? (
            <a
              className={linkClass}
              href={sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              original recipe
            </a>
          ) : null}
          {youtubeUrl ? (
            <a
              className={linkClass}
              href={youtubeUrl}
              target="_blank"
              rel="noreferrer"
            >
              video
            </a>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p className="text-[0.65rem] text-destructive">{error}</p>
      ) : null}
      {actions ? (
        <div className={`${workspacePinnedModalFooterClass} -mb-4`}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
