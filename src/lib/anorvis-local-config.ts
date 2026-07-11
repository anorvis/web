import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function getHomeDir(): string {
  const homeDir = process.env.HOME?.trim();
  if (!homeDir) {
    throw new Error("HOME is not set.");
  }

  return homeDir;
}

function getDefaultGatewayTokenPath(): string {
  return (
    process.env.ANORVIS_OS_API_TOKEN_PATH?.trim() ||
    join(getHomeDir(), ".anorvis", "os", "api-token")
  );
}

export function resolveAnorvisGatewayToken(): string | null {
  const envToken = process.env.ANORVIS_OS_API_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  const path = getDefaultGatewayTokenPath();
  if (!existsSync(path)) {
    const hostname = new URL(resolveAnorvisGatewayBaseUrl()).hostname;
    if (["127.0.0.1", "localhost", "::1", "[::1]"].includes(hostname)) {
      return null;
    }
    throw new Error(
      `Anorvis gateway token file is missing: ${path}. Set ANORVIS_OS_API_TOKEN for a non-loopback gateway.`,
    );
  }

  const token = readFileSync(path, "utf8").trim();
  if (!token) {
    throw new Error(`Anorvis gateway token file is empty: ${path}.`);
  }

  return token;
}

export function resolveAnorvisGatewayBaseUrl(): string {
  return process.env.ANORVIS_OS_URL?.trim() || "http://127.0.0.1:8787";
}
