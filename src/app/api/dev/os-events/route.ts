import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(
      await gatewayFetchJson<unknown[]>("/v1/observability/events?limit=200"),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
