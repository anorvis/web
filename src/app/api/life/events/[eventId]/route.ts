import { NextResponse } from "next/server";
import { gatewayFetch, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch = body as Record<string, unknown>;
  const event = await gatewayFetchJson<unknown>(
    `/v1/calendar/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        summary: patch.summary,
        startAt: patch.startDateTime ?? patch.startAt,
        endAt: patch.endDateTime ?? patch.endAt,
        location: patch.location,
        description: patch.description,
        tag: patch.tag,
      }),
    },
  );
  return NextResponse.json(event);
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  const response = await gatewayFetch(
    `/v1/calendar/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );
  return response.ok
    ? new Response(null, { status: 204 })
    : NextResponse.json({ error: "event not found" }, { status: 404 });
}
