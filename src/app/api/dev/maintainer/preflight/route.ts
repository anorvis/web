import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isRecord } from "@/lib/guards";
import { rejectUnsafeLocalMutation } from "@/lib/local-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Three sequential 10s GitHub checks upstream; leave headroom on top. */
const PREFLIGHT_TIMEOUT_MS = 45_000;

function sanitizePreflight(value: unknown) {
  const root = isRecord(value) ? value : {};
  const repos = (Array.isArray(root.repos) ? root.repos : []).flatMap(
    (entry) => {
      if (!isRecord(entry)) return [];
      const repo = typeof entry.repo === "string" ? entry.repo : null;
      const verdict = typeof entry.verdict === "string" ? entry.verdict : null;
      return repo && verdict ? [{ repo, verdict }] : [];
    },
  );
  return { ok: root.ok === true, repos };
}

export async function POST(request: Request) {
  const rejected = rejectUnsafeLocalMutation(request);
  if (rejected) return rejected;
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;
  try {
    const result = await gatewayFetchJson<unknown>("/v1/maintainer/preflight", {
      method: "POST",
      signal: AbortSignal.timeout(PREFLIGHT_TIMEOUT_MS),
    });
    return NextResponse.json(sanitizePreflight(result), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
