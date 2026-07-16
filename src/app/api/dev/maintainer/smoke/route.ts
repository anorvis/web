import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { isRecord } from "@/lib/guards";
import { rejectUnsafeLocalMutation } from "@/lib/local-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** The sandbox smoke run boots a container; allow the contracted 240s. */
const SMOKE_TIMEOUT_MS = 240_000;
const OUTPUT_LIMIT = 2_000;

export async function POST(request: Request) {
  const rejected = rejectUnsafeLocalMutation(request);
  if (rejected) return rejected;
  try {
    const result = await gatewayFetchJson<unknown>("/v1/maintainer/smoke", {
      method: "POST",
      signal: AbortSignal.timeout(SMOKE_TIMEOUT_MS),
    });
    const root = isRecord(result) ? result : {};
    return NextResponse.json(
      {
        ok: root.ok === true,
        output:
          typeof root.output === "string"
            ? root.output.slice(0, OUTPUT_LIMIT)
            : "",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
