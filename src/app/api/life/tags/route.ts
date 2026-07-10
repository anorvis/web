import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await gatewayFetchJson("/v1/life/tags"));
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    typeof body.name !== "string" ||
    !body.name.trim()
  ) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/life/tags", {
        method: "POST",
        body: JSON.stringify({
          name: body.name.trim(),
          color: typeof body.color === "string" ? body.color : undefined,
        }),
      }),
      { status: 201 },
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
