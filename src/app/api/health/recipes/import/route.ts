import { NextResponse } from "next/server";
import { RecipeImportBodySchema } from "@/features/health/api/schemas";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const decoded = decodeUnknownResult(
    RecipeImportBodySchema,
    await request.json().catch(() => null),
  );
  const url = decoded.ok ? decoded.value.url.trim() : "";
  if (!url) {
    return NextResponse.json(
      { error: "Recipe url is required." },
      { status: 400 },
    );
  }
  try {
    const recipe = await gatewayFetchJson("/v1/health/recipes/import", {
      method: "POST",
      body: JSON.stringify({ url }),
    });
    return NextResponse.json(recipe, { status: 201 });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
