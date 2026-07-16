import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "./route";

const originalHome = process.env.HOME;
const originalWebBindHost = process.env.ANORVIS_WEB_BIND_HOST;

beforeEach(() => {
  process.env.ANORVIS_WEB_BIND_HOST = "127.0.0.1";
});

afterEach(() => {
  process.env.HOME = originalHome;
  if (originalWebBindHost === undefined)
    delete process.env.ANORVIS_WEB_BIND_HOST;
  else process.env.ANORVIS_WEB_BIND_HOST = originalWebBindHost;
});

function isolatedHome(): string {
  const home = mkdtempSync(join(tmpdir(), "anorvis-local-key-"));
  process.env.HOME = home;
  return home;
}

describe("GET /api/local-key", () => {
  it("hands the machine key to loopback requests only", async () => {
    const home = isolatedHome();
    mkdirSync(join(home, ".anorvis"), { recursive: true });
    writeFileSync(
      join(home, ".anorvis", "convex-setup-key"),
      "machine-secret\n",
    );

    const local = GET(
      new Request("http://127.0.0.1:3000/api/local-key", {
        headers: {
          host: "127.0.0.1:3000",
          "x-forwarded-for": "127.0.0.1",
          "x-forwarded-host": "127.0.0.1:3000",
          "x-forwarded-port": "3000",
          "x-forwarded-proto": "http",
        },
      }),
    );
    expect(local.status).toBe(200);
    await expect(local.json()).resolves.toEqual({ key: "machine-secret" });
    expect(local.headers.get("cache-control")).toBe("no-store");

    const remote = GET(new Request("http://192.168.1.20:3000/api/local-key"));
    expect(remote.status).toBe(403);
  });

  it("denies a loopback request when process bind evidence is missing", () => {
    delete process.env.ANORVIS_WEB_BIND_HOST;

    const response = GET(
      new Request("http://localhost:3000/api/local-key", {
        headers: { host: "localhost:3000" },
      }),
    );

    expect(response.status).toBe(403);
  });

  it("denies a LAN-bound process despite a spoofed localhost Host", () => {
    process.env.ANORVIS_WEB_BIND_HOST = "0.0.0.0";

    const response = GET(
      new Request("http://localhost:3000/api/local-key", {
        headers: { host: "localhost:3000" },
      }),
    );

    expect(response.status).toBe(403);
  });

  it("reports a missing machine key without failing", async () => {
    isolatedHome();
    const response = GET(new Request("http://localhost:3000/api/local-key"));
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "no local key" });
  });
});
