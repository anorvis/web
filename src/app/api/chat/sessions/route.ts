import { type NextRequest, NextResponse } from "next/server";
import {
  buildWebExternalId,
  type GatewaySession,
  gatewayErrorResponse,
  gatewayFetchJson,
} from "@/lib/anorvis-gateway";

export const runtime = "nodejs";
const LOCAL_USER_ID = "local";

export async function GET(request: NextRequest) {
  try {
    const params = new URLSearchParams();
    const agent = request.nextUrl.searchParams.get("agent")?.trim();
    const query = request.nextUrl.searchParams.get("q")?.trim();
    if (agent) params.set("agent", agent);
    if (query) params.set("q", query);

    const suffix = params.toString() ? `?${params.toString()}` : "";
    try {
      const sessions = await gatewayFetchJson<GatewaySession[]>(
        `/v1/chat/sessions${suffix}`,
      );
      return NextResponse.json(
        sessions.filter((session) => session.surface === "web"),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (
        message.toLowerCase().includes("not found") ||
        message.toLowerCase().includes("cannot get") ||
        message.toLowerCase().includes("unsupported route")
      ) {
        return NextResponse.json([]);
      }
      throw error;
    }
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: { agent?: string };
    try {
      body = (await request.json()) as { agent?: string };
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }

    const agent = body.agent?.trim();
    if (!agent) {
      return NextResponse.json({ error: "agent is required" }, { status: 400 });
    }

    const threadId = crypto.randomUUID();
    return NextResponse.json(
      await gatewayFetchJson<{ record: GatewaySession; created: boolean }>(
        "/v1/chat/sessions",
        {
          method: "POST",
          body: JSON.stringify({
            surface: "web",
            externalId: buildWebExternalId(LOCAL_USER_ID, threadId, agent),
            agent,
          }),
        },
      ),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
