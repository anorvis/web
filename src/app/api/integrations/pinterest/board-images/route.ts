import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(
    await gatewayFetchJson(
      `/v1/integrations/pinterest/board-images?${url.searchParams.toString()}`,
    ),
  );
}
