import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import { rejectNonLocalRequest } from "@/lib/api/local-only";

export const runtime = "nodejs";

const execFileAsync = promisify(execFile);

export async function POST(request: Request) {
  const nonLocalResponse = rejectNonLocalRequest(request);
  if (nonLocalResponse) return nonLocalResponse;

  if (process.platform !== "darwin") {
    return NextResponse.json(
      { error: "Folder picker is currently supported on macOS only." },
      { status: 501 },
    );
  }

  try {
    const { stdout } = await execFileAsync("osascript", [
      "-e",
      'POSIX path of (choose folder with prompt "Choose a local folder to approve as Anorvis workspace context")',
    ]);
    return NextResponse.json({ path: stdout.trim().replace(/\/$/, "") });
  } catch {
    return NextResponse.json({ cancelled: true });
  }
}
