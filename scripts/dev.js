// Starts Next with the Convex URLs of the running local deployment, published
// by `bun run dev` in anorvis/os. Explicit env vars always win; the stock
// local ports remain the last resort inside the app itself.
const { spawn } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const registryPath = path.join(
  os.homedir(),
  ".anorvis",
  "convex",
  "deployment.json",
);

function readDeployment() {
  try {
    const decoded = JSON.parse(fs.readFileSync(registryPath, "utf8"));
    if (!decoded || typeof decoded !== "object") return null;
    const url = typeof decoded.url === "string" ? decoded.url : null;
    const siteUrl =
      typeof decoded.siteUrl === "string" ? decoded.siteUrl : null;
    return url ? { url, siteUrl } : null;
  } catch {
    return null;
  }
}

const env = { ...process.env };
const deployment = readDeployment();
const backend = env.ANORVIS_CONVEX_URL ?? deployment?.url;
if (backend) env.NEXT_PUBLIC_CONVEX_URL ??= backend;
if (deployment?.siteUrl) env.NEXT_PUBLIC_CONVEX_SITE_URL ??= deployment.siteUrl;
const args = process.argv.slice(2);
// This unauthenticated-by-default app is local-first: bind loopback unless the
// caller explicitly chooses a host (dev:lan passes -H 0.0.0.0).
const hostPinned = args.some((arg) => arg === "-H" || arg === "--hostname");
const hostArgs = hostPinned ? [] : ["-H", "127.0.0.1"];
const child = spawn("next", ["dev", ...hostArgs, ...args], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 1));
