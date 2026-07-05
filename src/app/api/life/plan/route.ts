import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await gatewayFetchJson("/v1/tasks/plan"));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
