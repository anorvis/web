import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

const emptyPayload = (query: string, provider: string) => ({
  query,
  provider,
  providers: {},
  results: [],
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const provider = url.searchParams.get("provider") ?? "all";
  if (!query) {
    return NextResponse.json(emptyPayload(query, provider));
  }
  const params = new URLSearchParams({ q: query, provider });
  try {
    const payload = await gatewayFetchJson(
      `/v1/integrations/food/search?${params.toString()}`,
    );
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json(emptyPayload(query, provider));
  }
}
