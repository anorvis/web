import { Schema } from "effect";
import { NextResponse } from "next/server";
import { gatewayFetch, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { decodeUnknownResult } from "@/lib/effect/schema";

export const runtime = "nodejs";

const EventPatchBodySchema = Schema.Record({
  key: Schema.String,
  value: Schema.Unknown,
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ eventId: string }> },
) {
  const { eventId } = await context.params;
  const decoded = decodeUnknownResult(
    EventPatchBodySchema,
    await request.json().catch(() => null),
  );
  if (!decoded.ok) {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const patch = decoded.value;
  const event = await gatewayFetchJson<unknown>(
    `/v1/calendar/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        summary: patch.summary,
        startAt: patch.startAt,
        endAt: patch.endAt,
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
