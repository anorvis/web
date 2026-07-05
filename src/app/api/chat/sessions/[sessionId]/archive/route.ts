import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await context.params;
    return NextResponse.json(
      await gatewayFetchJson(
        `/v1/chat/sessions/${encodeURIComponent(sessionId)}/archive`,
        { method: "PATCH", body: JSON.stringify({}) },
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
