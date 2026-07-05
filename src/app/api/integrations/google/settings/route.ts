import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    await gatewayFetchJson("/v1/integrations/google/settings"),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(
    await gatewayFetchJson("/v1/integrations/google/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}
