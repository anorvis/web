const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "src");
const uiRoot = path.join(projectRoot, "components", "ui");
const validExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const ignoredDirs = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  ".turbo",
]);

const radixImportPattern = /from\s+["']@radix-ui\//;

function walk(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.name.startsWith(".")) {
      continue;
    }

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (ignoredDirs.has(entry.name)) {
        continue;
      }
      walk(fullPath, results);
      continue;
    }

    if (!validExtensions.has(path.extname(entry.name))) {
      continue;
    }

    if (fullPath.startsWith(uiRoot)) {
      continue;
    }

    const contents = fs.readFileSync(fullPath, "utf8");
    if (radixImportPattern.test(contents)) {
      results.push(fullPath);
    }
  }
}

const invalidFiles = [];
walk(projectRoot, invalidFiles);

if (invalidFiles.length > 0) {
  console.error("Radix imports must live in src/components/ui only.");
  invalidFiles.forEach((file) => {
    const relativePath = path.relative(process.cwd(), file);
    console.error(`- ${relativePath}`);
  });
  process.exit(1);
}
