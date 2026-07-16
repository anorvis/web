import { NextResponse } from "next/server";
import {
  isDirectLoopbackRequest,
  isLoopbackHost,
} from "@/lib/direct-loopback-request";

/**
 * CSRF guard for local-only mutating proxies. Loopback binding alone does not
 * stop a hostile public page from firing CORS-simple POSTs (text/plain JSON)
 * at localhost, so mutations additionally require a present loopback Origin
 * and a real application/json body — both absent from cross-site simple
 * requests.
 *
 * Returns the rejection response, or null when the request may proceed.
 */
export function rejectUnsafeLocalMutation(
  request: Request,
): NextResponse | null {
  if (!isDirectLoopbackRequest(request)) {
    return NextResponse.json({ error: "local only" }, { status: 403 });
  }

  const origin = request.headers.get("origin");
  let originHost: string | null = null;
  if (origin) {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        originHost = parsed.hostname;
      }
    } catch {
      originHost = null;
    }
  }
  if (!originHost || !isLoopbackHost(originHost)) {
    return NextResponse.json(
      { error: "cross-origin request rejected" },
      { status: 403 },
    );
  }

  const mediaType = (request.headers.get("content-type") ?? "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (mediaType !== "application/json") {
    return NextResponse.json(
      { error: "content-type must be application/json" },
      { status: 415 },
    );
  }

  return null;
}
