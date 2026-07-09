"use client";

import { Button } from "@anorvis/ui/button";
import { Input } from "@anorvis/ui/input";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  AddSourceButton,
  Metric,
  RecordRow,
  Section,
} from "@/components/life-intelligence/record-ui";
import {
  fetchHealthDashboard,
  postHealthForm,
  saveHevySettings,
  syncHevy,
} from "@/features/health/api/health";
import { usePersistedQuery } from "@/hooks/use-persisted-query";
import { healthFromDashboard } from "@/lib/life-intelligence/adapters";
import {
  formatDateTime,
  macroTotals,
  muscleCoverage,
} from "@/lib/life-intelligence/derive";
import { queryKeys } from "@/lib/query/keys";

const inputClass =
  "h-7 rounded-none px-2 text-[0.6rem] placeholder:text-[0.6rem]";
const buttonClass =
  "h-7 rounded-none px-2 text-[0.6rem] hover:border-foreground hover:bg-foreground hover:text-background";
const fileInputId = "meal-photo-input";

export function HealthDashboard() {
  const queryClient = useQueryClient();
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [mealStatus, setMealStatus] = useState<string | null>(null);
  const [hevyKey, setHevyKey] = useState("");
  const dashboardQuery = usePersistedQuery({
    queryKey: queryKeys.health.dashboard(),
    queryFn: fetchHealthDashboard,
  });
  const saveHevyMutation = useMutation({
    mutationFn: () => saveHevySettings(hevyKey),
  });
  const syncHevyMutation = useMutation({
    mutationFn: syncHevy,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.health.dashboard() }),
  });
  const mealMutation = useMutation({
    mutationFn: (formData: FormData) =>
      postHealthForm("/api/health/meals", formData),
    onSuccess: () => {
      setMealStatus("meal saved");
      queryClient.invalidateQueries({ queryKey: queryKeys.health.dashboard() });
    },
    onError: () => setMealStatus("meal save failed"),
  });

  const health = healthFromDashboard(dashboardQuery.hydratedData);
  const totals = macroTotals(health);
  const coverage = muscleCoverage(health);
  const loading = dashboardQuery.hydrationLoading;

  return (
    <div className="space-y-4">
      <Section
        label="sources"
        title="health setup"
        headerExtra={<AddSourceButton domain="health" />}
      >
        <p className={workspacePageStyles.cardBodyText}>
          Connect workout and nutrition sources here. Metrics below render only
          from saved workouts, meals, and macro targets.
        </p>
      </Section>

      <section className="grid gap-4 xl:grid-cols-4">
        <Metric
          label="workouts"
          value={`${health.workouts.length}`}
          note="from Hevy/native health source"
        />
        <Metric
          label="meals"
          value={`${health.meals.length}`}
          note="manual or photo-assisted entries"
        />
        <Metric
          label="calories"
          value={`${totals.calories}`}
          note={`${totals.protein}g protein`}
        />
        <Metric
          label="macro profile"
          value={dashboardQuery.data?.macroProfile ? "loaded" : "---"}
          note="from local anorvis-os"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Section label="training" title="training">
          <div className="mb-4 grid items-center gap-2 md:grid-cols-[1fr_auto_auto]">
            <Input
              value={hevyKey}
              onChange={(event) => setHevyKey(event.currentTarget.value)}
              placeholder="hevy api key"
              type="password"
              className={inputClass}
            />
            <Button
              size="sm"
              variant="outline"
              className={buttonClass}
              onClick={() => saveHevyMutation.mutate()}
              disabled={!hevyKey || saveHevyMutation.isPending}
            >
              save key
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={buttonClass}
              onClick={() => syncHevyMutation.mutate()}
              disabled={syncHevyMutation.isPending}
            >
              sync
            </Button>
          </div>
          {loading ? (
            <Skeleton className="h-48 rounded-none" />
          ) : health.workouts.length > 0 ? (
            <div className="space-y-4">
              <div className="space-y-0">
                {health.workouts.map((workout) => (
                  <RecordRow
                    key={workout.id}
                    label={formatDateTime(workout.startAt)}
                    value={workout.title}
                    meta={`${workout.exercises.length} exercises`}
                  />
                ))}
              </div>
              {coverage.length > 0 && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {coverage.map((item) => (
                    <div key={item.muscle} className="border border-border p-3">
                      <p className="text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground">
                        {item.muscle}
                      </p>
                      <p className="mt-1 text-sm text-foreground">
                        {item.sets} sets
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title="No workouts yet."
              body="Connect Hevy, then run sync. Workouts will be converted into Workout records and can later create life time blocks."
            />
          )}
        </Section>

        <Section label="food" title="food">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              mealMutation.mutate(new FormData(event.currentTarget));
            }}
          >
            <Input
              name="name"
              placeholder="meal name"
              required
              className={inputClass}
            />
            <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr]">
              <label
                htmlFor={fileInputId}
                className={`${buttonClass} inline-flex cursor-pointer items-center justify-center border border-border`}
              >
                browse
              </label>
              <p className="truncate text-[0.6rem] text-muted-foreground">
                {photoName ?? "no photo selected"}
              </p>
              <input
                id={fileInputId}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) =>
                  setPhotoName(event.currentTarget.files?.[0]?.name ?? null)
                }
              />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Input
                name="calories"
                placeholder="kcal"
                inputMode="numeric"
                className={inputClass}
              />
              <Input
                name="proteinGrams"
                placeholder="protein"
                inputMode="numeric"
                className={inputClass}
              />
              <Input
                name="carbsGrams"
                placeholder="carbs"
                inputMode="numeric"
                className={inputClass}
              />
              <Input
                name="fatGrams"
                placeholder="fat"
                inputMode="numeric"
                className={inputClass}
              />
            </div>
            <input type="hidden" name="mealType" value="meal" />
            <input
              type="hidden"
              name="loggedAt"
              value={new Date().toISOString()}
            />
            <Input
              name="notes"
              placeholder={photoName ? `photo selected: ${photoName}` : "notes"}
              className={inputClass}
            />
            <Button
              type="submit"
              size="sm"
              variant="outline"
              className={buttonClass}
              disabled={mealMutation.isPending}
            >
              {mealMutation.isPending ? "saving" : "save meal"}
            </Button>
            {mealStatus && (
              <p className="text-xs text-muted-foreground">{mealStatus}</p>
            )}
          </form>
          <div className="mt-4 space-y-0">
            {health.meals.length > 0 ? (
              health.meals.map((meal) => (
                <RecordRow
                  key={meal.id}
                  label={formatDateTime(meal.time)}
                  value={meal.title}
                  meta={`${meal.macro?.calories ?? 0} kcal · ${meal.macro?.protein ?? 0}g protein`}
                />
              ))
            ) : (
              <EmptyState
                title="No meals yet."
                body="Upload a food image and enter/confirm macros to create a Meal record."
              />
            )}
          </div>
        </Section>
      </section>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="border border-dashed border-border p-4">
      <p className="text-xs text-foreground">{title}</p>
      <p className={workspacePageStyles.cardBodyText}>{body}</p>
    </div>
  );
}
