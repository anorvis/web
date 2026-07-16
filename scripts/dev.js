// Starts Next with the Convex URLs of the running local deployment, published
// by `bun run dev` in anorvis/os. Explicit Convex env vars always win; the
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

function hostnameArgument(args) {
  let explicit = false;
  let host;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "-H" || arg === "--hostname") {
      explicit = true;
      host = args[index + 1];
      index += 1;
      continue;
    }
    const equals = arg.match(/^(?:-H|--hostname)=(.*)$/);
    if (equals) {
      explicit = true;
      host = equals[1];
      continue;
    }
    if (arg.startsWith("-H") && arg.length > 2) {
      explicit = true;
      host = arg.slice(2);
    }
  }
  return { explicit, host };
}

const env = { ...process.env };
const deployment = readDeployment();
const backend = env.ANORVIS_CONVEX_URL ?? deployment?.url;
if (backend) env.NEXT_PUBLIC_CONVEX_URL ??= backend;
if (deployment?.siteUrl) env.NEXT_PUBLIC_CONVEX_SITE_URL ??= deployment.siteUrl;

const rawArgs = process.argv.slice(2);
const mode = rawArgs[0] === "start" ? "start" : "dev";
const args = mode === "start" ? rawArgs.slice(1) : rawArgs;
// This unauthenticated-by-default app is local-first: bind loopback unless the
// caller explicitly chooses a host (dev:lan/start:lan pass -H 0.0.0.0).
const hostname = hostnameArgument(args);
const bindHost = hostname.explicit ? hostname.host || "unknown" : "127.0.0.1";
env.ANORVIS_WEB_BIND_HOST = bindHost;
const hostArgs = hostname.explicit ? [] : ["-H", "127.0.0.1"];
const child = spawn("next", [mode, ...hostArgs, ...args], {
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});
child.on("exit", (code) => process.exit(code ?? 1));
