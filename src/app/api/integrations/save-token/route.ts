import { NextResponse } from "next/server";
import { SaveTokenInputSchema } from "@/features/integrations/api/provider-schemas";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = decodeUnknownResult(SaveTokenInputSchema, body);
  if (!input.ok) {
    return NextResponse.json(
      { error: "provider and token are required" },
      { status: 400 },
    );
  }

  try {
    await gatewayFetchJson(
      `/v1/providers/${encodeURIComponent(input.value.provider)}/connection`,
      {
        method: "POST",
        body: JSON.stringify({ secrets: { token: input.value.token } }),
      },
    );
    return NextResponse.json({
      ok: true,
      note: "Stored token through anorvis-os provider secrets.",
    });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
