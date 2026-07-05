import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  _context: { params: Promise<{ agent: string }> },
) {
  return NextResponse.json([]);
}
