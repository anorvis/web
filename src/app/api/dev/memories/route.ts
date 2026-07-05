import { type NextRequest, NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MEMORY_KINDS = new Set([
  "decisions",
  "episodic",
  "fact",
  "note",
  "preference",
  "procedural",
  "profile",
  "semantic",
  "summary",
]);

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q")?.trim() ?? "";
    const kind = searchParams.get("kind")?.trim() ?? "";
    const view = searchParams.get("view")?.trim() ?? "";
    const kindSuffix = MEMORY_KINDS.has(kind)
      ? `kind=${encodeURIComponent(kind)}`
      : "";

    if (view === "graph") {
      return NextResponse.json(
        await gatewayFetchJson<unknown>("/v1/memory/graph"),
      );
    }

    if (query) {
      const params = new URLSearchParams({ q: query });
      if (MEMORY_KINDS.has(kind)) params.set("kind", kind);
      return NextResponse.json(
        await gatewayFetchJson<unknown[]>(`/v1/memory/search?${params}`),
      );
    }

    const suffix = kindSuffix ? `?${kindSuffix}` : "";
    return NextResponse.json(
      await gatewayFetchJson<unknown[]>(`/v1/memory/documents${suffix}`),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
