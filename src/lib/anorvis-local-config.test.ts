import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAnorvisGatewayToken } from "./anorvis-local-config";

const originalEnv = {
  ANORVIS_OS_API_TOKEN: process.env.ANORVIS_OS_API_TOKEN,
  ANORVIS_OS_API_TOKEN_PATH: process.env.ANORVIS_OS_API_TOKEN_PATH,
  ANORVIS_OS_URL: process.env.ANORVIS_OS_URL,
  HOME: process.env.HOME,
};

let homeDir: string;

function restoreEnv(name: keyof typeof originalEnv): void {
  const value = originalEnv[name];
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

describe("resolveAnorvisGatewayToken", () => {
  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), "anorvis-local-config-"));

    process.env.HOME = homeDir;
    delete process.env.ANORVIS_OS_API_TOKEN;
    delete process.env.ANORVIS_OS_API_TOKEN_PATH;
    delete process.env.ANORVIS_OS_URL;
  });

  afterEach(() => {
    rmSync(homeDir, { recursive: true, force: true });

    restoreEnv("ANORVIS_OS_API_TOKEN");
    restoreEnv("ANORVIS_OS_API_TOKEN_PATH");
    restoreEnv("ANORVIS_OS_URL");
    restoreEnv("HOME");
  });

  it("returns an explicit ANORVIS_OS_API_TOKEN without reading the default token file", () => {
    process.env.ANORVIS_OS_API_TOKEN = "  explicit-token  ";
    process.env.ANORVIS_OS_URL = "https://gateway.example.test";

    expect(resolveAnorvisGatewayToken()).toBe("explicit-token");
  });

  it("returns null when the default token file is absent for a loopback gateway", () => {
    process.env.ANORVIS_OS_URL = "http://localhost:8787";

    expect(resolveAnorvisGatewayToken()).toBeNull();
  });

  it("requires ANORVIS_OS_API_TOKEN when the default token file is absent for a non-loopback gateway", () => {
    process.env.ANORVIS_OS_URL = "https://gateway.example.test";

    expect(() => resolveAnorvisGatewayToken()).toThrow(
      /Set ANORVIS_OS_API_TOKEN for a non-loopback gateway\./,
    );
  });
});
