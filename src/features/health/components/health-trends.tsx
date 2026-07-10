"use client";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@anorvis/ui/chart";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { TrendLineChart } from "@/features/health/components/health-charts";
import {
  EmptyState,
  HealthTabs,
  healthTabPanelProps,
} from "@/features/health/components/health-dashboard-panels";
import {
  dailyCalorieSeries,
  dailyMeasurementSeries,
  measurementTrend,
  rollingAverage,
  weeklyTrainingSeries,
} from "@/features/health/lib/health-metrics";
import { useHealthStore } from "@/features/health/stores/health-store";
import type { NativeHealthDashboard } from "@/features/health/types/native-health";
import { kgToLb } from "@/features/health/utils/forms";

type TrendTab = "diet" | "training" | "body";

const TABS: { id: TrendTab; label: string }[] = [
  { id: "diet", label: "diet" },
  { id: "training", label: "training" },
  { id: "body", label: "body" },
];

const PANEL_LABEL = "health graph tabs";
const captionClass =
  "text-[0.6rem] uppercase tracking-[0.16em] text-muted-foreground";

const dietChartConfig: ChartConfig = {
  calories: { label: "kcal", color: "var(--foreground)" },
  average: { label: "7-day avg", color: "var(--muted-foreground)" },
};
const trainingChartConfig: ChartConfig = {
  workouts: { label: "workouts", color: "var(--foreground)" },
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function weightTrendCaption(
  trend: string,
  slopePerWeek: number | null,
  imperial: boolean,
): string {
  const unit = imperial ? "lb" : "kg";
  if (slopePerWeek === null) return `weight ${trend}`;
  const perWeek = imperial ? kgToLb(slopePerWeek) : slopePerWeek;
  const sign = perWeek > 0 ? "+" : perWeek < 0 ? "\u2212" : "";
  return `weight ${trend} · ${sign}${Math.abs(round1(perWeek))}${unit}/wk`;
}

/**
 * Tabbed page-level health graph rendered entirely from the persisted
 * dashboard payload — diet (30-day calories + 7-day average + target),
 * training (8 zero-filled UTC weeks of workout count), body (weight +
 * optional body-fat, unit-aware). No composite/invented score.
 */
export function HealthTrendsCard({
  dashboard,
  loading,
  isError,
  onRetry,
}: {
  dashboard: NativeHealthDashboard | undefined;
  loading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [tab, setTab] = useState<TrendTab>("diet");
  const unitSystem = useHealthStore((state) => state.unitSystem);
  const imperial = unitSystem === "imperial";

  const diet = useMemo(() => {
    const series = dailyCalorieSeries(dashboard?.recentMeals ?? [], 30);
    const averages = rollingAverage(
      series.map((point) => point.calories),
      7,
    );
    return {
      data: series.map((point, index) => ({
        label: point.date.slice(5),
        calories: point.calories,
        average: round1(averages[index] ?? 0),
      })),
      hasCalories: series.some((point) => point.calories > 0),
      loggedDays: series.filter((point) => point.calories > 0).length,
    };
  }, [dashboard?.recentMeals]);

  const training = useMemo(() => {
    const series = weeklyTrainingSeries(dashboard?.recentWorkouts ?? [], 8);
    return {
      data: series.map((point) => ({
        label: point.weekStart.slice(5),
        workouts: point.workouts,
      })),
      totalWorkouts: series.reduce((sum, point) => sum + point.workouts, 0),
      totalSets: series.reduce((sum, point) => sum + point.sets, 0),
      totalHours: Math.round(
        series.reduce((sum, point) => sum + point.durationSeconds, 0) / 3600,
      ),
    };
  }, [dashboard?.recentWorkouts]);

  const body = useMemo(() => {
    const history = dashboard?.measurementHistory ?? [];
    const weight = dailyMeasurementSeries(history, "weightKg");
    const fat = dailyMeasurementSeries(history, "bodyFatPercent");
    const fatByDate = new Map(fat.map((point) => [point.date, point.value]));
    const hasBodyFat = fat.length >= 2;
    const trend = measurementTrend(history, "weightKg");
    return {
      data: weight.map((point) => ({
        label: point.date.slice(5),
        weight: imperial ? round1(kgToLb(point.value)) : round1(point.value),
        bodyFat: hasBodyFat ? (fatByDate.get(point.date) ?? null) : null,
      })),
      hasWeight: weight.length >= 2,
      hasBodyFat,
      caption: weightTrendCaption(trend.trend, trend.slopePerWeek, imperial),
    };
  }, [dashboard?.measurementHistory, imperial]);

  const bodyConfig = useMemo<ChartConfig>(
    () => ({
      weight: {
        label: imperial ? "lb" : "kg",
        color: "var(--foreground)",
      },
      bodyFat: { label: "body fat %", color: "var(--muted-foreground)" },
    }),
    [imperial],
  );

  if (loading) {
    return <Skeleton className="h-full rounded-none" />;
  }
  if (isError || !dashboard) {
    return (
      <EmptyState
        title="Health data could not be loaded."
        body="Check that anorvis-os is running, then retry."
        action={
          <button
            type="button"
            className={workspacePageStyles.modalButton}
            onClick={onRetry}
          >
            retry
          </button>
        }
      />
    );
  }

  const targetCalories = dashboard.macroProfile?.targetCalories ?? null;
  const caption =
    tab === "diet"
      ? `target ${targetCalories ?? "---"} kcal · logged ${diet.loggedDays}/30 days`
      : tab === "training"
        ? `${training.totalWorkouts} workouts · ${training.totalSets} sets · ${training.totalHours}h total in 8 weeks`
        : body.hasWeight
          ? body.caption
          : "weight + body-fat trend";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className={workspacePageStyles.cardLabel}>trends</p>
          <p className={captionClass}>{caption}</p>
        </div>
        <HealthTabs
          label={PANEL_LABEL}
          tabs={TABS}
          active={tab}
          onSelect={(id) => setTab(id as TrendTab)}
        />
      </div>

      <div
        className="min-h-0 flex-1"
        {...healthTabPanelProps(PANEL_LABEL, tab)}
      >
        {tab === "diet" ? (
          diet.hasCalories ? (
            <TrendLineChart
              config={dietChartConfig}
              data={diet.data}
              dataKey="calories"
              className="h-full"
              referenceY={targetCalories}
              secondary={{ dataKey: "average" }}
            />
          ) : (
            <EmptyState
              title="No logged meals in the last 30 days."
              body="Log meals to build the daily calorie trend."
            />
          )
        ) : tab === "training" ? (
          training.totalWorkouts > 0 ? (
            <ChartContainer
              config={trainingChartConfig}
              className="aspect-auto h-full min-h-0 w-full"
            >
              <BarChart
                data={training.data}
                margin={{ left: 4, right: 4, top: 4, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tickMargin={8}
                  width={40}
                  allowDecimals={false}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Bar
                  dataKey="workouts"
                  fill="var(--color-workouts)"
                  radius={2}
                />
              </BarChart>
            </ChartContainer>
          ) : (
            <EmptyState
              title="No workouts yet."
              body="Add a workout source to populate training records."
            />
          )
        ) : body.hasWeight ? (
          <TrendLineChart
            config={bodyConfig}
            data={body.data}
            dataKey="weight"
            className="h-full"
            yDomain={["dataMin - 1", "dataMax + 1"]}
            secondary={
              body.hasBodyFat
                ? { dataKey: "bodyFat", axis: "right" }
                : undefined
            }
          />
        ) : (
          <EmptyState
            title="Not enough measurements for a trend."
            body="Each macro-profile save records a weight snapshot."
          />
        )}
      </div>
    </div>
  );
}
