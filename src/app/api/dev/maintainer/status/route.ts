import { NextResponse } from "next/server";
import { gatewayErrorResponse, gatewayFetchJson } from "@/lib/anorvis-gateway";
import { isDirectLoopbackRequest } from "@/lib/direct-loopback-request";
import { isRecord } from "@/lib/guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

/**
 * Forward presence facts only. The gateway never sends secret values here,
 * and this sanitizer guarantees nothing beyond the documented shape passes
 * through even if the gateway payload grows.
 */
function sanitizeStatus(value: unknown) {
  const root = isRecord(value) ? value : {};
  const sandbox = isRecord(root.sandboxCommand) ? root.sandboxCommand : {};
  const modelAuth = isRecord(root.modelAuth) ? root.modelAuth : {};
  return {
    enabled: root.enabled === true,
    sandboxCommand: {
      registered: sandbox.registered === true,
      path: text(sandbox.path),
      exists: sandbox.exists === true,
    },
    docker: root.docker === true,
    sandboxImage: root.sandboxImage === true,
    modelAuth: {
      vault: modelAuth.vault === true,
      apiKeys: Array.isArray(modelAuth.apiKeys)
        ? modelAuth.apiKeys.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [],
    },
    githubToken: root.githubToken === true,
    botBrowserSession: root.botBrowserSession === true,
    maintainerModel: text(root.maintainerModel),
    vaultSetupCommand: text(root.vaultSetupCommand),
  };
}

export async function GET(request: Request) {
  if (!isDirectLoopbackRequest(request)) {
    return NextResponse.json({ error: "local only" }, { status: 403 });
  }
  try {
    const status = await gatewayFetchJson<unknown>("/v1/maintainer/status");
    return NextResponse.json(sanitizeStatus(status), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return gatewayErrorResponse(error);
  }
}
