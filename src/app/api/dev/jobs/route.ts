import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await gatewayFetchJson<unknown[]>("/jobs"));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
