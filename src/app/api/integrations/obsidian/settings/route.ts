import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = new URLSearchParams();
  const vaultPath = url.searchParams.get("vaultPath");
  if (vaultPath) params.set("vaultPath", vaultPath);
  const suffix = params.size > 0 ? `?${params.toString()}` : "";

  try {
    return NextResponse.json(
      await gatewayFetchJson(`/v1/integrations/obsidian/settings${suffix}`),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  try {
    return NextResponse.json(
      await gatewayFetchJson("/v1/integrations/obsidian/settings", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
