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

export function resolveAnorvisGatewayToken(): string {
  const envToken = process.env.ANORVIS_OS_API_TOKEN?.trim();
  if (envToken) {
    return envToken;
  }

  const path = getDefaultGatewayTokenPath();
  if (!existsSync(path)) {
    throw new Error(
      `Anorvis gateway token file is missing: ${path}. Start anorvis-os once to generate it, or set ANORVIS_OS_API_TOKEN.`,
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
