import { Button } from "@anorvis/ui/button";
import { Label } from "@anorvis/ui/label";
import { Progress } from "@anorvis/ui/progress";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { ChevronDown, ChevronUp } from "lucide-react";
import { defaultOpenSections } from "@/features/health/config";
import { useHealthStore } from "@/features/health/stores/health-store";
import type { NativeHealthDashboard } from "@/features/health/types/native-health";
import {
  dietProgressLine,
  fitnessProgressLine,
  sameDay,
  targetLine,
} from "@/features/health/utils/forms";
import { toDateString } from "@/features/life/lib/calendar-utils";

type WeekDay = { key: string; label: string };
type MealEntry = NativeHealthDashboard["recentMeals"][number];
type WorkoutEntry = NativeHealthDashboard["recentWorkouts"][number];
type MacroProfile = NonNullable<NativeHealthDashboard["macroProfile"]>;
type Totals = { calories: number; protein: number; carbs: number; fat: number };

function CollapseIcon({ open }: { open: boolean }) {
  const Icon = open ? ChevronUp : ChevronDown;
  return <Icon className="size-4 shrink-0 text-muted-foreground" />;
}

export function DietSection(props: {
  dashboard: NativeHealthDashboard;
  profile: MacroProfile | null;
  totals: Totals;
  days: WeekDay[];
  todayKey: string;
  weekLabel: string;
  openMealForDay: (day: string) => void;
  openMealForEdit: (entry: MealEntry) => void;
}) {
  const {
    dashboard,
    profile,
    totals,
    days,
    todayKey,
    weekLabel,
    openMealForDay,
    openMealForEdit,
  } = props;
  const { openSections, setWeekOffset, toggleSection, weekOffset } =
    useHealthStore();
  const open = (openSections ?? defaultOpenSections).diet;
  return (
    <section className={workspacePageStyles.card}>
      <div
        className={`${workspacePageStyles.cardHeader} ${workspacePageStyles.cardHeaderRow}`}
      >
        <button
          type="button"
          onClick={() => toggleSection("diet")}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
        >
          <CollapseIcon open={open} />
          <div className="flex flex-col gap-1">
            <span className={workspacePageStyles.cardLabel}>diet</span>
            <strong className={workspacePageStyles.cardTitle}>
              {dietProgressLine(dashboard)}
            </strong>
            <span className={workspacePageStyles.cardBodyText}>
              {profile
                ? `${totals.calories}/${profile.targetCalories} kcal logged`
                : targetLine(dashboard)}
            </span>
            <span className={workspacePageStyles.cardBodyText}>
              source: native meals + food lookup/manual fallback
            </span>
          </div>
        </button>
        <Button
          type="button"
          onClick={() => {
            openMealForDay(toDateString(new Date()));
          }}
          className={workspacePageStyles.actionButton}
        >
          add meal
        </Button>
      </div>
      {open && (
        <div className={workspacePageStyles.cardBody}>
          {profile ? (
            <div className="grid gap-3 md:grid-cols-4">
              {[
                ["calories", totals.calories, profile.targetCalories],
                ["protein", totals.protein, profile.proteinGrams],
                ["carbs", totals.carbs, profile.carbsGrams],
                ["fat", totals.fat, profile.fatGrams],
              ].map(([label, value, target]) => (
                <div key={label} className={workspacePageStyles.metricCell}>
                  <p className={workspacePageStyles.metricLabel}>{label}</p>
                  <p className={workspacePageStyles.metricValue}>
                    {value}/{target}
                  </p>
                  <Progress
                    value={Math.min(
                      100,
                      (Number(value) / Number(target)) * 100,
                    )}
                  />
                </div>
              ))}
            </div>
          ) : null}

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className={workspacePageStyles.cardLabel}>
                7-day meals · {weekLabel}
              </Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((value) => value - 1)}
                  className={workspacePageStyles.inlineSubmit}
                >
                  previous week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className={workspacePageStyles.inlineSubmit}
                  disabled={weekOffset === 0}
                >
                  this week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((value) => value + 1)}
                  className={workspacePageStyles.inlineSubmit}
                >
                  next week
                </button>
              </div>
            </div>
            <div className={workspacePageStyles.horizontalScroller}>
              <div className={workspacePageStyles.weekGrid}>
                {days.map((day) => (
                  <div
                    key={day.key}
                    className={`${workspacePageStyles.weekGridHeader} ${
                      day.key === todayKey
                        ? workspacePageStyles.weekGridHeaderToday
                        : ""
                    }`}
                  >
                    <p className={workspacePageStyles.metricLabel}>
                      {day.label}
                    </p>
                  </div>
                ))}
                {days.map((day) => {
                  const meals = dashboard.recentMeals.filter((entry) =>
                    sameDay(entry.loggedAt, day.key),
                  );
                  const visibleMeals = meals.slice(0, 3);
                  const hiddenMeals = meals.slice(3);
                  return (
                    <div
                      key={day.key}
                      className={workspacePageStyles.weekGridCell}
                    >
                      {visibleMeals.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => openMealForEdit(entry)}
                          className={workspacePageStyles.weekEntryButton}
                        >
                          <span className="block truncate">{entry.name}</span>
                          <span className="block text-muted-foreground">
                            {entry.calories} kcal · P{entry.proteinGrams}/C
                            {entry.carbsGrams}/F{entry.fatGrams}
                          </span>
                        </button>
                      ))}
                      {hiddenMeals.length > 0 ? (
                        <details>
                          <summary className={workspacePageStyles.inlineAction}>
                            {hiddenMeals.length} more
                          </summary>
                          {hiddenMeals.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => openMealForEdit(entry)}
                              className={
                                workspacePageStyles.weekEntryMoreButton
                              }
                            >
                              {entry.name}
                            </button>
                          ))}
                        </details>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openMealForDay(day.key)}
                        className={`${workspacePageStyles.inlineSubmit} min-h-9 w-full`}
                      >
                        + add meal
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function FitnessSection(props: {
  dashboard: NativeHealthDashboard;
  latestWorkout: WorkoutEntry | null;
  days: WeekDay[];
  todayKey: string;
  weekLabel: string;
  openWorkoutForDay: (day: string) => void;
  openWorkoutForEdit: (entry: WorkoutEntry) => void;
}) {
  const {
    dashboard,
    latestWorkout,
    days,
    todayKey,
    weekLabel,
    openWorkoutForDay,
    openWorkoutForEdit,
  } = props;
  const { openSections, setWeekOffset, toggleSection, weekOffset } =
    useHealthStore();
  const open = (openSections ?? defaultOpenSections).fitness;
  return (
    <section className={workspacePageStyles.card}>
      <div
        className={`${workspacePageStyles.cardHeader} ${workspacePageStyles.cardHeaderRow}`}
      >
        <button
          type="button"
          onClick={() => toggleSection("fitness")}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left"
        >
          <CollapseIcon open={open} />
          <div className="flex flex-col gap-1">
            <span className={workspacePageStyles.cardLabel}>fitness</span>
            <strong className={workspacePageStyles.cardTitle}>
              {fitnessProgressLine(dashboard, days)}
            </strong>
            <span className={workspacePageStyles.cardBodyText}>
              {latestWorkout
                ? `last: ${latestWorkout.title}`
                : "log your first native workout"}
            </span>
            <span className={workspacePageStyles.cardBodyText}>
              source: native Hevy-compatible workout primitives
            </span>
          </div>
        </button>
        <Button
          type="button"
          onClick={() => {
            openWorkoutForDay(toDateString(new Date()));
          }}
          className={workspacePageStyles.actionButton}
        >
          add workout
        </Button>
      </div>
      {open && (
        <div className={workspacePageStyles.cardBody}>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className={workspacePageStyles.cardLabel}>
                7-day workouts · {weekLabel}
              </Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setWeekOffset((value) => value - 1)}
                  className={workspacePageStyles.inlineSubmit}
                >
                  previous week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset(0)}
                  className={workspacePageStyles.inlineSubmit}
                  disabled={weekOffset === 0}
                >
                  this week
                </button>
                <button
                  type="button"
                  onClick={() => setWeekOffset((value) => value + 1)}
                  className={workspacePageStyles.inlineSubmit}
                >
                  next week
                </button>
              </div>
            </div>
            <div className={workspacePageStyles.horizontalScroller}>
              <div className={workspacePageStyles.weekGrid}>
                {days.map((day) => (
                  <div
                    key={day.key}
                    className={`${workspacePageStyles.weekGridHeader} ${
                      day.key === todayKey
                        ? workspacePageStyles.weekGridHeaderToday
                        : ""
                    }`}
                  >
                    <p className={workspacePageStyles.metricLabel}>
                      {day.label}
                    </p>
                  </div>
                ))}
                {days.map((day) => {
                  const workouts = dashboard.recentWorkouts.filter((entry) =>
                    sameDay(entry.startedAt, day.key),
                  );
                  const visibleWorkouts = workouts.slice(0, 3);
                  const hiddenWorkouts = workouts.slice(3);
                  return (
                    <div
                      key={day.key}
                      className={workspacePageStyles.weekGridCell}
                    >
                      {visibleWorkouts.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => openWorkoutForEdit(entry)}
                          className={workspacePageStyles.weekEntryButton}
                        >
                          <span className="block truncate">{entry.title}</span>
                          <span className="block text-muted-foreground">
                            {entry.exercises.length} exercises ·{" "}
                            {Math.round(entry.durationSeconds / 60)} min
                          </span>
                        </button>
                      ))}
                      {hiddenWorkouts.length > 0 ? (
                        <details>
                          <summary className={workspacePageStyles.inlineAction}>
                            {hiddenWorkouts.length} more
                          </summary>
                          {hiddenWorkouts.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              onClick={() => openWorkoutForEdit(entry)}
                              className={
                                workspacePageStyles.weekEntryMoreButton
                              }
                            >
                              {entry.title}
                            </button>
                          ))}
                        </details>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => openWorkoutForDay(day.key)}
                        className={`${workspacePageStyles.inlineSubmit} min-h-9 w-full`}
                      >
                        + add workout
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export function MedicalSection() {
  const { openSections, toggleSection } = useHealthStore();
  const open = (openSections ?? defaultOpenSections).medical;
  return (
    <section className={workspacePageStyles.card}>
      <button
        type="button"
        onClick={() => toggleSection("medical")}
        className={`${workspacePageStyles.cardHeader} w-full cursor-pointer text-left`}
      >
        <div className="flex items-start gap-3">
          <CollapseIcon open={open} />
          <div className="flex flex-col gap-1">
            <span className={workspacePageStyles.cardLabel}>
              medical records
            </span>
            <strong className={workspacePageStyles.cardTitle}>
              coming soon
            </strong>
            <span className={workspacePageStyles.cardBodyText}>
              encounter/document timeline will live here later
            </span>
            <span className={workspacePageStyles.cardBodyText}>
              source: not connected
            </span>
          </div>
        </div>
      </button>
      {open && (
        <div className={workspacePageStyles.cardBody}>
          Medical records are intentionally read-only/disabled in this
          prototype.
        </div>
      )}
    </section>
  );
}
