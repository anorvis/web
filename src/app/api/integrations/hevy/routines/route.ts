import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/hevy/routines"),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  const url = new URL(request.url);
  const routineId = url.searchParams.get("routineId");
  if (!routineId) {
    return NextResponse.json(
      { error: "routineId is required" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await gatewayFetchJson(
        `/v1/integrations/hevy/routines/${encodeURIComponent(routineId)}`,
        {
          method: "PUT",
          body: await request.text(),
        },
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
