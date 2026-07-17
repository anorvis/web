import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isRecord } from "@/lib/guards";
import { rejectUnsafeLocalMutation } from "@/lib/local-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rejected = rejectUnsafeLocalMutation(request);
  if (rejected) return rejected;
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body) || typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 },
    );
  }
  try {
    await gatewayFetchJson<unknown>("/v1/maintainer/settings", {
      method: "POST",
      body: JSON.stringify({ enabled: body.enabled }),
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
