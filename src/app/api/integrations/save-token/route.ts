import { NextResponse } from "next/server";
import { writeWorkspaceDocument } from "@/lib/os-workspace-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    !("provider" in body) ||
    typeof body.provider !== "string" ||
    !("token" in body) ||
    typeof body.token !== "string"
  ) {
    return NextResponse.json(
      { error: "provider and token are required" },
      { status: 400 },
    );
  }

  await writeWorkspaceDocument({
    kind: "decision",
    id: `web-integration-token-request-${crypto.randomUUID()}`,
    title: `Integration token provided for ${body.provider}`,
    value: {
      provider: body.provider,
      tokenPresent: body.token.trim().length > 0,
      requestedAt: new Date().toISOString(),
    },
  });

  return NextResponse.json({
    ok: true,
    note: "Stored a token-registration request in anorvis-os memory. Secret persistence belongs in anorvis-os auth providers.",
  });
}
