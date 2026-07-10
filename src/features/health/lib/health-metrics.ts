import type {
  NativeMacroProfile,
  NativeMeal,
  NativeMeasurement,
  NativeWorkout,
} from "@/features/health/types/native-health";

const ACTIVITY_MULTIPLIERS: Record<string, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function bmi(weightKg: number, heightCm: number): number | null {
  if (weightKg <= 0 || heightCm <= 0) return null;
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function bmrMifflinStJeor(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: string;
}): number {
  return (
    10 * input.weightKg +
    6.25 * input.heightCm -
    5 * input.age +
    (input.sex === "female" ? -161 : 5)
  );
}

export function tdee(bmr: number, activityLevel: string): number {
  return bmr * (ACTIVITY_MULTIPLIERS[activityLevel] ?? 1.55);
}

export function leanMass(
  weightKg: number,
  bodyFatPercent: number | null,
): { leanKg: number; fatKg: number } | null {
  if (bodyFatPercent === null || bodyFatPercent <= 0 || bodyFatPercent >= 100) {
    return null;
  }
  const fatKg = (weightKg * bodyFatPercent) / 100;
  return { leanKg: weightKg - fatKg, fatKg };
}

export type DailyCaloriePoint = {
  date: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export function dailyCalorieSeries(
  meals: NativeMeal[],
  days: number,
  now: Date = new Date(),
): DailyCaloriePoint[] {
  const totals = new Map<
    string,
    { calories: number; protein: number; carbs: number; fat: number }
  >();
  for (const meal of meals) {
    const date = meal.loggedAt.slice(0, 10);
    if (!date) continue;
    const bucket = totals.get(date) ?? {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    };
    bucket.calories += meal.calories;
    bucket.protein += meal.proteinGrams;
    bucket.carbs += meal.carbsGrams;
    bucket.fat += meal.fatGrams;
    totals.set(date, bucket);
  }
  const anchorMs = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const series: DailyCaloriePoint[] = [];
  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const date = new Date(anchorMs - offset * 86_400_000)
      .toISOString()
      .slice(0, 10);
    const bucket = totals.get(date);
    series.push({
      date,
      calories: bucket?.calories ?? 0,
      protein: bucket?.protein ?? 0,
      carbs: bucket?.carbs ?? 0,
      fat: bucket?.fat ?? 0,
    });
  }
  return series;
}

export function rollingAverage(values: number[], window = 7): number[] {
  if (window <= 0) return [...values];
  return values.map((_, index) => {
    const start = Math.max(0, index - window + 1);
    const slice = values.slice(start, index + 1);
    const sum = slice.reduce((acc, value) => acc + value, 0);
    return sum / slice.length;
  });
}

export function calorieAdherence(
  calories: number,
  targetCalories: number,
): number | null {
  if (targetCalories <= 0) return null;
  const ratio = calories / targetCalories;
  return Math.min(Math.max(ratio, 0), 1) * 100;
}

export type DailyMeasurementPoint = {
  date: string;
  value: number;
};

export function dailyMeasurementSeries(
  history: NativeMeasurement[],
  key: "weightKg" | "bodyFatPercent",
): DailyMeasurementPoint[] {
  const latestByDate = new Map<
    string,
    DailyMeasurementPoint & { recordedAt: number }
  >();
  for (const entry of history) {
    const recordedAt = new Date(entry.recordedAt).getTime();
    const value = entry[key];
    if (value === null || !Number.isFinite(recordedAt)) continue;
    const date = new Date(recordedAt).toISOString().slice(0, 10);
    const current = latestByDate.get(date);
    if (!current || recordedAt >= current.recordedAt) {
      latestByDate.set(date, { date, value, recordedAt });
    }
  }
  return Array.from(latestByDate.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(({ date, value }) => ({ date, value }));
}
export function latestMeasurementValue(
  history: NativeMeasurement[],
  key: keyof NativeMeasurement,
): number | null {
  for (let index = history.length - 1; index >= 0; index -= 1) {
    const value = history[index]?.[key];
    if (typeof value === "number") return value;
  }
  return null;
}

export function measurementTrend(
  history: NativeMeasurement[],
  key: "weightKg" | "bodyFatPercent",
): {
  trend: "up" | "down" | "stable" | "insufficient";
  slopePerWeek: number | null;
} {
  const points = dailyMeasurementSeries(history, key).map((point) => ({
    t: new Date(`${point.date}T00:00:00.000Z`).getTime(),
    value: point.value,
  }));
  if (points.length < 2) {
    return { trend: "insufficient", slopePerWeek: null };
  }
  const count = points.length;
  const meanT = points.reduce((acc, point) => acc + point.t, 0) / count;
  const meanValue = points.reduce((acc, point) => acc + point.value, 0) / count;
  let numerator = 0;
  let denominator = 0;
  for (const point of points) {
    numerator += (point.t - meanT) * (point.value - meanValue);
    denominator += (point.t - meanT) ** 2;
  }
  if (denominator === 0) {
    return { trend: "stable", slopePerWeek: 0 };
  }
  const slopePerWeek = (numerator / denominator) * WEEK_MS;
  const trend =
    Math.abs(slopePerWeek) < 0.1 ? "stable" : slopePerWeek > 0 ? "up" : "down";
  return { trend, slopePerWeek };
}

export type WeeklyTrainingPoint = {
  weekStart: string;
  workouts: number;
  sets: number;
  durationSeconds: number;
};

function utcWeekStartMs(ms: number): number {
  const date = new Date(ms);
  // Monday-anchored ISO week: shift so Monday maps to 0.
  const daysSinceMonday = (date.getUTCDay() + 6) % 7;
  const midnightMs = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
  return midnightMs - daysSinceMonday * 86_400_000;
}

export function weeklyTrainingSeries(
  workouts: NativeWorkout[],
  weeks = 8,
  now: Date = new Date(),
): WeeklyTrainingPoint[] {
  const totals = new Map<
    string,
    { workouts: number; sets: number; durationSeconds: number }
  >();
  for (const workout of workouts) {
    const startedMs = new Date(workout.startedAt).getTime();
    if (!Number.isFinite(startedMs)) continue;
    const weekStart = new Date(utcWeekStartMs(startedMs))
      .toISOString()
      .slice(0, 10);
    const bucket = totals.get(weekStart) ?? {
      workouts: 0,
      sets: 0,
      durationSeconds: 0,
    };
    bucket.workouts += 1;
    bucket.durationSeconds += workout.durationSeconds;
    for (const exercise of workout.exercises) {
      bucket.sets += exercise.sets.length;
    }
    totals.set(weekStart, bucket);
  }
  const anchorWeekMs = utcWeekStartMs(now.getTime());
  const series: WeeklyTrainingPoint[] = [];
  for (let offset = weeks - 1; offset >= 0; offset -= 1) {
    const weekStart = new Date(anchorWeekMs - offset * WEEK_MS)
      .toISOString()
      .slice(0, 10);
    const bucket = totals.get(weekStart);
    series.push({
      weekStart,
      workouts: bucket?.workouts ?? 0,
      sets: bucket?.sets ?? 0,
      durationSeconds: bucket?.durationSeconds ?? 0,
    });
  }
  return series;
}

export type BmiStatus = {
  bmi: number;
  category: string;
  range: string;
  tone: string;
};

// BMI -> hue control points (0 = red, 60 = yellow, 120 = green). The healthy
// band [18.5, 25) peaks green at its centre and eases to yellow at the edges;
// adjacent under/overweight values trend yellow; severe values go red. Hue is
// interpolated linearly between adjacent anchors for a continuous gradient.
const BMI_TONE_ANCHORS: { bmi: number; hue: number }[] = [
  { bmi: 14, hue: 0 },
  { bmi: 16, hue: 25 },
  { bmi: 18.5, hue: 60 },
  { bmi: 21.75, hue: 120 },
  { bmi: 25, hue: 60 },
  { bmi: 30, hue: 20 },
  { bmi: 35, hue: 0 },
];

function bmiCategory(value: number): { category: string; range: string } {
  if (value < 18.5) return { category: "underweight", range: "below 18.5" };
  if (value < 25) return { category: "healthy weight", range: "18.5 – 24.9" };
  if (value < 30) return { category: "overweight", range: "25.0 – 29.9" };
  return { category: "obesity", range: "30.0 and above" };
}

function bmiToneHue(value: number): number {
  const first = BMI_TONE_ANCHORS[0];
  const last = BMI_TONE_ANCHORS[BMI_TONE_ANCHORS.length - 1];
  if (value <= first.bmi) return first.hue;
  if (value >= last.bmi) return last.hue;
  for (let i = 0; i < BMI_TONE_ANCHORS.length - 1; i += 1) {
    const lower = BMI_TONE_ANCHORS[i];
    const upper = BMI_TONE_ANCHORS[i + 1];
    if (value >= lower.bmi && value <= upper.bmi) {
      const t = (value - lower.bmi) / (upper.bmi - lower.bmi);
      return lower.hue + t * (upper.hue - lower.hue);
    }
  }
  return last.hue;
}

// CDC adult presentation: null unless a non-null profile for an adult
// (age >= 20) with positive height + weight. Returns the numeric BMI, the
// official category + range text, and a continuous HSL tone. Callers MUST
// surface the category/range text so colour is never the only signal.
export function bmiStatus(
  profile: NativeMacroProfile | null,
): BmiStatus | null {
  if (!profile) return null;
  if (!Number.isFinite(profile.age) || profile.age < 20) return null;
  const value = bmi(profile.weightKg, profile.heightCm);
  if (value === null) return null;
  const { category, range } = bmiCategory(value);
  const hue = Math.round(bmiToneHue(value));
  return { bmi: value, category, range, tone: `hsl(${hue}, 68%, 45%)` };
}
