import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isRecord } from "@/lib/guards";
import { rejectUnsafeLocalMutation } from "@/lib/local-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_KEY_NAME_PATTERN = /^[A-Z][A-Z0-9_]*_API_KEY$/;

function isSingleLineSecret(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\r\n]/.test(value)
  );
}

/**
 * Write-only credential sink: validated values are forwarded to the local
 * gateway and only `{ ok: true }` ever travels back to the browser.
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

  const payload: { githubToken?: string; apiKeys?: Record<string, string> } =
    {};
  if (body.githubToken !== undefined) {
    if (!isSingleLineSecret(body.githubToken)) {
      return NextResponse.json(
        {
          error: "githubToken must be a single line of at most 512 characters",
        },
        { status: 400 },
      );
    }
    payload.githubToken = body.githubToken;
  }
  if (body.apiKeys !== undefined) {
    if (!isRecord(body.apiKeys) || Object.keys(body.apiKeys).length === 0) {
      return NextResponse.json(
        { error: "apiKeys must be a non-empty object" },
        { status: 400 },
      );
    }
    const apiKeys: Record<string, string> = {};
    for (const [name, value] of Object.entries(body.apiKeys)) {
      if (!API_KEY_NAME_PATTERN.test(name)) {
        return NextResponse.json(
          { error: "API key names must look like PROVIDER_API_KEY" },
          { status: 400 },
        );
      }
      if (!isSingleLineSecret(value)) {
        return NextResponse.json(
          {
            error:
              "API key values must be a single line of at most 512 characters",
          },
          { status: 400 },
        );
      }
      apiKeys[name] = value;
    }
    payload.apiKeys = apiKeys;
  }
  if (payload.githubToken === undefined && payload.apiKeys === undefined) {
    return NextResponse.json(
      { error: "no credentials provided" },
      { status: 400 },
    );
  }

  try {
    await gatewayFetchJson<unknown>("/v1/maintainer/credentials", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
