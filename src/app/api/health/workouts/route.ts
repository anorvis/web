import { NextResponse } from "next/server";
import { readWorkspaceDocument } from "@/lib/os-workspace-data";
import { isHealthSnapshot } from "@/lib/workspace-type-guards";

export const runtime = "nodejs";

function detailDocumentId(id: string): string {
  return `web-health-workout-${encodeURIComponent(id)}`;
}

function isWorkoutDetail(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim();

  if (id) {
    const detail = await readWorkspaceDocument({
      kind: "summary",
      id: detailDocumentId(id),
      isValue: isWorkoutDetail,
    });
    if (!detail) {
      return NextResponse.json({ error: "workout not found" }, { status: 404 });
    }
    return NextResponse.json(detail);
  }

  const snapshot = await readWorkspaceDocument({
    kind: "summary",
    id: "web-health-snapshot",
    isValue: isHealthSnapshot,
  });
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const workouts =
    snapshot?.recentWorkouts ?? snapshot?.firstPageWorkouts ?? [];

  return NextResponse.json({
    workouts: workouts.slice(offset, offset + limit),
    total: snapshot?.totalWorkouts ?? workouts.length,
  });
}
