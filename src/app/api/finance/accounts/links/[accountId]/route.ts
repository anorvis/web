import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await context.params;
  try {
    const result = await gatewayFetchJson(
      `/v1/finance/accounts/links/${encodeURIComponent(accountId)}`,
      { method: "DELETE" },
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
