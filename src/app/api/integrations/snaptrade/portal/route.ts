import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

// Opens a read-only SnapTrade Connection Portal. The connection type is locked
// to `read` in anorvis-os; this proxy forwards only what the client sends and
// never injects a connection type.
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/snaptrade/portal", {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
