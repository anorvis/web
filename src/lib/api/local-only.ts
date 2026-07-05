import { NextResponse } from "next/server";

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

export function rejectNonLocalRequest(request: Request): NextResponse | null {
  const host = request.headers.get("host")?.split(":")[0]?.toLowerCase();
  if (!host || localHosts.has(host)) return null;
  return NextResponse.json(
    { error: "This endpoint is only available from a local host." },
    { status: 403 },
  );
}
