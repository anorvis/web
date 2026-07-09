import { NextResponse } from "next/server";
import {
  ExerciseBodySchema,
  ExerciseSetBodySchema,
  ExercisesJsonSchema,
  HealthRequestBodySchema,
} from "@/features/health/api/schemas";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

function parseExercises(value: unknown) {
  if (typeof value !== "string") return [];
  const decoded = decodeUnknownResult(ExercisesJsonSchema, value);
  if (!decoded.ok) return [];
  return decoded.value.flatMap((item) => {
    const record = decodeUnknownResult(ExerciseBodySchema, item);
    if (!record.ok) return [];
    const title = String(record.value.title || "").trim();
    if (!title) return [];
    const parsedSets = Array.isArray(record.value.sets)
      ? record.value.sets
      : [];
    const sets = parsedSets.flatMap((set) => {
      const setRecord = decodeUnknownResult(ExerciseSetBodySchema, set);
      if (!setRecord.ok) return [];
      return [
        {
          setType: "normal",
          weightKg: setRecord.value.weightKg
            ? Number(setRecord.value.weightKg)
            : null,
          reps: setRecord.value.reps ? Number(setRecord.value.reps) : null,
        },
      ];
    });
    return [
      {
        title,
        sets: sets.length
          ? sets
          : [
              {
                setType: "normal",
                weightKg: record.value.weightKg
                  ? Number(record.value.weightKg)
                  : null,
                reps: record.value.reps ? Number(record.value.reps) : null,
              },
            ],
      },
    ];
  });
}

export async function POST(request: Request) {
  const decoded = decodeUnknownResult(
    HealthRequestBodySchema,
    await request.json().catch(() => null),
  );
  const body = decoded.ok ? decoded.value : {};
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const workout = await gatewayFetchJson(
    id ? `/v1/health/workouts/${id}` : "/v1/health/workouts",
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({
        title: String(body.title || "workout"),
        startedAt: String(body.startedAt || new Date().toISOString()),
        durationSeconds: (Number(body.durationMinutes) || 45) * 60,
        notes: body.notes ? String(body.notes) : null,
        source: "manual",
        exercises: parseExercises(body.exercisesJson),
      }),
    },
  );
  return NextResponse.json(workout);
}
