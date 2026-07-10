import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    await gatewayFetchJson("/v1/integrations/hevy/exercise-templates"),
  );
}
