import { NextResponse } from "next/server";
import { getLifeSnapshot } from "@/features/life/lib/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await getLifeSnapshot());
}
