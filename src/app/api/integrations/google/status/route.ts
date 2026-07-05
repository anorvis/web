import { NextResponse } from "next/server";
import { getGoogleWorkspaceStatus } from "@/lib/google-workspace";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getGoogleWorkspaceStatus());
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
