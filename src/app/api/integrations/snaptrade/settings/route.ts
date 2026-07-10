import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/snaptrade/settings"),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/snaptrade/settings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
