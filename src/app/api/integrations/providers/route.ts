import { NextResponse } from "next/server";
import { ProviderDefinitionInputSchema } from "@/features/integrations/api/provider-schemas";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await gatewayFetchJson("/v1/providers"));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const input = decodeUnknownResult(ProviderDefinitionInputSchema, body);
  if (!input.ok)
    return NextResponse.json({ error: input.error.message }, { status: 400 });
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/providers", {
        method: "POST",
        body: JSON.stringify(input.value),
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
