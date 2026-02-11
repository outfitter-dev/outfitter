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
import { analyzeUpdates } from "./update-planner.js";

// =============================================================================
// Types
// =============================================================================

export interface UpdateOptions {
  /** Working directory (defaults to cwd) */
  readonly cwd: string;
  /** Show migration guide */
  readonly guide?: boolean;
  /** Apply non-breaking updates to package.json and run bun install */
  readonly apply?: boolean;
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
  /** Whether mutations were made (--apply was used and changes were written) */
  readonly applied: boolean;
  /** Package names that were updated in package.json */
  readonly appliedPackages: string[];
  /** Package names skipped because they contain breaking changes */
  readonly skippedBreaking: string[];
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
  "plugins/outfitter/shared/migrations",
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
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      // Skip unreadable migration docs
      continue;
    }
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
// Apply Updates
// =============================================================================

/**
 * Determine the version range prefix used for a dependency specifier.
 *
 * Returns the prefix (e.g. "^", "~", ">=") or "" if the version has no prefix.
 * Workspace protocol versions are preserved as-is.
 */
function getVersionPrefix(specifier: string): string {
  if (specifier.startsWith("workspace:")) {
    const inner = specifier.slice("workspace:".length);
    return `workspace:${getVersionPrefix(inner)}`;
  }
  const match = specifier.match(/^([\^~>=<]+)/);
  return match?.[1] ?? "";
}

interface PackageJsonContent {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

/**
 * Apply non-breaking updates to package.json and run `bun install`.
 *
 * Reads the package.json, updates version ranges for the specified packages
 * (preserving the existing range prefix), writes it back, and runs install.
 */
async function applyUpdates(
  cwd: string,
  updates: readonly { name: string; latestVersion: string }[]
): Promise<Result<void, OutfitterError>> {
  const pkgPath = join(cwd, "package.json");

  let raw: string;
  try {
    raw = readFileSync(pkgPath, "utf-8");
  } catch {
    return Result.err(
      InternalError.create("Failed to read package.json for apply", { cwd })
    );
  }

  let pkg: PackageJsonContent;
  try {
    pkg = JSON.parse(raw);
  } catch {
    return Result.err(
      InternalError.create("Invalid JSON in package.json", { cwd })
    );
  }

  // Build a lookup for quick access
  const updateMap = new Map<string, string>();
  for (const u of updates) {
    updateMap.set(u.name, u.latestVersion);
  }

  // Update dependencies and devDependencies in-place
  for (const section of ["dependencies", "devDependencies"] as const) {
    const deps = pkg[section];
    if (!deps) continue;

    for (const name of Object.keys(deps)) {
      const newVersion = updateMap.get(name);
      if (newVersion === undefined) continue;

      const currentSpecifier = deps[name];
      if (currentSpecifier === undefined) continue;

      const prefix = getVersionPrefix(currentSpecifier);
      deps[name] = `${prefix}${newVersion}`;
    }
  }

  // Write the updated package.json, preserving 2-space indentation
  try {
    const updated = `${JSON.stringify(pkg, null, 2)}\n`;
    await Bun.write(pkgPath, updated);
  } catch {
    return Result.err(
      InternalError.create("Failed to write updated package.json", { cwd })
    );
  }

  // Run bun install to update the lockfile
  try {
    const proc = Bun.spawn(["bun", "install"], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      return Result.err(
        InternalError.create("bun install failed", {
          cwd,
          exitCode,
          stderr: stderr.trim(),
        })
      );
    }
  } catch {
    return Result.err(
      InternalError.create("Failed to run bun install", { cwd })
    );
  }

  return Result.ok(undefined);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Run the update command — detect installed versions and query npm for latest.
 *
 * When `apply` is true, writes updated version ranges to `package.json`
 * for non-breaking upgrades only, then runs `bun install`.
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
      applied: false,
      appliedPackages: [],
      skippedBreaking: [],
    });
  }

  // Query npm for latest versions in parallel
  const latestVersions = new Map<
    string,
    { version: string; breaking: boolean }
  >();
  const installedMap = new Map<string, string>();
  const npmFailures = new Set<string>();

  await Promise.all(
    installed.map(async (pkg) => {
      installedMap.set(pkg.name, pkg.version);
      const latest = await getLatestVersion(pkg.name);
      if (latest !== null) {
        // npm doesn't tell us if it's breaking; the planner infers from semver
        latestVersions.set(pkg.name, { version: latest, breaking: false });
      } else {
        npmFailures.add(pkg.name);
      }
    })
  );

  // Use the pure planner for analysis
  const plan = analyzeUpdates(installedMap, latestVersions);

  // Map planner output back to the existing PackageVersionInfo shape
  const packages: PackageVersionInfo[] = plan.packages.map((action) => ({
    name: action.name,
    current: action.currentVersion,
    latest: npmFailures.has(action.name) ? null : action.latestVersion,
    updateAvailable:
      action.classification === "upgradableNonBreaking" ||
      action.classification === "upgradableBreaking",
    breaking: action.breaking,
  }));

  const updatesAvailable = packages.filter((p) => p.updateAvailable).length;
  const hasBreaking = packages.some((p) => p.breaking);

  // Identify non-breaking upgradable and breaking-skipped packages
  const nonBreakingUpgradable = plan.packages.filter(
    (a) => a.classification === "upgradableNonBreaking"
  );
  const breakingSkipped = plan.packages.filter(
    (a) => a.classification === "upgradableBreaking"
  );

  let applied = false;
  const appliedPackages: string[] = [];
  const skippedBreaking: string[] = breakingSkipped.map((a) => a.name);

  // Apply non-breaking updates if --apply is set
  if (options.apply && nonBreakingUpgradable.length > 0) {
    const applyResult = await applyUpdates(cwd, nonBreakingUpgradable);
    if (applyResult.isErr()) return applyResult;
    applied = true;
    appliedPackages.push(...nonBreakingUpgradable.map((a) => a.name));
  }

  return Result.ok({
    packages,
    total: packages.length,
    updatesAvailable,
    hasBreaking,
    applied,
    appliedPackages,
    skippedBreaking,
  });
}

/**
 * Format and output update results.
 */
export async function printUpdateResults(
  result: UpdateResult,
  options?: {
    mode?: OutputMode;
    guide?: boolean;
    cwd?: string;
    applied?: boolean | undefined;
  }
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
      migration = theme.error("breaking");
    } else {
      migration = theme.success("non-breaking");
    }

    lines.push(`  ${name} ${current} ${available} ${migration}`);
  }

  lines.push("");

  // Apply summary
  if (result.applied && result.appliedPackages.length > 0) {
    lines.push(
      theme.success(
        `Applied ${result.appliedPackages.length} non-breaking update(s):`
      )
    );
    for (const name of result.appliedPackages) {
      lines.push(`  - ${name}`);
    }
    lines.push("");
  } else if (options?.applied !== undefined && options.applied === false) {
    // --apply was passed but nothing was applied
    if (result.updatesAvailable === 0) {
      lines.push(
        theme.success("All packages are up to date. Nothing to apply.")
      );
    } else if (
      result.appliedPackages.length === 0 &&
      result.skippedBreaking.length > 0
    ) {
      lines.push(
        theme.muted(
          "No non-breaking updates to apply. All available updates contain breaking changes."
        )
      );
    }
  }

  // Warn about skipped breaking updates
  if (result.skippedBreaking.length > 0 && result.applied) {
    lines.push(
      theme.error(
        `Skipped ${result.skippedBreaking.length} breaking update(s):`
      )
    );
    for (const name of result.skippedBreaking) {
      lines.push(`  - ${name}`);
    }
    lines.push(
      "",
      theme.muted(
        "Use 'outfitter update --apply --breaking' to include breaking updates."
      )
    );
    lines.push("");
  }

  if (!result.applied) {
    if (result.updatesAvailable > 0) {
      lines.push(
        theme.muted(
          "Run 'outfitter update --guide' for migration instructions."
        )
      );
    } else {
      lines.push(theme.success("All packages are up to date."));
    }
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
