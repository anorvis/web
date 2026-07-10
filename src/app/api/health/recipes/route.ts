import { NextResponse } from "next/server";
import { HealthRequestBodySchema } from "@/features/health/api/schemas";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await gatewayFetchJson("/v1/health/recipes"));
}

export async function POST(request: Request) {
  const decoded = decodeUnknownResult(
    HealthRequestBodySchema,
    await request.json().catch(() => null),
  );
  const body = decoded.ok ? decoded.value : {};
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const recipe = await gatewayFetchJson(
    id ? `/v1/health/recipes/${id}` : "/v1/health/recipes",
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(body),
    },
  );
  return NextResponse.json(recipe);
}

export async function DELETE(request: Request) {
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
  const deleted = await gatewayFetchJson(`/v1/health/recipes/${id}`, {
    method: "DELETE",
  });
  return NextResponse.json(deleted);
}
