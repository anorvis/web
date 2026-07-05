const fs = require("node:fs");
const path = require("node:path");

const srcRoot = path.resolve(__dirname, "..", "src");
const componentLimit = 700;
const routeLimit = 450;
const allowedLargeFiles = new Map([
  ["features/dev/components/memory-panel.tsx", "legacy oversized component"],
  [
    "features/life/components/calendar-time-grid.tsx",
    "legacy oversized component",
  ],
]);

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
      continue;
    }
    if (entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")) {
      results.push(fullPath);
    }
  }
  return results;
}

const violations = [];

for (const file of walk(srcRoot)) {
  const relative = path.relative(srcRoot, file).split(path.sep).join("/");
  const lines = fs.readFileSync(file, "utf8").split("\n").length;
  const isFeatureComponent =
    relative.startsWith("features/") && relative.includes("/components/");
  const isRoute =
    relative.startsWith("app/api/") && relative.endsWith("/route.ts");
  const limit = isFeatureComponent
    ? componentLimit
    : isRoute
      ? routeLimit
      : null;
  if (limit === null || lines <= limit || allowedLargeFiles.has(relative)) {
    continue;
  }
  violations.push(`${relative}: ${lines} lines exceeds ${limit}`);
}

if (violations.length > 0) {
  console.error("File size violations found.");
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
