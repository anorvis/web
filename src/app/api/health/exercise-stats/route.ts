import { NextResponse } from "next/server";
import { readWorkspaceDocument } from "@/lib/os-workspace-data";
import { isExerciseStats } from "@/lib/workspace-type-guards";

export const runtime = "nodejs";

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(request: Request) {
  const exercise = new URL(request.url).searchParams.get("exercise")?.trim();
  if (!exercise) {
    return NextResponse.json(
      { error: "exercise is required" },
      { status: 400 },
    );
  }

  const stats = await readWorkspaceDocument({
    kind: "summary",
    id: `web-health-exercise-${slug(exercise)}`,
    isValue: isExerciseStats,
  });

  return NextResponse.json(
    stats ?? {
      exercise,
      trend: "insufficient",
      e1rmSeries: [],
      volumeSeries: [],
      latestSets: [],
    },
  );
}
