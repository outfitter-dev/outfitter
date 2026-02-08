#!/usr/bin/env bun
/**
 * Migration guide composer for @outfitter/* packages.
 *
 * Detects installed @outfitter/* versions from package.json,
 * finds relevant migration docs, and composes a sequenced guide.
 *
 * Usage:
 *   bun migration-guide.ts [options]
 *
 * Options:
 *   --cwd <path>      Working directory (default: process.cwd())
 *   --package <name>  Filter to a specific package (e.g., "contracts")
 *   --json            Output as JSON manifest instead of markdown
 *   --help            Show this help message
 */

import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface InstalledPackage {
  name: string;
  version: string;
}

interface MigrationDoc {
  package: string;
  version: string;
  breaking: boolean;
  filePath: string;
  content: string;
}

interface MigrationGuide {
  installed: InstalledPackage[];
  docs: MigrationDoc[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Dependency tier ordering for migration sequencing. */
const PACKAGE_TIER: Record<string, number> = {
  contracts: 0,
  types: 1,
  cli: 10,
  mcp: 11,
  config: 12,
  logging: 13,
  "file-ops": 14,
  state: 15,
  index: 16,
  daemon: 17,
  testing: 18,
  kit: 20,
  tooling: 21,
  outfitter: 30,
};

/** Resolve the migrations directory relative to this script. */
const MIGRATIONS_DIR = resolve(import.meta.dir, "../shared/migrations");

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Parse package.json at `cwd` and extract @outfitter/* dependencies.
 */
export function detectVersions(cwd: string): InstalledPackage[] {
  const pkgPath = join(cwd, "package.json");
  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf-8");
  } catch {
    return [];
  }

  let pkg: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  try {
    pkg = JSON.parse(raw);
  } catch {
    return [];
  }

  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  const result: InstalledPackage[] = [];

  for (const [name, version] of Object.entries(deps)) {
    if (name.startsWith("@outfitter/")) {
      // Handle workspace protocol: workspace:* → skip, workspace:^0.1.0 → extract version
      if (version.startsWith("workspace:")) {
        const wsVersion = version.slice("workspace:".length);
        if (wsVersion === "*" || wsVersion === "~" || wsVersion === "^") {
          continue;
        }
        // Strip range prefix from workspace version (e.g., "workspace:^0.1.0" → "0.1.0")
        const wsClean = wsVersion.replace(/^[\^~>=<]+/, "");
        try {
          if (!Bun.semver.satisfies(wsClean, "*")) continue;
        } catch {
          continue;
        }
        result.push({ name, version: wsClean });
        continue;
      }

      // Strip range prefixes (^, ~, >=, etc.) for comparison
      const cleaned = version.replace(/^[\^~>=<]+/, "");

      // Skip non-semver versions (file:, git+ssh:, etc.)
      try {
        if (!Bun.semver.satisfies(cleaned, "*")) continue;
      } catch {
        continue;
      }

      result.push({ name, version: cleaned });
    }
  }

  // Sort by dependency tier
  result.sort((a, b) => {
    const aKey = a.name.replace("@outfitter/", "");
    const bKey = b.name.replace("@outfitter/", "");
    return (PACKAGE_TIER[aKey] ?? 99) - (PACKAGE_TIER[bKey] ?? 99);
  });

  return result;
}

/**
 * Find migration docs for a package within a version range.
 *
 * Returns docs where the doc version is greater than `fromVersion`.
 * If `toVersion` is provided, also filters to docs <= `toVersion`.
 */
export function findMigrationDocs(
  pkg: string,
  fromVersion: string,
  toVersion?: string
): MigrationDoc[] {
  const shortName = pkg.replace("@outfitter/", "");
  const glob = new Bun.Glob(`outfitter-${shortName}-*.md`);
  const docs: MigrationDoc[] = [];

  for (const entry of glob.scanSync({ cwd: MIGRATIONS_DIR })) {
    // Extract version from filename: outfitter-contracts-0.2.0.md → 0.2.0
    const match = entry.match(
      new RegExp(`^outfitter-${shortName}-(\\d+\\.\\d+\\.\\d+)\\.md$`)
    );
    if (!match) continue;

    const docVersion = match[1];

    // Filter: doc version must be greater than current installed version
    if (Bun.semver.order(docVersion, fromVersion) <= 0) continue;

    // Filter: if toVersion specified, doc version must be <= toVersion
    if (toVersion && Bun.semver.order(docVersion, toVersion) > 0) continue;

    const filePath = join(MIGRATIONS_DIR, entry);
    const content = readFileSync(filePath, "utf-8");

    // Parse frontmatter
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    let breaking = false;
    if (fmMatch) {
      const breakingMatch = fmMatch[1].match(/breaking:\s*(true|false)/);
      if (breakingMatch) {
        breaking = breakingMatch[1] === "true";
      }
    }

    docs.push({
      package: pkg,
      version: docVersion,
      breaking,
      filePath,
      content,
    });
  }

  // Sort by version ascending
  docs.sort((a, b) => Bun.semver.order(a.version, b.version));

  return docs;
}

/**
 * Compose a migration guide from detection results.
 *
 * Groups docs by version (ascending), then within each version
 * orders by dependency tier (foundation first).
 */
export function composeMigrationGuide(
  installed: InstalledPackage[],
  packageFilter?: string
): MigrationGuide {
  const allDocs: MigrationDoc[] = [];

  for (const pkg of installed) {
    if (packageFilter && !pkg.name.includes(packageFilter)) continue;

    const docs = findMigrationDocs(pkg.name, pkg.version);
    allDocs.push(...docs);
  }

  // Sort: version ascending, then package tier
  allDocs.sort((a, b) => {
    const versionCmp = Bun.semver.order(a.version, b.version);
    if (versionCmp !== 0) return versionCmp;

    const aKey = a.package.replace("@outfitter/", "");
    const bKey = b.package.replace("@outfitter/", "");
    return (PACKAGE_TIER[aKey] ?? 99) - (PACKAGE_TIER[bKey] ?? 99);
  });

  return { installed, docs: allDocs };
}

/**
 * Render a migration guide as markdown.
 */
export function renderMarkdown(guide: MigrationGuide): string {
  const lines: string[] = [];

  lines.push("# Migration Guide\n");
  lines.push("## Installed Packages\n");
  lines.push("| Package | Version |");
  lines.push("|---------|---------|");
  for (const pkg of guide.installed) {
    lines.push(`| ${pkg.name} | ${pkg.version} |`);
  }
  lines.push("");

  if (guide.docs.length === 0) {
    lines.push("All packages are up to date. No migrations available.\n");
    return lines.join("\n");
  }

  lines.push(`## Available Migrations (${guide.docs.length})\n`);

  const breakingCount = guide.docs.filter((d) => d.breaking).length;
  if (breakingCount > 0) {
    lines.push(
      `**Warning:** ${breakingCount} migration(s) contain breaking changes.\n`
    );
  }

  for (const doc of guide.docs) {
    // Strip frontmatter from content
    const contentBody = doc.content.replace(/^---\n[\s\S]*?\n---\n*/, "");
    lines.push(contentBody.trim());
    lines.push("\n---\n");
  }

  return lines.join("\n");
}

/**
 * Render a migration guide as JSON.
 */
export function renderJSON(guide: MigrationGuide): string {
  return JSON.stringify(
    {
      installed: guide.installed,
      migrations: guide.docs.map((d) => ({
        package: d.package,
        version: d.version,
        breaking: d.breaking,
        filePath: d.filePath,
      })),
      totalMigrations: guide.docs.length,
      hasBreaking: guide.docs.some((d) => d.breaking),
    },
    null,
    2
  );
}

// ---------------------------------------------------------------------------
// CLI Entry Point
// ---------------------------------------------------------------------------

function printHelp(): void {
  console.log(`Usage: bun migration-guide.ts [options]

Detect installed @outfitter/* versions and compose migration guidance.

Options:
  --cwd <path>      Working directory (default: current directory)
  --package <name>  Filter to a specific package (e.g., "contracts")
  --json            Output as JSON manifest
  --help            Show this help message`);
}

export function main(): void {
  const { values } = parseArgs({
    options: {
      cwd: { type: "string", default: process.cwd() },
      package: { type: "string" },
      json: { type: "boolean", default: false },
      help: { type: "boolean", default: false },
    },
    strict: true,
  });

  if (values.help) {
    printHelp();
    process.exit(0);
  }

  const cwd = resolve(values.cwd ?? process.cwd());
  const installed = detectVersions(cwd);

  if (installed.length === 0) {
    if (values.json) {
      console.log(
        JSON.stringify(
          {
            installed: [],
            migrations: [],
            totalMigrations: 0,
            hasBreaking: false,
          },
          null,
          2
        )
      );
    } else {
      console.log("No @outfitter/* packages found in package.json at:", cwd);
    }
    process.exit(0);
  }

  const guide = composeMigrationGuide(installed, values.package);

  if (values.json) {
    console.log(renderJSON(guide));
  } else {
    console.log(renderMarkdown(guide));
  }
}

// Only run when executed directly (not when imported as a module)
if (import.meta.main) {
  main();
}
