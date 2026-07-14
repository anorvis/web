const fs = require("node:fs");
const path = require("node:path");

const srcRoot = path.resolve(__dirname, "..", "src");
const validExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const importPattern =
  /from\s+["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;

const sharedRoots = [
  "@/components/ui",
  "@/components/layout",
  "@/components/providers",
  "@/components/utils",
  "@/hooks",
  "@/lib",
  "@/types",
];

const allowedImports = new Map([
  [
    "components/layout/nav.tsx",
    new Set(["@/features/health/stores/health-store"]),
  ],
  [
    "features/health/components/command-center.tsx",
    new Set(["@/features/life/lib/calendar-utils"]),
  ],
  [
    "features/health/components/sections.tsx",
    new Set(["@/features/life/lib/calendar-utils"]),
  ],
  [
    "features/health/utils/forms.ts",
    new Set(["@/features/life/lib/calendar-utils"]),
  ],
  [
    "features/integrations/lib/integrations.ts",
    new Set(["@/features/overview/types/overview"]),
  ],
  [
    "features/integrations/components/card.tsx",
    new Set(["@/features/overview/types/overview"]),
  ],
  [
    "features/overview/components/domain-cards-row.tsx",
    new Set([
      "@/features/finance/lib/currency",
      "@/features/finance/lib/score",
      "@/features/finance/types/finance",
    ]),
  ],
  [
    "features/overview/components/integrations-catalog.tsx",
    new Set(["@/features/integrations/components/card"]),
  ],
  [
    "features/overview/api/overview.ts",
    new Set([
      "@/features/finance/api/finance",
      "@/features/health/api/health",
      "@/features/life/api/life",
    ]),
  ],
  [
    "lib/query/preloads.ts",
    new Set([
      "@/features/dev/api/dev",
      "@/features/finance/api/finance",
      "@/features/health/api/health",
      "@/features/life/api/life",
      "@/features/overview/api/overview",
    ]),
  ],
  [
    "lib/workspace-type-guards.ts",
    new Set([
      "@/features/finance/types/finance",
      "@/features/health/types/health",
      "@/features/overview/types/overview",
    ]),
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
    if (validExtensions.has(path.extname(entry.name))) results.push(fullPath);
  }
  return results;
}

function relativeSourcePath(file) {
  return path.relative(srcRoot, file).split(path.sep).join("/");
}

function featureNameFromSource(relativePath) {
  const parts = relativePath.split("/");
  return parts[0] === "features" ? parts[1] : null;
}

function featureNameFromImport(specifier) {
  const match = specifier.match(/^@\/features\/([^/]+)/);
  return match?.[1] ?? null;
}

function isSharedImport(specifier) {
  return sharedRoots.some(
    (root) => specifier === root || specifier.startsWith(`${root}/`),
  );
}

function collectImports(contents) {
  return [...contents.matchAll(importPattern)]
    .map((match) => match[1] ?? match[2])
    .filter(Boolean);
}

function isAllowedImport(relativePath, specifier) {
  return allowedImports.get(relativePath)?.has(specifier) ?? false;
}

const violations = [];

for (const file of walk(srcRoot)) {
  const relativePath = relativeSourcePath(file);
  const sourceFeature = featureNameFromSource(relativePath);
  const contents = fs.readFileSync(file, "utf8");

  for (const specifier of collectImports(contents)) {
    if (isAllowedImport(relativePath, specifier)) continue;

    const importedFeature = featureNameFromImport(specifier);

    if (sourceFeature && importedFeature && importedFeature !== sourceFeature) {
      violations.push({
        file: relativePath,
        import: specifier,
        reason: "cross-feature imports must be composed from app/shared code",
      });
    }

    if (isSharedImport(`@/${relativePath}`) && importedFeature) {
      violations.push({
        file: relativePath,
        import: specifier,
        reason: "shared modules must not import feature internals",
      });
    }

    if (sourceFeature && specifier.startsWith("@/app")) {
      violations.push({
        file: relativePath,
        import: specifier,
        reason: "features must not import app routes",
      });
    }
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary violations found.");
  for (const violation of violations) {
    console.error(
      `- ${violation.file}: ${violation.import} (${violation.reason})`,
    );
  }
  process.exit(1);
}
