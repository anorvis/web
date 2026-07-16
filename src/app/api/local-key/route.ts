import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { isDirectLoopbackRequest } from "@/lib/direct-loopback-request";

// Machine-local trust: hand the owner setup key to the browser session running
// on this machine so sign-in is silent. Refused for any non-loopback request.
export function GET(request: Request) {
  if (!isDirectLoopbackRequest(request)) {
    return NextResponse.json({ error: "local only" }, { status: 403 });
  }
  // Resolved per request so the home directory is read at call time.
  const keyPath = join(homedir(), ".anorvis", "convex-setup-key");
  let key: string;
  try {
    key = readFileSync(keyPath, "utf8").trim();
  } catch {
    return NextResponse.json({ error: "no local key" }, { status: 404 });
  }
  if (!key) {
    return NextResponse.json({ error: "no local key" }, { status: 404 });
  }
  return NextResponse.json(
    { key },
    { headers: { "cache-control": "no-store" } },
  );
}
