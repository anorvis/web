import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { rejectNonOwnerSession } from "@/lib/dev-owner-guard";
import { isLoopbackHost } from "@/lib/direct-loopback-request";
import { isRecord } from "@/lib/guards";
import { rejectUnsafeLocalMutation } from "@/lib/local-mutation-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Starts the Linear OAuth flow. The browser never chooses where the callback
 * lands: returnTo is derived here from the (already loopback-verified)
 * request origin, so the gateway only ever redirects back to this dev page.
 */
export async function POST(request: Request) {
  const rejected = rejectUnsafeLocalMutation(request);
  if (rejected) return rejected;
  const denied = await rejectNonOwnerSession(request);
  if (denied) return denied;

  let returnTo: string | null = null;
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    if (
      (origin.protocol === "http:" || origin.protocol === "https:") &&
      isLoopbackHost(origin.hostname)
    ) {
      returnTo = `${origin.origin}/dev`;
    }
  } catch {
    returnTo = null;
  }
  if (!returnTo) {
    return NextResponse.json(
      { error: "request origin must be a loopback address" },
      { status: 400 },
    );
  }

  try {
    const result = await gatewayFetchJson<unknown>(
      "/v1/maintenance/linear/authorize",
      { method: "POST", body: JSON.stringify({ returnTo }) },
    );
    const root = isRecord(result) ? result : {};
    const authorizationUrl =
      typeof root.authorizationUrl === "string" &&
      root.authorizationUrl.startsWith("https://linear.app/oauth/authorize")
        ? root.authorizationUrl
        : null;
    if (!authorizationUrl) {
      return NextResponse.json(
        { error: "the gateway did not return a linear sign-in url" },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { authorizationUrl },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
