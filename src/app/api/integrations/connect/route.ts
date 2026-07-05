import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";
import { startGoogleWorkspaceAuth } from "@/lib/google-workspace";
import { startPinterestAuth } from "@/lib/pinterest";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") ?? "";
  const next = url.searchParams.get("next") || "/";

  if (
    provider !== "google" &&
    provider !== "obsidian" &&
    provider !== "pinterest"
  ) {
    return NextResponse.json(
      { error: `Unsupported provider: ${provider}` },
      { status: 400 },
    );
  }

  try {
    if (provider === "obsidian") {
      await gatewayFetchJson("/v1/integrations/obsidian/connect", {
        method: "POST",
      });
      return NextResponse.redirect(new URL(next, url.origin));
    }

    if (provider === "pinterest") {
      const pinterestAuth = await startPinterestAuth({
        returnTo: new URL(next, url.origin).toString(),
      });
      return NextResponse.redirect(pinterestAuth.authUrl);
    }
    const auth = await startGoogleWorkspaceAuth({
      returnTo: new URL(next, url.origin).toString(),
    });
    return NextResponse.redirect(auth.authUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
