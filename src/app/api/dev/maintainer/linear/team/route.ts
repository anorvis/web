import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isRecord } from "@/lib/guards";
import { rejectUnsafeLocalMutation } from "@/lib/local-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TEAM_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

export async function POST(request: Request) {
  const rejected = rejectUnsafeLocalMutation(request);
  if (rejected) return rejected;
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  if (
    !isRecord(body) ||
    typeof body.teamId !== "string" ||
    !TEAM_ID_PATTERN.test(body.teamId)
  ) {
    return NextResponse.json(
      { error: "teamId must be a linear team identifier" },
      { status: 400 },
    );
  }
  try {
    const result = await gatewayFetchJson<unknown>(
      "/v1/maintenance/linear/team",
      { method: "POST", body: JSON.stringify({ teamId: body.teamId }) },
    );
    const root = isRecord(result) ? result : {};
    const teamName =
      typeof root.teamName === "string" && root.teamName.trim().length > 0
        ? root.teamName.trim()
        : null;
    return NextResponse.json(
      { ok: true, teamName },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
