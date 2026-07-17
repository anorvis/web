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
  try {
    const result = await gatewayFetchJson<unknown>(
      "/v1/maintainer/vault-login",
      { method: "POST" },
    );
    const root = isRecord(result) ? result : {};
    return NextResponse.json(
      {
        ok: root.ok === true,
        error: typeof root.error === "string" ? root.error : null,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
