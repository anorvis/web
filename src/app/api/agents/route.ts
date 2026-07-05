import { NextResponse } from "next/server";
import {
  type GatewayAgent,
  gatewayErrorResponse,
  gatewayFetchJson,
} from "@/lib/anorvis-gateway";

export async function GET() {
  try {
    return NextResponse.json(
      await gatewayFetchJson<GatewayAgent[]>("/v1/agents"),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
