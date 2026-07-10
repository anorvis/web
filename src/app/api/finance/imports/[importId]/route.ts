import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ importId: string }> },
) {
  try {
    const { importId } = await params;
    const result = await gatewayFetchJson(
      `/v1/finance/imports/${encodeURIComponent(importId)}`,
      { method: "DELETE" },
    );
    return NextResponse.json(result);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
