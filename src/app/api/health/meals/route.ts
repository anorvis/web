import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const meal = await gatewayFetchJson(
    id ? `/v1/health/meals/${id}` : "/v1/health/meals",
    {
      method: id ? "PUT" : "POST",
      body: JSON.stringify({
        name: String(body.name || "meal"),
        mealType: String(body.mealType || "meal"),
        loggedAt: String(body.loggedAt || new Date().toISOString()),
        calories: Number(body.calories) || 0,
        proteinGrams: Number(body.proteinGrams) || 0,
        carbsGrams: Number(body.carbsGrams) || 0,
        fatGrams: Number(body.fatGrams) || 0,
        source: "manual",
        notes: body.notes ? String(body.notes) : null,
      }),
    },
  );
  return NextResponse.json(meal);
}

export async function DELETE(request: Request) {
  const body = (await request.json()) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id.trim() : "";
  if (!id) {
    return NextResponse.json(
      { error: "Meal id is required." },
      { status: 400 },
    );
  }
  const deleted = await gatewayFetchJson(`/v1/health/meals/${id}`, {
    method: "DELETE",
  });
  return NextResponse.json(deleted);
}
