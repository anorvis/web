import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isRecord } from "@/lib/guards";
import { rejectUnsafeLocalMutation } from "@/lib/local-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TICKET_ID_PATTERN = /^[A-Za-z0-9._-]{1,128}$/;

/**
 * Owner triage for maintenance tickets. Only the outcome and an optional
 * bounded warning travel back; the refreshed ticket itself is re-fetched
 * through the sanitized overview proxy.
 */
export async function POST(request: Request) {
  const rejected = rejectUnsafeLocalMutation(request);
  if (rejected) return rejected;
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  if (typeof body.id !== "string" || !TICKET_ID_PATTERN.test(body.id)) {
    return NextResponse.json(
      { error: "id must be a ticket identifier" },
      { status: 400 },
    );
  }
  if (body.action !== "approve" && body.action !== "dismiss") {
    return NextResponse.json(
      { error: "action must be approve or dismiss" },
      { status: 400 },
    );
  }
  try {
    const result = await gatewayFetchJson<unknown>(
      `/v1/maintenance/tickets/${encodeURIComponent(body.id)}/triage`,
      { method: "POST", body: JSON.stringify({ action: body.action }) },
    );
    const root = isRecord(result) ? result : {};
    const warning =
      typeof root.warning === "string" && root.warning.trim().length > 0
        ? root.warning.trim().slice(0, 300)
        : null;
    return NextResponse.json(warning ? { ok: true, warning } : { ok: true }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
