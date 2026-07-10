import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currency = new URL(request.url).searchParams
    .get("currency")
    ?.trim()
    .toUpperCase();
  if (!currency || !/^[A-Z]{3}$/.test(currency)) {
    return NextResponse.json(
      { error: "currency query parameter is required" },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(
      await gatewayFetchJson(
        `/v1/finance/dashboard?currency=${encodeURIComponent(currency)}`,
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
