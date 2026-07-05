import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    await gatewayFetchJson("/v1/integrations/fatsecret/settings"),
  );
}

export async function POST(request: Request) {
  const body = await request.json();
  return NextResponse.json(
    await gatewayFetchJson("/v1/integrations/fatsecret/settings", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}
