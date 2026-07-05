import { NextResponse } from "next/server";

type ExerciseResult = {
  id: string;
  name: string;
  source: string;
  muscle?: string;
  equipment?: string;
};

type FreeExerciseDbExercise = {
  name?: unknown;
  primaryMuscles?: unknown;
  equipment?: unknown;
};

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function loadExerciseIndex(): Promise<ExerciseResult[]> {
  const response = await fetch(
    "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json",
    { next: { revalidate: 86_400 } },
  );
  if (!response.ok) return [];
  const payload = (await response.json()) as unknown;
  if (!Array.isArray(payload)) return [];
  return payload.flatMap((exercise: FreeExerciseDbExercise) => {
    if (typeof exercise.name !== "string") return [];
    const muscle = Array.isArray(exercise.primaryMuscles)
      ? exercise.primaryMuscles.filter((value) => typeof value === "string")[0]
      : undefined;
    return [
      {
        id: slug(exercise.name),
        name: exercise.name.toLowerCase(),
        source: "free-exercise-db",
        muscle,
        equipment:
          typeof exercise.equipment === "string"
            ? exercise.equipment
            : undefined,
      },
    ];
  });
}

export async function GET(request: Request) {
  const query =
    new URL(request.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!query) return NextResponse.json({ query, results: [] });
  const terms = query.split(/\s+/).filter(Boolean);
  const exerciseIndex = await loadExerciseIndex();
  const results = exerciseIndex
    .filter((exercise) =>
      terms.every((term) =>
        [exercise.name, exercise.muscle, exercise.equipment]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(term)),
      ),
    )
    .slice(0, 100);
  return NextResponse.json({ query, results });
}
