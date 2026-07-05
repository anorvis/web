import { NextResponse } from "next/server";
import { getNativeHealthDashboard } from "@/features/health/lib/native-server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getNativeHealthDashboard());
}
