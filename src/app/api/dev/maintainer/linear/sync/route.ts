import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isRecord } from "@/lib/guards";
import { rejectUnsafeLocalMutation } from "@/lib/local-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function count(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

export async function POST(request: Request) {
  const rejected = rejectUnsafeLocalMutation(request);
  if (rejected) return rejected;
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;
  try {
    const result = await gatewayFetchJson<unknown>(
      "/v1/maintenance/linear/sync",
      { method: "POST", body: JSON.stringify({}) },
    );
    const root = isRecord(result) ? result : {};
    const error =
      typeof root.error === "string" && root.error.trim().length > 0
        ? root.error.trim().slice(0, 300)
        : null;
    return NextResponse.json(
      {
        ok: root.ok === true,
        pushed: count(root.pushed),
        updated: count(root.updated),
        error,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
