import { NextResponse } from "next/server";
import {
  gatewayErrorResponse,
  gatewayFetch,
  gatewayFetchJson,
} from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json(
      await gatewayFetchJson(`/v1/tasks/${encodeURIComponent(taskId)}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ taskId: string }> },
) {
  const { taskId } = await context.params;
  try {
    const response = await gatewayFetch(
      `/v1/tasks/${encodeURIComponent(taskId)}`,
      { method: "DELETE" },
    );
    return response.ok
      ? new Response(null, { status: 204 })
      : NextResponse.json({ error: "task not found" }, { status: 404 });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
