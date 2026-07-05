import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.start !== "string" ||
    typeof body.end !== "string"
  ) {
    return NextResponse.json(
      { error: "start and end are required" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await gatewayFetchJson(
        `/v1/tasks/sessions/${encodeURIComponent(sessionId)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ start: body.start, end: body.end }),
        },
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
