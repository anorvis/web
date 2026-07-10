import { describe, expect, it } from "vitest";
import type {
  NativeMeal,
  NativeMeasurement,
} from "@/features/health/types/native-health";
import {
  bmi,
  bmrMifflinStJeor,
  calorieAdherence,
  dailyCalorieSeries,
  dailyMeasurementSeries,
  leanMass,
  measurementTrend,
  rollingAverage,
  tdee,
} from "./health-metrics";

// --- Fixtures: native-health-shaped, not loose mocks ---

function meal(overrides: Partial<NativeMeal> = {}): NativeMeal {
  return {
    id: "meal",
    name: "Meal",
    mealType: "lunch",
    loggedAt: "2026-07-09T12:00:00.000Z",
    calories: 0,
    proteinGrams: 0,
    carbsGrams: 0,
    fatGrams: 0,
    source: "manual",
    notes: null,
    items: [],
    ...overrides,
  };
}

function measurement(
  overrides: Partial<NativeMeasurement> = {},
): NativeMeasurement {
  return {
    id: "measurement",
    weightKg: null,
    bodyFatPercent: null,
    heightCm: null,
    recordedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

// --- bmi: non-positive inputs are undefined, valid inputs round to 1dp ---

describe("bmi", () => {
  const nullCases: Array<{ name: string; weightKg: number; heightCm: number }> =
    [
      { name: "zero weight", weightKg: 0, heightCm: 175 },
      { name: "zero height", weightKg: 70, heightCm: 0 },
      { name: "negative weight", weightKg: -5, heightCm: 175 },
      { name: "negative height", weightKg: 70, heightCm: -5 },
    ];

  for (const { name, weightKg, heightCm } of nullCases) {
    it(`returns null for ${name}`, () => {
      expect(bmi(weightKg, heightCm)).toBeNull();
    });
  }

  it("computes a known BMI", () => {
    // 70 / 1.75^2 = 22.857… -> rounded to one decimal
    expect(bmi(70, 175)).toBe(22.9);
  });

  it("rounds to a single decimal place", () => {
    // 80 / 1.8^2 = 24.691… -> 24.7
    expect(bmi(80, 180)).toBe(24.7);
  });
});

// --- bmrMifflinStJeor: sex-specific constant is the only branch ---

describe("bmrMifflinStJeor", () => {
  it("uses +5 for male", () => {
    // 10*80 + 6.25*180 - 5*30 + 5
    expect(
      bmrMifflinStJeor({ weightKg: 80, heightCm: 180, age: 30, sex: "male" }),
    ).toBe(1780);
  });

  it("uses -161 for female", () => {
    // 10*60 + 6.25*165 - 5*30 - 161
    expect(
      bmrMifflinStJeor({ weightKg: 60, heightCm: 165, age: 30, sex: "female" }),
    ).toBe(1320.25);
  });

  it("treats any non-female sex as the +5 male branch", () => {
    expect(
      bmrMifflinStJeor({
        weightKg: 80,
        heightCm: 180,
        age: 30,
        sex: "unspecified",
      }),
    ).toBe(1780);
  });
});

// --- tdee: known activity multipliers, unknown falls back to 1.55 ---

describe("tdee", () => {
  const cases: Array<{ name: string; level: string; expected: number }> = [
    { name: "sedentary", level: "sedentary", expected: 2400 },
    { name: "light", level: "light", expected: 2750 },
    { name: "moderate", level: "moderate", expected: 3100 },
    { name: "high", level: "high", expected: 3450 },
    {
      name: "unknown level falls back to 1.55",
      level: "astronaut",
      expected: 3100,
    },
  ];

  for (const { name, level, expected } of cases) {
    it(name, () => {
      expect(tdee(2000, level)).toBeCloseTo(expected, 6);
    });
  }
});

// --- leanMass: composition split, guarded on body-fat bounds ---

describe("leanMass", () => {
  const nullCases: Array<{ name: string; bodyFat: number | null }> = [
    { name: "null body fat", bodyFat: null },
    { name: "zero body fat", bodyFat: 0 },
    { name: "negative body fat", bodyFat: -5 },
    { name: "100% body fat", bodyFat: 100 },
    { name: "body fat above 100", bodyFat: 120 },
  ];

  for (const { name, bodyFat } of nullCases) {
    it(`returns null for ${name}`, () => {
      expect(leanMass(80, bodyFat)).toBeNull();
    });
  }

  it("splits weight into lean and fat mass", () => {
    expect(leanMass(100, 20)).toEqual({ leanKg: 80, fatKg: 20 });
  });

  it("computes composition for a fractional body-fat percent", () => {
    expect(leanMass(80, 25)).toEqual({ leanKg: 60, fatKg: 20 });
  });
});

// --- dailyCalorieSeries: UTC 30-day grouping, zero fill, ordering ---

describe("dailyCalorieSeries", () => {
  const now = new Date("2026-07-09T15:30:00.000Z");
  const meals: NativeMeal[] = [
    // Two meals on the newest UTC day; the late-UTC one must NOT roll forward.
    meal({
      id: "a",
      loggedAt: "2026-07-09T00:30:00.000Z",
      calories: 500,
      proteinGrams: 40,
      carbsGrams: 50,
      fatGrams: 10,
    }),
    meal({
      id: "b",
      loggedAt: "2026-07-09T23:45:00.000Z",
      calories: 300,
      proteinGrams: 20,
      carbsGrams: 30,
      fatGrams: 5,
    }),
    // A mid-window day.
    meal({ id: "c", loggedAt: "2026-07-01T09:00:00.000Z", calories: 600 }),
    // The oldest in-window boundary day (offset 29 == 2026-06-10).
    meal({ id: "d", loggedAt: "2026-06-10T09:00:00.000Z", calories: 400 }),
    // Just outside the 30-day window (2026-06-09) -> must be excluded.
    meal({ id: "e", loggedAt: "2026-06-09T09:00:00.000Z", calories: 999 }),
  ];

  const series = dailyCalorieSeries(meals, 30, now);
  const byDate = new Map(series.map((point) => [point.date, point]));

  it("emits exactly `days` points", () => {
    expect(series).toHaveLength(30);
  });

  it("anchors the newest point on the UTC date of `now`", () => {
    expect(series[29]?.date).toBe("2026-07-09");
  });

  it("starts on the oldest in-window UTC date", () => {
    expect(series[0]?.date).toBe("2026-06-10");
  });

  it("is ordered strictly ascending by date", () => {
    let previous = "";
    for (const point of series) {
      expect(point.date > previous).toBe(true);
      previous = point.date;
    }
  });

  it("sums every macro across meals sharing a UTC day", () => {
    expect(byDate.get("2026-07-09")).toMatchObject({
      calories: 800,
      protein: 60,
      carbs: 80,
      fat: 15,
    });
  });

  it("keeps a late-UTC meal on its own UTC day (no timezone roll-forward)", () => {
    // The 23:45Z meal contributed to 2026-07-09, never to 2026-07-10.
    expect(byDate.has("2026-07-10")).toBe(false);
    expect(byDate.get("2026-07-09")?.calories).toBe(800);
  });

  it("includes the oldest in-window day and excludes the day before it", () => {
    expect(byDate.get("2026-06-10")?.calories).toBe(400);
    expect(byDate.has("2026-06-09")).toBe(false);
  });

  it("zero-fills days with no logged meals", () => {
    expect(byDate.get("2026-07-08")).toEqual({
      date: "2026-07-08",
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("never surfaces calories from meals outside the window", () => {
    const total = series.reduce((acc, point) => acc + point.calories, 0);
    // 800 (07-09) + 600 (07-01) + 400 (06-10); the 999 meal is excluded.
    expect(total).toBe(1800);
    expect(series.some((point) => point.calories === 999)).toBe(false);
  });
});

// --- rollingAverage: expanding window at the head, full window after ---

describe("rollingAverage", () => {
  it("expands the window until it reaches full size", () => {
    expect(rollingAverage([1, 2, 3, 4, 5], 3)).toEqual([1, 1.5, 2, 3, 4]);
  });

  it("uses the default window of 7 when unspecified", () => {
    // Fewer values than the default window -> every point is a partial average.
    expect(rollingAverage([2, 4, 6])).toEqual([2, 3, 4]);
  });

  it("returns an empty array for no values", () => {
    expect(rollingAverage([], 3)).toEqual([]);
  });

  it("returns a detached copy for a non-positive window", () => {
    const values = [1, 2, 3];
    const result = rollingAverage(values, 0);
    expect(result).toEqual([1, 2, 3]);
    expect(result).not.toBe(values);
  });
});

// --- calorieAdherence: clamped percentage, guarded on zero target ---

describe("calorieAdherence", () => {
  const nullCases: Array<{ name: string; target: number }> = [
    { name: "zero target", target: 0 },
    { name: "negative target", target: -500 },
  ];

  for (const { name, target } of nullCases) {
    it(`returns null for ${name}`, () => {
      expect(calorieAdherence(1500, target)).toBeNull();
    });
  }

  it("returns the raw ratio as a percentage below target", () => {
    expect(calorieAdherence(1500, 2000)).toBe(75);
  });

  it("clamps overshoot to 100%", () => {
    expect(calorieAdherence(2500, 2000)).toBe(100);
  });

  it("clamps negative intake to 0%", () => {
    expect(calorieAdherence(-200, 2000)).toBe(0);
  });
});

// --- dailyMeasurementSeries: one latest reading per UTC day, sorted ascending ---

describe("dailyMeasurementSeries", () => {
  it("keeps the latest reading per UTC day regardless of input order", () => {
    const history = [
      measurement({
        id: "noon",
        recordedAt: "2026-01-01T12:00:00.000Z",
        weightKg: 71,
      }),
      measurement({
        id: "evening",
        recordedAt: "2026-01-01T20:00:00.000Z",
        weightKg: 72,
      }),
      measurement({
        id: "morning",
        recordedAt: "2026-01-01T08:00:00.000Z",
        weightKg: 70,
      }),
    ];
    expect(dailyMeasurementSeries(history, "weightKg")).toEqual([
      { date: "2026-01-01", value: 72 },
    ]);
  });

  it("excludes null values and unparseable timestamps", () => {
    const history = [
      measurement({
        id: "valid",
        recordedAt: "2026-01-01T08:00:00.000Z",
        weightKg: 70,
      }),
      measurement({
        id: "null-value",
        recordedAt: "2026-01-02T08:00:00.000Z",
        weightKg: null,
      }),
      measurement({ id: "bad-date", recordedAt: "not-a-date", weightKg: 99 }),
    ];
    expect(dailyMeasurementSeries(history, "weightKg")).toEqual([
      { date: "2026-01-01", value: 70 },
    ]);
  });

  it("assigns each reading to its own UTC day at the day boundary", () => {
    const history = [
      measurement({
        id: "late",
        recordedAt: "2026-01-01T23:30:00.000Z",
        weightKg: 70,
      }),
      measurement({
        id: "early",
        recordedAt: "2026-01-02T00:30:00.000Z",
        weightKg: 71,
      }),
    ];
    expect(dailyMeasurementSeries(history, "weightKg")).toEqual([
      { date: "2026-01-01", value: 70 },
      { date: "2026-01-02", value: 71 },
    ]);
  });

  it("sorts distinct days ascending regardless of input order", () => {
    const history = [
      measurement({
        id: "mar",
        recordedAt: "2026-03-05T08:00:00.000Z",
        weightKg: 73,
      }),
      measurement({
        id: "jan",
        recordedAt: "2026-01-02T08:00:00.000Z",
        weightKg: 70,
      }),
      measurement({
        id: "feb",
        recordedAt: "2026-02-10T08:00:00.000Z",
        weightKg: 71,
      }),
    ];
    expect(
      dailyMeasurementSeries(history, "weightKg").map((point) => point.date),
    ).toEqual(["2026-01-02", "2026-02-10", "2026-03-05"]);
  });
});

// --- measurementTrend: slope over the daily series; same-day sets are insufficient ---

describe("measurementTrend", () => {
  it("reports insufficient with fewer than two valid points", () => {
    const history = [
      measurement({ recordedAt: "2026-01-01T00:00:00.000Z", weightKg: 70 }),
    ];
    expect(measurementTrend(history, "weightKg")).toEqual({
      trend: "insufficient",
      slopePerWeek: null,
    });
  });

  it("excludes null-valued points, dropping below the two-point threshold", () => {
    const history = [
      measurement({ recordedAt: "2026-01-01T00:00:00.000Z", weightKg: 70 }),
      measurement({ recordedAt: "2026-01-08T00:00:00.000Z", weightKg: null }),
      measurement({ recordedAt: "2026-01-15T00:00:00.000Z", weightKg: null }),
    ];
    expect(measurementTrend(history, "weightKg")).toEqual({
      trend: "insufficient",
      slopePerWeek: null,
    });
  });

  it("reports a flat series as stable with zero slope", () => {
    const history = [
      measurement({ recordedAt: "2026-01-01T00:00:00.000Z", weightKg: 70 }),
      measurement({ recordedAt: "2026-01-08T00:00:00.000Z", weightKg: 70 }),
    ];
    expect(measurementTrend(history, "weightKg")).toEqual({
      trend: "stable",
      slopePerWeek: 0,
    });
  });

  it("collapses identical timestamps to one day, reported as insufficient", () => {
    const history = [
      measurement({ recordedAt: "2026-01-01T00:00:00.000Z", weightKg: 70 }),
      measurement({ recordedAt: "2026-01-01T00:00:00.000Z", weightKg: 90 }),
    ];
    expect(measurementTrend(history, "weightKg")).toEqual({
      trend: "insufficient",
      slopePerWeek: null,
    });
  });

  it("collapses multiple same-day readings so a single day is insufficient", () => {
    const history = [
      measurement({ recordedAt: "2026-01-01T08:00:00.000Z", weightKg: 70 }),
      measurement({ recordedAt: "2026-01-01T20:00:00.000Z", weightKg: 90 }),
    ];
    expect(measurementTrend(history, "weightKg")).toEqual({
      trend: "insufficient",
      slopePerWeek: null,
    });
  });

  it("reports an upward trend at ~+1 unit per week", () => {
    const history = [
      measurement({ recordedAt: "2026-01-01T00:00:00.000Z", weightKg: 70 }),
      measurement({ recordedAt: "2026-01-08T00:00:00.000Z", weightKg: 71 }),
    ];
    const result = measurementTrend(history, "weightKg");
    expect(result.trend).toBe("up");
    expect(result.slopePerWeek).toBeCloseTo(1, 6);
  });

  it("reports a downward trend, ignoring interleaved null points", () => {
    const history = [
      measurement({ recordedAt: "2026-01-01T00:00:00.000Z", weightKg: 71 }),
      measurement({ recordedAt: "2026-01-04T00:00:00.000Z", weightKg: null }),
      measurement({ recordedAt: "2026-01-08T00:00:00.000Z", weightKg: 70 }),
    ];
    const result = measurementTrend(history, "weightKg");
    expect(result.trend).toBe("down");
    expect(result.slopePerWeek).toBeCloseTo(-1, 6);
  });

  it("resolves the trend against the requested key", () => {
    const history = [
      measurement({
        recordedAt: "2026-01-01T00:00:00.000Z",
        bodyFatPercent: 20,
      }),
      measurement({
        recordedAt: "2026-01-08T00:00:00.000Z",
        bodyFatPercent: 22,
      }),
    ];
    const result = measurementTrend(history, "bodyFatPercent");
    expect(result.trend).toBe("up");
    expect(result.slopePerWeek).toBeCloseTo(2, 6);
  });
});
