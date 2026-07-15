import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const overview = await gatewayFetchJson<unknown>(
      "/v1/maintenance/overview",
    );
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
