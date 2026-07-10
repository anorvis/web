import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const e2eOsUrl = "http://127.0.0.1:8877";
const e2eDbPath =
  process.env.ANORVIS_E2E_DB_PATH ??
  resolve(__dirname, ".playwright", "anorvis-e2e.sqlite");
for (const path of [e2eDbPath, `${e2eDbPath}-wal`, `${e2eDbPath}-shm`]) {
  rmSync(path, { force: true });
}

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "cd ../os && bun src/platform/gateway/server.ts",
      url: `${e2eOsUrl}/health`,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        ANORVIS_SECRET_PROVIDER: "local",
        ANORVIS_OS_API_TOKEN: "e2e-token",
        ANORVIS_OS_HOST: "127.0.0.1",
        ANORVIS_OS_PORT: "8877",
        ANORVIS_DB_PATH: e2eDbPath,
      },
    },
    {
      command: "bun ./node_modules/next/dist/bin/next dev",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120000,
      env: {
        ANORVIS_OS_URL: e2eOsUrl,
        ANORVIS_OS_API_TOKEN: "e2e-token",
        NEXT_PUBLIC_ANORVIS_OS_URL: e2eOsUrl,
      },
    },
  ],
});
