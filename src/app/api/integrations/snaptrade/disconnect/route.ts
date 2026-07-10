import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

// Clears Anorvis-stored SnapTrade credentials only. SnapTrade brokerage
// connections are untouched by this call.
export async function DELETE() {
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/snaptrade/disconnect", {
        method: "DELETE",
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
