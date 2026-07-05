import { NextResponse } from "next/server";
import { fetchMultiCalendarEvents } from "@/features/life/lib/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const timeMin = parseDateParam(url.searchParams.get("timeMin"));
  const timeMax = parseDateParam(url.searchParams.get("timeMax"));
  const calendar = await fetchMultiCalendarEvents({ timeMin, timeMax });
  return NextResponse.json({ ...calendar, events: calendar.items });
}

function parseDateParam(value: string | null): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
