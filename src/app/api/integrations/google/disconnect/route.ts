import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/google/disconnect", {
        method: "POST",
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
