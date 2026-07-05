const fs = require("node:fs");
const path = require("node:path");

const srcRoot = path.resolve(__dirname, "..", "src");
const validExtensions = new Set([".ts", ".tsx"]);
const storagePattern = /\b(?:window\.)?(?:localStorage|sessionStorage)\./;

const allowedFiles = new Set([
  "features/chat/components/chat.tsx",
  "features/chat/api/client.ts",
  "features/finance/components/finance-provider.tsx",
  "features/health/components/command-center.tsx",
  "features/health/utils/forms.ts",
  "features/health/stores/health-store.ts",
  "features/life/stores/inspiration-store.ts",
  "features/overview/components/domain-cards-row.tsx",
  "lib/query/persistence.ts",
]);

function walk(dir, results = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
      continue;
    }
    if (validExtensions.has(path.extname(entry.name))) results.push(fullPath);
  }
  return results;
}

const violations = walk(srcRoot)
  .map((file) => ({
    file: path.relative(srcRoot, file).split(path.sep).join("/"),
    contents: fs.readFileSync(file, "utf8"),
  }))
  .filter(
    ({ file, contents }) =>
      storagePattern.test(contents) && !allowedFiles.has(file),
  )
  .map(({ file }) => file);

if (violations.length > 0) {
  console.error("Unexpected browser storage usage found.");
  for (const file of violations) console.error(`- ${file}`);
  process.exit(1);
}
