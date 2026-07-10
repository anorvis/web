"use client";

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@anorvis/ui/chart";
import { Skeleton } from "@anorvis/ui/skeleton";
import { workspacePageStyles } from "@anorvis/ui/styles";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import {
  EmptyState,
  HealthDialog,
  MacroCell,
} from "@/features/health/components/health-dashboard-panels";
import {
  bmi,
  bmiStatus,
  dailyMeasurementSeries,
  latestMeasurementValue,
  leanMass,
  measurementTrend,
} from "@/features/health/lib/health-metrics";
import { useHealthStore } from "@/features/health/stores/health-store";
import type { NativeHealthDashboard } from "@/features/health/types/native-health";
import { cmToIn, formatUnitValue, kgToLb } from "@/features/health/utils/forms";

const measurementFields = [
  { key: "weightKg", label: "weight", kind: "mass" },
  { key: "leanMassKg", label: "lean mass", kind: "mass" },
  { key: "bodyFatPercent", label: "body fat", kind: "percent" },
  { key: "heightCm", label: "height", kind: "length" },
  { key: "neckCm", label: "neck", kind: "length" },
  { key: "shoulderCm", label: "shoulders", kind: "length" },
  { key: "chestCm", label: "chest", kind: "length" },
  { key: "leftBicepCm", label: "left bicep", kind: "length" },
  { key: "rightBicepCm", label: "right bicep", kind: "length" },
  { key: "leftForearmCm", label: "left forearm", kind: "length" },
  { key: "rightForearmCm", label: "right forearm", kind: "length" },
  { key: "abdomenCm", label: "abdomen", kind: "length" },
  { key: "waistCm", label: "waist", kind: "length" },
  { key: "hipsCm", label: "hips", kind: "length" },
  { key: "leftThighCm", label: "left thigh", kind: "length" },
  { key: "rightThighCm", label: "right thigh", kind: "length" },
  { key: "leftCalfCm", label: "left calf", kind: "length" },
  { key: "rightCalfCm", label: "right calf", kind: "length" },
] as const;

function formatMeasurement(
  value: number,
  kind: "mass" | "length" | "percent",
  imperial: boolean,
): string {
  if (kind === "percent") return `${formatUnitValue(value)}%`;
  if (kind === "mass") {
    return `${formatUnitValue(imperial ? kgToLb(value) : value)} ${imperial ? "lb" : "kg"}`;
  }
  return `${formatUnitValue(imperial ? cmToIn(value) : value)} ${imperial ? "in" : "cm"}`;
}

function trendLabel(
  trend: string,
  slopePerWeek: number | null,
  imperial: boolean,
): string {
  if (slopePerWeek === null) return `weight ${trend}`;
  const value = imperial ? kgToLb(slopePerWeek) : slopePerWeek;
  const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
  return `weight ${trend} · ${sign}${Math.abs(value).toFixed(1)}${imperial ? "lb" : "kg"}/wk`;
}

export function MeasurementsModal({
  open,
  onOpenChange,
  dashboard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dashboard: NativeHealthDashboard | undefined;
}) {
  return (
    <HealthDialog
      open={open}
      onOpenChange={onOpenChange}
      title="measurements"
      description="Body measurements and trends from your profile and connected providers."
    >
      {dashboard === undefined ? (
        <Skeleton className="h-full rounded-none" />
      ) : (
        <MeasurementsModalBody dashboard={dashboard} />
      )}
    </HealthDialog>
  );
}

function MeasurementsModalBody({
  dashboard,
}: {
  dashboard: NativeHealthDashboard;
}) {
  const unitSystem = useHealthStore((state) => state.unitSystem);
  const imperial = unitSystem === "imperial";
  const profile = dashboard.macroProfile;
  const measurements = dashboard.measurementHistory ?? [];
  const latestWeight =
    latestMeasurementValue(measurements, "weightKg") ??
    profile?.weightKg ??
    null;
  const latestBodyFat =
    latestMeasurementValue(measurements, "bodyFatPercent") ??
    profile?.bodyFatPercent ??
    null;
  const measuredLeanMass = latestMeasurementValue(measurements, "leanMassKg");
  const calculatedLeanMass =
    latestWeight === null ? null : leanMass(latestWeight, latestBodyFat);
  const latestLeanMass = measuredLeanMass ?? calculatedLeanMass?.leanKg ?? null;
  const bmiProfile =
    profile && latestWeight !== null
      ? { ...profile, weightKg: latestWeight }
      : profile;
  const bmiValue =
    latestWeight !== null && profile
      ? bmi(latestWeight, profile.heightCm)
      : null;
  const bmiSummary = bmiStatus(bmiProfile);
  const weightPoints = dailyMeasurementSeries(measurements, "weightKg").map(
    (measurement) => ({
      label: measurement.date.slice(5),
      weight: imperial ? kgToLb(measurement.value) : measurement.value,
    }),
  );
  const weightTrend = measurementTrend(measurements, "weightKg");
  const weightChartConfig = {
    weight: {
      label: imperial ? "lb" : "kg",
      color: "var(--foreground)",
    },
  };

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-4">
        <MacroCell
          label="bmi"
          value={bmiValue === null ? "---" : `${bmiValue}`}
          valueStyle={bmiSummary ? { color: bmiSummary.tone } : undefined}
        />
        <MacroCell
          label="weight"
          value={
            latestWeight === null
              ? "---"
              : formatMeasurement(latestWeight, "mass", imperial)
          }
        />
        <MacroCell
          label="body fat"
          value={
            latestBodyFat === null
              ? "---"
              : formatMeasurement(latestBodyFat, "percent", imperial)
          }
        />
        <MacroCell
          label="lean mass"
          value={
            latestLeanMass === null
              ? "---"
              : formatMeasurement(latestLeanMass, "mass", imperial)
          }
        />
      </div>

      <div className="space-y-2">
        <p className={workspacePageStyles.cardLabel}>weight trend</p>
        {weightPoints.length >= 2 ? (
          <>
            <ChartContainer
              config={weightChartConfig}
              className="h-32 w-full min-h-0 aspect-auto"
            >
              <LineChart
                data={weightPoints}
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
                  domain={["dataMin - 1", "dataMax + 1"]}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="line" />}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="var(--color-weight)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ChartContainer>
            <p className="text-[0.62rem] uppercase tracking-[0.16em] text-muted-foreground">
              {trendLabel(
                weightTrend.trend,
                weightTrend.slopePerWeek,
                imperial,
              )}
            </p>
          </>
        ) : (
          <EmptyState
            title="Not enough weight measurements for a trend."
            body="Sync Hevy or save another profile measurement."
          />
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <p className={workspacePageStyles.cardLabel}>measurement history</p>
          <p className={workspacePageStyles.cardBodyText}>
            {measurements.length} record{measurements.length === 1 ? "" : "s"}
          </p>
        </div>
        {measurements.length > 0 ? (
          measurements.map((_, offset) => {
            const measurement = measurements[measurements.length - 1 - offset];
            if (!measurement) return null;
            return (
              <section
                key={measurement.id}
                className="space-y-3 border border-border p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className={workspacePageStyles.cardLabel}>
                    {measurement.recordedAt.slice(0, 10)}
                  </p>
                  <p className={workspacePageStyles.cardBodyText}>
                    {measurement.source ?? "profile"}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {measurementFields.flatMap((field) => {
                    const value = measurement[field.key];
                    return value === null || value === undefined
                      ? []
                      : [
                          <MacroCell
                            key={field.key}
                            label={field.label}
                            value={formatMeasurement(
                              value,
                              field.kind,
                              imperial,
                            )}
                          />,
                        ];
                  })}
                </div>
              </section>
            );
          })
        ) : (
          <EmptyState
            title="No body measurements yet."
            body="Sync Hevy to import its full body-measurement history."
          />
        )}
      </div>
    </>
  );
}
