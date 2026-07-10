import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/snaptrade/sync", {
        method: "POST",
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
