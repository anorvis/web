import { type NextRequest, NextResponse } from "next/server";
import { isAnorvisOsUp } from "@/lib/anorvis-os-status";
import { hostnameFromHeader } from "@/lib/request-host";

const safeMethods = new Set(["GET", "HEAD", "OPTIONS"]);
const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);

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
  const isLocalHost = !!host && localHosts.has(host);

  if (isLocalHost && safeMethods.has(request.method)) {
    return NextResponse.next();
  }

  if (!isLocalHost && !(await isAnorvisOsUp())) {
    if (pathname.startsWith("/api/")) return lockedResponse();
    if (!safeMethods.has(request.method)) return lockedResponse();
    if (pathname === "/") return NextResponse.next();

    return new NextResponse("Not found", {
      status: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
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
