import { NextResponse } from "next/server";
import { gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

function isEventBody(value: unknown): value is {
  summary: string;
  startAt: string;
  endAt: string;
  location?: string;
  description?: string;
  tag?: string;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "summary" in value &&
    typeof value.summary === "string" &&
    "startAt" in value &&
    typeof value.startAt === "string" &&
    "endAt" in value &&
    typeof value.endAt === "string"
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!isEventBody(body) || !body.summary.trim()) {
    return NextResponse.json(
      { error: "summary, startAt, and endAt are required" },
      { status: 400 },
    );
  }

  const event = await gatewayFetchJson<unknown>("/v1/calendar/events", {
    method: "POST",
    body: JSON.stringify({
      summary: body.summary.trim(),
      startAt: body.startAt,
      endAt: body.endAt,
      location: typeof body.location === "string" ? body.location : undefined,
      description:
        typeof body.description === "string" ? body.description : undefined,
      tag: typeof body.tag === "string" ? body.tag : undefined,
    }),
  });
  return NextResponse.json(event, { status: 201 });
}
