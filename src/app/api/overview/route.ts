import { NextResponse } from "next/server";
import { getOverviewData } from "@/features/overview/lib/server";

export const runtime = "nodejs";

export async function GET() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return NextResponse.json(await getOverviewData(timezone));
}
