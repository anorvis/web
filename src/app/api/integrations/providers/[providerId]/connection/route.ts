import { NextResponse } from "next/server";
import { ProviderConnectionInputSchema } from "@/features/integrations/api/provider-schemas";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ providerId: string }> },
) {
  const { providerId } = await context.params;
  const body = await request.json().catch(() => null);
  const input = decodeUnknownResult(ProviderConnectionInputSchema, body);
  if (!input.ok)
    return NextResponse.json({ error: input.error.message }, { status: 400 });
  try {
    return NextResponse.json(
      await gatewayFetchJson(
        `/v1/providers/${encodeURIComponent(providerId)}/connection`,
        {
          method: "POST",
          body: JSON.stringify(input.value),
        },
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ providerId: string }> },
) {
  const { providerId } = await context.params;
  try {
    return NextResponse.json(
      await gatewayFetchJson(
        `/v1/providers/${encodeURIComponent(providerId)}/connection`,
        {
          method: "DELETE",
        },
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
