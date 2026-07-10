import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await params;
    const body = await request.json();
    const result = await gatewayFetchJson(
      `/v1/finance/accounts/${encodeURIComponent(accountId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(body),
      },
    );
    return NextResponse.json(result);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ accountId: string }> },
) {
  try {
    const { accountId } = await params;
    const result = await gatewayFetchJson(
      `/v1/finance/accounts/${encodeURIComponent(accountId)}`,
      { method: "DELETE" },
    );
    return NextResponse.json(result);
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
