import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    globals: true,
    environment: "node",
    exclude: ["e2e/**", "node_modules/**"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
});
