import { NextResponse } from "next/server";
import { isRecord } from "@/lib/guards";
import { readWorkspaceDocument } from "@/lib/os-workspace-data";

export const runtime = "nodejs";

export async function GET() {
  const nowPlaying = await readWorkspaceDocument({
    kind: "summary",
    id: "web-spotify-now-playing",
    isValue: isRecord,
  });
  return NextResponse.json(nowPlaying ?? { isPlaying: false });
}
