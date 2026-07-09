import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { getAnorvisRuntime, isAnorvisProdRuntime } from "@/lib/anorvis-runtime";
import { shouldUseBrowserLocalBackend } from "@/lib/local-backend-client";
import { middleware } from "@/middleware";

describe("Anorvis runtime mode", () => {
  const originalVercelEnv = process.env.VERCEL_ENV;

  afterEach(() => {
    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("defaults to local mode when Vercel env is unset", () => {
    delete process.env.VERCEL_ENV;

    expect(getAnorvisRuntime()).toBe("local");
    expect(isAnorvisProdRuntime()).toBe(false);
    expect(shouldUseBrowserLocalBackend()).toBe(false);
  });

  it("treats Vercel production and preview as landing-only hosted modes", async () => {
    process.env.VERCEL_ENV = "preview";

    expect(getAnorvisRuntime()).toBe("prod");
    expect(isAnorvisProdRuntime()).toBe(true);

    const rootResponse = await middleware(
      new NextRequest("https://anorvis.app/", {
        method: "GET",
        headers: { host: "anorvis.app" },
      }),
    );
    expect(rootResponse.status).toBe(200);

    const appResponse = await middleware(
      new NextRequest("https://anorvis.app/life", {
        method: "GET",
        headers: { host: "anorvis.app" },
      }),
    );
    expect(appResponse.status).toBe(404);

    const apiResponse = await middleware(
      new NextRequest(
        "https://anorvis.app/api/health/exercise-search?q=squat",
        {
          method: "GET",
          headers: { host: "anorvis.app" },
        },
      ),
    );
    expect(apiResponse.status).toBe(404);
    expect(await apiResponse.text()).toBe("Not found");
  });

  it("keeps Vercel development in local app mode", async () => {
    process.env.VERCEL_ENV = "development";

    expect(getAnorvisRuntime()).toBe("local");
    expect(isAnorvisProdRuntime()).toBe(false);

    const response = await middleware(
      new NextRequest(
        "https://anorvis.app/api/health/exercise-search?q=squat",
        {
          method: "GET",
          headers: { host: "anorvis.app" },
        },
      ),
    );

    expect(response.status).toBe(200);
  });
});
