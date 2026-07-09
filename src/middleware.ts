import { type NextRequest, NextResponse } from "next/server";
import { isAnorvisProdRuntime } from "@/lib/anorvis-runtime";
import { hostnameFromHeader } from "@/lib/request-host";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const localHosts: Record<string, true> = {
  "::1": true,
  "127.0.0.1": true,
  localhost: true,
};

function lockedResponse(status = 403) {
  return NextResponse.json(
    {
      error:
        "The public anorvis surface is locked. Run locally to access the workspace.",
    },
    { status },
  );
}

export async function middleware(request: NextRequest) {
  const hostHeader = request.headers.get("host");
  const pathname = request.nextUrl.pathname;
  const host = hostnameFromHeader(hostHeader);
  const isLocalHost = !!host && localHosts[host];
  const isProdRuntime = isAnorvisProdRuntime();

  if (isProdRuntime) {
    return pathname === "/"
      ? NextResponse.next()
      : new Response("Not found", { status: 404 });
  }

  if (!isProdRuntime && isLocalHost && safeMethods.has(request.method)) {
    return NextResponse.next();
  }

  if (safeMethods.has(request.method)) return NextResponse.next();

  if (!isLocalHost) {
    return lockedResponse();
  }
  const origin = hostnameFromHeader(request.headers.get("origin"));
  if (origin && origin !== host) {
    return NextResponse.json(
      { error: "Cross-origin mutating API requests are not allowed." },
      { status: 403 },
    );
  }

  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    return NextResponse.json(
      { error: "Cross-site mutating API requests are not allowed." },
      { status: 403 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
