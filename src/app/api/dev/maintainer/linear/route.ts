import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isDirectLoopbackRequest } from "@/lib/direct-loopback-request";
import { isRecord } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Connection facts only: whether Linear is linked and which team is
 * selected. Tokens, client secrets, and API keys never reach the browser.
 */
export async function GET(request: Request) {
  if (!isDirectLoopbackRequest(request)) {
    return NextResponse.json({ error: "local only" }, { status: 403 });
  }
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;
  try {
    const status = await gatewayFetchJson<unknown>("/v1/maintenance/linear");
    const root = isRecord(status) ? status : {};
    return NextResponse.json(
      {
        connected: root.connected === true,
        auth:
          root.auth === "oauth" || root.auth === "api_key" ? root.auth : null,
        teamId: text(root.teamId),
        teamName: text(root.teamName),
        hasClientCredentials: root.hasClientCredentials === true,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
