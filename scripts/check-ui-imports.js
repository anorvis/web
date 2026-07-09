const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..", "src");
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

    const relativePath = path.relative(projectRoot, fullPath);
    if (relativePath.startsWith(`components${path.sep}ui${path.sep}`)) {
      results.push(fullPath);
      continue;
    }

    if (!validExtensions.has(path.extname(entry.name))) {
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
  console.error(
    "Reusable UI primitives must come from @anorvis/ui; do not add local src/components/ui files or direct Radix imports.",
  );
  invalidFiles.forEach((file) => {
    const relativePath = path.relative(process.cwd(), file);
    console.error(`- ${relativePath}`);
  });
  process.exit(1);
}
