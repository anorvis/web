import { NextResponse } from "next/server";
import { HealthRequestBodySchema } from "@/features/health/api/schemas";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const decoded = decodeUnknownResult(
    HealthRequestBodySchema,
    await request.json().catch(() => null),
  );
  const body = decoded.ok ? decoded.value : {};
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json(
      { error: "Recipe id is required." },
      { status: 400 },
    );
  }
  const recipe = await gatewayFetchJson(`/v1/health/recipes/${id}/favorite`, {
    method: "POST",
    body: JSON.stringify({ isFavorite: body.isFavorite === true }),
  });
  return NextResponse.json(recipe);
}
