import { NextResponse } from "next/server";
import { DEFAULT_RATES } from "@/features/finance/lib/currency";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(DEFAULT_RATES);
}
