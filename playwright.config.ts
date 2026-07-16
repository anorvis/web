import { defineConfig, devices } from "@playwright/test";

const e2eOsUrl = "http://127.0.0.1:8877";

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
        ANORVIS_OS_API_TOKEN: "e2e-token",
        ANORVIS_OS_HOST: "127.0.0.1",
        ANORVIS_OS_PORT: "8877",
      },
    },
    {
      command: "node scripts/dev.js",
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
