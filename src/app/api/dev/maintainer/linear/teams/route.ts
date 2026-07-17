import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isDirectLoopbackRequest } from "@/lib/direct-loopback-request";
import { isRecord } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TEAMS = 200;

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/** Team id/name/key only; workspace metadata stays on the gateway. */
export async function GET(request: Request) {
  if (!isDirectLoopbackRequest(request)) {
    return NextResponse.json({ error: "local only" }, { status: 403 });
  }
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;
  try {
    const result = await gatewayFetchJson<unknown>(
      "/v1/maintenance/linear/teams",
    );
    const root = isRecord(result) ? result : {};
    const teams = (Array.isArray(root.teams) ? root.teams : [])
      .slice(0, MAX_TEAMS)
      .flatMap((entry) => {
        if (!isRecord(entry)) return [];
        const id = text(entry.id);
        const name = text(entry.name);
        if (!id || !name) return [];
        return [{ id, name, key: text(entry.key) ?? "" }];
      });
    return NextResponse.json(
      { teams },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
