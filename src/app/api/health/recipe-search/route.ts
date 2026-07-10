import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";
  if (!query) {
    return NextResponse.json({ query, results: [] });
  }
  const params = new URLSearchParams({ q: query });
  try {
    const payload = await gatewayFetchJson(
      `/v1/integrations/recipes/search?${params.toString()}`,
    );
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(
      { query, results: [], error: "recipe search unavailable" },
      { status: 502 },
    );
  }
}
