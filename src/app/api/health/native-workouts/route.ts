import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

function parseExercises(value: unknown) {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (typeof item !== "object" || item === null) return [];
      const record = item as Record<string, unknown>;
      const title = String(record.title || "").trim();
      if (!title) return [];
      const parsedSets = Array.isArray(record.sets) ? record.sets : [];
      const sets = parsedSets.flatMap((set) => {
        if (typeof set !== "object" || set === null) return [];
        const setRecord = set as Record<string, unknown>;
        return [
          {
            setType: "normal",
            weightKg: setRecord.weightKg ? Number(setRecord.weightKg) : null,
            reps: setRecord.reps ? Number(setRecord.reps) : null,
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
                  weightKg: record.weightKg ? Number(record.weightKg) : null,
                  reps: record.reps ? Number(record.reps) : null,
                },
              ],
        },
      ];
    });
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
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
