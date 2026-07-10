import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";

export const runtime = "nodejs";

export async function PUT(
  request: Request,
  context: { params: Promise<{ tagId: string }> },
) {
  const { tagId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json(
      { error: "invalid life tag patch" },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(
      await gatewayFetchJson(`/v1/life/tags/${encodeURIComponent(tagId)}`, {
        method: "PUT",
        body: JSON.stringify({
          name: typeof body.name === "string" ? body.name : undefined,
          color:
            body.color === null || typeof body.color === "string"
              ? body.color
              : undefined,
          hidden: typeof body.hidden === "boolean" ? body.hidden : undefined,
        }),
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ tagId: string }> },
) {
  const { tagId } = await context.params;
  try {
    return NextResponse.json(
      await gatewayFetchJson(`/v1/life/tags/${encodeURIComponent(tagId)}`, {
        method: "DELETE",
      }),
    );
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
