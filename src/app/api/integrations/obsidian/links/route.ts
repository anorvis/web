import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/obsidian/links", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/obsidian/links", {
        method: "DELETE",
        body: JSON.stringify(body),
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
