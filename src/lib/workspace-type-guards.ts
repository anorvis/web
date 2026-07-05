import type {
  AlpacaPortfolio,
  PortfolioHistoryPoint,
} from "@/features/finance/types/finance";
import type {
  ExerciseStats,
  HealthSnapshot,
  WorkoutSummary,
} from "@/features/health/types/health";
import type { OverviewData } from "@/features/overview/types/overview";
import type { CalendarEvent, LifeSnapshot } from "@/types/workspace";
import { isRecord } from "./guards";
import {
  arrayValue,
  booleanValue,
  numberValue,
  stringValue,
} from "./os-workspace-data";

function nullableNumber(value: unknown): value is number | null {
  return value === null || numberValue(value) !== null;
}

function nullableString(value: unknown): value is string | null {
  return value === null || stringValue(value) !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function isWorkoutSummary(value: unknown): value is WorkoutSummary {
  if (!isRecord(value)) return false;
  return (
    stringValue(value.id) !== null &&
    stringValue(value.title) !== null &&
    stringValue(value.startTime) !== null &&
    stringValue(value.endTime) !== null &&
    numberValue(value.durationSeconds) !== null &&
    numberValue(value.totalVolumeLbs) !== null &&
    numberValue(value.exerciseCount) !== null &&
    Array.isArray(value.topExercises)
  );
}

export function isHealthSnapshot(value: unknown): value is HealthSnapshot {
  if (!isRecord(value)) return false;
  return (
    booleanValue(value.hasHevy) !== null &&
    isRecord(value.score) &&
    arrayValue(value.recentWorkouts, isWorkoutSummary) !== null &&
    Array.isArray(value.trainingDays) &&
    numberValue(value.weekWorkoutCount) !== null &&
    numberValue(value.weekTotalVolumeLbs) !== null &&
    nullableString(value.lastSyncedAt) &&
    arrayValue(value.firstPageWorkouts, isWorkoutSummary) !== null &&
    numberValue(value.totalWorkouts) !== null &&
    isStringArray(value.exerciseList)
  );
}

export function isLifeSnapshot(value: unknown): value is LifeSnapshot {
  if (!isRecord(value)) return false;
  return (
    booleanValue(value.hasGoogleCalendar) !== null &&
    booleanValue(value.hasGoogleTasks) !== null &&
    booleanValue(value.hasSpotify) !== null &&
    stringValue(value.googleCalendarStatus) !== null &&
    stringValue(value.googleTasksStatus) !== null &&
    stringValue(value.spotifyStatus) !== null &&
    stringValue(value.timezoneLabel) !== null &&
    Array.isArray(value.queue) &&
    stringValue(value.doNow) !== null &&
    stringValue(value.doNext) !== null &&
    Array.isArray(value.todayEvents) &&
    numberValue(value.currentHour) !== null &&
    nullableNumber(value.executionScore) &&
    stringValue(value.executionScoreStatusText) !== null &&
    Array.isArray(value.weekEventCounts) &&
    numberValue(value.weekTotalEvents) !== null &&
    numberValue(value.todayEventCount) !== null &&
    Array.isArray(value.heatmapData) &&
    Array.isArray(value.weekGridEvents) &&
    Array.isArray(value.todayCalendarEvents) &&
    Array.isArray(value.weekCalendarEvents)
  );
}

export function isOverviewData(value: unknown): value is OverviewData {
  if (!isRecord(value)) return false;
  return (
    isRecord(value.health) &&
    isRecord(value.life) &&
    isRecord(value.finance) &&
    stringValue(value.agentStatus) !== null &&
    numberValue(value.agentCount) !== null &&
    stringValue(value.timezone) !== null
  );
}

function isPosition(
  value: unknown,
): value is AlpacaPortfolio["positions"][number] {
  if (!isRecord(value)) return false;
  return (
    stringValue(value.symbol) !== null &&
    numberValue(value.qty) !== null &&
    numberValue(value.marketValue) !== null &&
    numberValue(value.unrealizedPl) !== null &&
    numberValue(value.unrealizedPlPc) !== null
  );
}

export function isAlpacaPortfolio(value: unknown): value is AlpacaPortfolio {
  if (!isRecord(value)) return false;
  return (
    numberValue(value.equity) !== null &&
    numberValue(value.cash) !== null &&
    arrayValue(value.positions, isPosition) !== null
  );
}

export function isPortfolioHistory(
  value: unknown,
): value is PortfolioHistoryPoint[] {
  return (
    arrayValue(value, (item): item is PortfolioHistoryPoint => {
      if (!isRecord(item)) return false;
      return (
        stringValue(item.date) !== null && numberValue(item.equity) !== null
      );
    }) !== null
  );
}

export function isCalendarEventArray(value: unknown): value is CalendarEvent[] {
  return Array.isArray(value);
}

export function isExerciseStats(value: unknown): value is ExerciseStats {
  if (!isRecord(value)) return false;
  return (
    stringValue(value.exercise) !== null && stringValue(value.trend) !== null
  );
}
