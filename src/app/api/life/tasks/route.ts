import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await gatewayFetchJson("/v1/tasks"));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/tasks", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      { status: 201 },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.id !== "string"
  ) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await gatewayFetchJson(`/v1/tasks/${body.id}/complete`, {
        method: "PATCH",
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
