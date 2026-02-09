/**
 * `outfitter update` - Detect installed @outfitter/* versions and show available updates.
 *
 * Reads package.json, queries npm for latest versions, and optionally
 * shows migration guidance from the kit plugin's migration docs.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { output } from "@outfitter/cli/output";
import { createTheme } from "@outfitter/cli/render";
import type { OutputMode } from "@outfitter/cli/types";
import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result } from "@outfitter/contracts";

// =============================================================================
// Types
// =============================================================================

export interface UpdateOptions {
  /** Working directory (defaults to cwd) */
  readonly cwd: string;
  /** Show migration guide */
  readonly guide?: boolean;
  /** Output mode */
  readonly outputMode?: OutputMode;
}

export interface PackageVersionInfo {
  /** Full package name */
  readonly name: string;
  /** Currently installed version */
  readonly current: string;
  /** Latest available version from npm (null if query failed) */
  readonly latest: string | null;
  /** Whether an update is available */
  readonly updateAvailable: boolean;
  /** Whether the update contains breaking changes (major bump) */
  readonly breaking: boolean;
}

export interface UpdateResult {
  /** Package version info */
  readonly packages: PackageVersionInfo[];
  /** Total packages checked */
  readonly total: number;
  /** Number of packages with updates available */
  readonly updatesAvailable: number;
  /** Whether any update is a breaking change */
  readonly hasBreaking: boolean;
}

// =============================================================================
// Version Detection
// =============================================================================

interface PackageDeps {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

/**
 * Extract @outfitter/* packages from package.json at the given cwd.
 */
function getInstalledPackages(
  cwd: string
): Result<{ name: string; version: string }[], OutfitterError> {
  const pkgPath = join(cwd, "package.json");

  if (!existsSync(pkgPath)) {
    return Result.err(InternalError.create("No package.json found", { cwd }));
  }

  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf-8");
  } catch {
    return Result.err(
      InternalError.create("Failed to read package.json", { cwd })
    );
  }

  let pkg: PackageDeps;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return Result.err(
      InternalError.create("Invalid JSON in package.json", { cwd })
    );
  }

  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };
  const packages: { name: string; version: string }[] = [];

  for (const [name, version] of Object.entries(deps)) {
    if (!name.startsWith("@outfitter/")) continue;

    // Handle workspace protocol: workspace:* → skip, workspace:^0.1.0 → extract
    if (version.startsWith("workspace:")) {
      const wsVersion = version.slice("workspace:".length);
      if (wsVersion === "*" || wsVersion === "~" || wsVersion === "^") {
        continue;
      }
      const wsClean = wsVersion.replace(/^[\^~>=<]+/, "");
      try {
        if (!Bun.semver.satisfies(wsClean, "*")) continue;
      } catch {
        continue;
      }
      packages.push({ name, version: wsClean });
      continue;
    }

    const cleaned = version.replace(/^[\^~>=<]+/, "");

    // Skip non-semver versions (file:, git+ssh:, etc.)
    try {
      if (!Bun.semver.satisfies(cleaned, "*")) continue;
    } catch {
      continue;
    }

    packages.push({ name, version: cleaned });
  }

  return Result.ok(packages);
}

/**
 * Query npm registry for the latest version of a package.
 */
async function getLatestVersion(name: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(["npm", "view", name, "version"], {
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) return null;
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// =============================================================================
// Migration Doc Discovery
// =============================================================================

/** Known relative locations for migration docs. */
const MIGRATION_DOC_PATHS = [
  "plugins/kit/shared/migrations",
  "node_modules/@outfitter/kit/shared/migrations",
];

/**
 * Find migration docs directory, checking known locations.
 *
 * Searches:
 * 1. Relative to the target cwd
 * 2. Walking up parent directories from cwd (monorepo root detection)
 * 3. Relative to the outfitter binary itself (development mode)
 */
export function findMigrationDocsDir(
  cwd: string,
  binaryDir?: string
): string | null {
  // Check relative to target cwd
  for (const relative of MIGRATION_DOC_PATHS) {
    const dir = join(cwd, relative);
    if (existsSync(dir)) return dir;
  }

  // Walk up from cwd looking for monorepo root with plugin docs
  let current = resolve(cwd);
  const root = resolve("/");
  while (current !== root) {
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;

    for (const relative of MIGRATION_DOC_PATHS) {
      const dir = join(current, relative);
      if (existsSync(dir)) return dir;
    }
  }

  // Check relative to the outfitter binary itself (dev mode)
  // apps/outfitter/src/commands → ../../../.. → repo root (dev mode)
  const resolvedBinaryDir =
    binaryDir ?? resolve(import.meta.dir, "../../../..");
  for (const relative of MIGRATION_DOC_PATHS) {
    const dir = join(resolvedBinaryDir, relative);
    if (existsSync(dir)) return dir;
  }

  return null;
}

/**
 * Read all migration docs for a package between two versions.
 *
 * Scans the migrations directory for docs matching the package name,
 * filters to versions greater than `fromVersion` and at most `toVersion`,
 * and returns their contents sorted by version ascending.
 */
export function readMigrationDocs(
  migrationsDir: string,
  shortName: string,
  fromVersion: string,
  toVersion: string
): string[] {
  const glob = new Bun.Glob(`outfitter-${shortName}-*.md`);
  const versionPattern = new RegExp(
    `^outfitter-${shortName}-(\\d+\\.\\d+\\.\\d+)\\.md$`
  );

  const docs: { version: string; content: string }[] = [];

  for (const entry of glob.scanSync({ cwd: migrationsDir })) {
    const match = entry.match(versionPattern);
    if (!match?.[1]) continue;

    const docVersion = match[1];

    // Doc version must be greater than current installed version
    if (Bun.semver.order(docVersion, fromVersion) <= 0) continue;

    // Doc version must be at most the target version
    if (Bun.semver.order(docVersion, toVersion) > 0) continue;

    const filePath = join(migrationsDir, entry);
    const content = readFileSync(filePath, "utf-8");
    // Strip frontmatter
    const body = content.replace(/^---\n[\s\S]*?\n---\n*/, "").trim();
    if (body) {
      docs.push({ version: docVersion, content: body });
    }
  }

  // Sort by version ascending
  docs.sort((a, b) => Bun.semver.order(a.version, b.version));

  return docs.map((d) => d.content);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Run the update command — detect installed versions and query npm for latest.
 */
export async function runUpdate(
  options: UpdateOptions
): Promise<Result<UpdateResult, OutfitterError>> {
  const cwd = resolve(options.cwd);
  const installedResult = getInstalledPackages(cwd);

  if (installedResult.isErr()) return installedResult;

  const installed = installedResult.value;

  if (installed.length === 0) {
    return Result.ok({
      packages: [],
      total: 0,
      updatesAvailable: 0,
      hasBreaking: false,
    });
  }

  // Query npm for latest versions in parallel
  const packages: PackageVersionInfo[] = await Promise.all(
    installed.map(async (pkg) => {
      const latest = await getLatestVersion(pkg.name);
      const updateAvailable =
        latest !== null && Bun.semver.order(latest, pkg.version) > 0;
      const breaking =
        updateAvailable && latest !== null
          ? getMajor(latest) > getMajor(pkg.version)
          : false;

      return {
        name: pkg.name,
        current: pkg.version,
        latest,
        updateAvailable,
        breaking,
      };
    })
  );

  const updatesAvailable = packages.filter((p) => p.updateAvailable).length;
  const hasBreaking = packages.some((p) => p.breaking);

  return Result.ok({
    packages,
    total: packages.length,
    updatesAvailable,
    hasBreaking,
  });
}

function getMajor(version: string): number {
  const parts = version.split(".");
  return Number.parseInt(parts[0] ?? "0", 10);
}

/**
 * Format and output update results.
 */
export async function printUpdateResults(
  result: UpdateResult,
  options?: { mode?: OutputMode; guide?: boolean; cwd?: string }
): Promise<void> {
  const mode = options?.mode;
  if (mode === "json" || mode === "jsonl") {
    await output(result, { mode });
    return;
  }

  const theme = createTheme();
  const lines: string[] = ["", "Outfitter Update", "", "=".repeat(60)];

  if (result.packages.length === 0) {
    lines.push("No @outfitter/* packages found in package.json.");
    await output(lines);
    return;
  }

  // Version table header
  lines.push(
    `  ${"Package".padEnd(28)} ${"Current".padEnd(10)} ${"Available".padEnd(10)} Migration`
  );
  lines.push(
    `  ${"─".repeat(28)} ${"─".repeat(10)} ${"─".repeat(10)} ${"─".repeat(20)}`
  );

  for (const pkg of result.packages) {
    const name = pkg.name.padEnd(28);
    const current = pkg.current.padEnd(10);
    const available = (pkg.latest ?? "unknown").padEnd(10);

    let migration: string;
    if (pkg.latest === null) {
      migration = theme.muted("lookup failed");
    } else if (!pkg.updateAvailable) {
      migration = theme.muted("up to date");
    } else if (pkg.breaking) {
      migration = theme.error("major (breaking)");
    } else {
      migration = theme.success("minor (no breaking)");
    }

    lines.push(`  ${name} ${current} ${available} ${migration}`);
  }

  lines.push("");

  if (result.updatesAvailable > 0) {
    lines.push(
      theme.muted("Run 'outfitter update --guide' for migration instructions.")
    );
  } else {
    lines.push(theme.success("All packages are up to date."));
  }

  // Migration guide section
  if (options?.guide && result.updatesAvailable > 0) {
    const cwd = options.cwd ?? process.cwd();
    const migrationsDir = findMigrationDocsDir(cwd);

    if (migrationsDir) {
      lines.push("", "=".repeat(60), "", "Migration Guide", "");

      for (const pkg of result.packages) {
        if (!(pkg.updateAvailable && pkg.latest)) continue;

        const shortName = pkg.name.replace("@outfitter/", "");
        const docs = readMigrationDocs(
          migrationsDir,
          shortName,
          pkg.current,
          pkg.latest
        );

        for (const doc of docs) {
          lines.push(doc, "", "---", "");
        }
      }
    } else {
      lines.push(
        "",
        theme.muted(
          "Migration docs not found locally. See https://github.com/outfitter-dev/outfitter for migration guides."
        )
      );
    }
  }

  await output(lines);
}
