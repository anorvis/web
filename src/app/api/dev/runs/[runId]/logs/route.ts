import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
) {
  try {
    const { runId } = await context.params;
    return NextResponse.json(
      await gatewayFetchJson<unknown>(
        `/v1/runs/${encodeURIComponent(runId)}/logs`,
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
