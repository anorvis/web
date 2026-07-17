import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { convexApi } from "@/lib/convex-functions";
import { convexDeploymentUrl } from "@/lib/convex-url";
import { isRecord } from "@/lib/guards";

function ownerOnlyResponse(): NextResponse {
  return NextResponse.json(
    { error: "owner session required" },
    { status: 403 },
  );
}

function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)$/i.exec(header.trim());
  return match?.[1] ?? null;
}

/**
 * Owner gate for /api/dev/*. The browser attaches its Convex session JWT and
 * this guard resolves the workspace role through the same
 * `platform/workspace:viewer` query the client renders from. Anything short
 * of a verified "owner" role — missing or malformed token, unreachable
 * deployment, thrown query, unknown role — fails closed with 403. Loopback
 * and CSRF guards still run first; this adds the identity layer on top.
 *
 * Returns the rejection response, or null when the session may proceed.
 */
export async function rejectNonOwnerSession(
  request: Request,
): Promise<NextResponse | null> {
  const token = bearerToken(request);
  if (!token) return ownerOnlyResponse();
  try {
    const client = new ConvexHttpClient(convexDeploymentUrl);
    client.setAuth(token);
    const viewer = await client.query(convexApi.workspaces.viewer, {});
    return isRecord(viewer) && viewer.role === "owner"
      ? null
      : ownerOnlyResponse();
  } catch {
    return ownerOnlyResponse();
  }
}
