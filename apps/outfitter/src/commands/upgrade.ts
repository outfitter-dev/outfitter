/**
 * `outfitter upgrade` - Detect installed @outfitter/* versions and show available updates.
 *
 * Reads package.json, queries npm for latest versions, and optionally
 * shows migration guidance from the outfitter plugin's migration docs.
 *
 * @packageDocumentation
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { output } from "@outfitter/cli";
import type { OutputMode } from "@outfitter/cli/types";
import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result } from "@outfitter/contracts";
import { createTheme } from "@outfitter/tui/render";
import { resolveStructuredOutputMode } from "../output-mode.js";
import {
  discoverCodemods,
  findCodemodsDir,
  runCodemod,
} from "./upgrade-codemods.js";
import { analyzeUpgrades } from "./upgrade-planner.js";
import {
  applyUpdatesToWorkspace,
  getInstalledPackagesFromWorkspace,
  runInstall,
  type VersionConflict,
} from "./upgrade-workspace.js";

const FRONTMATTER_BLOCK_REGEX = /^---\r?\n[\s\S]*?\r?\n---\r?\n*/;

// =============================================================================
// Types
// =============================================================================

export interface UpgradeOptions {
  /** Include breaking changes in the upgrade */
  readonly all?: boolean;
  /** Working directory (defaults to cwd) */
  readonly cwd: string;
  /** Preview only — no mutations, no prompt */
  readonly dryRun?: boolean;
  /** Show migration guide */
  readonly guide?: boolean;
  /** Filter to specific package names (scan + guides) */
  readonly guidePackages?: readonly string[];
  /** Whether interactive prompts are enabled (false in CI) */
  readonly interactive?: boolean;
  /** Skip automatic codemod execution during upgrade */
  readonly noCodemods?: boolean;
  /** Output mode */
  readonly outputMode?: OutputMode;
  /** Auto-confirm without prompting */
  readonly yes?: boolean;
}

export interface PackageVersionInfo {
  /** Whether the update contains breaking changes (major bump) */
  readonly breaking: boolean;
  /** Currently installed version */
  readonly current: string;
  /** Latest available version from npm (null if query failed) */
  readonly latest: string | null;
  /** Full package name */
  readonly name: string;
  /** Whether an update is available */
  readonly updateAvailable: boolean;
}

/** Classification of a change within a migration. */
export type MigrationChangeType =
  | "renamed"
  | "removed"
  | "signature-changed"
  | "moved"
  | "deprecated"
  | "added";

/** A single structured change entry from migration frontmatter. */
export interface MigrationChange {
  /** Path to codemod script relative to the codemods directory. */
  readonly codemod?: string;
  readonly detail?: string;
  readonly export?: string;
  readonly from?: string;
  readonly path?: string;
  readonly to?: string;
  readonly type: MigrationChangeType;
}

/** Parsed frontmatter from a migration doc. */
export interface MigrationFrontmatter {
  readonly breaking: boolean;
  readonly changes?: readonly MigrationChange[];
  readonly package: string;
  readonly version: string;
}

/** A migration doc with parsed frontmatter and body content. */
export interface MigrationDocWithMetadata {
  readonly body: string;
  readonly frontmatter: MigrationFrontmatter;
  readonly version: string;
}

export interface MigrationGuide {
  /** Whether this is a breaking change */
  readonly breaking: boolean;
  /** Structured changes from migration frontmatter, if available */
  readonly changes?: readonly MigrationChange[];
  /** Currently installed version */
  readonly fromVersion: string;
  /** The @outfitter/* package name */
  readonly packageName: string;
  /** Migration step strings (empty if no guide exists) */
  readonly steps: readonly string[];
  /** Latest available version */
  readonly toVersion: string;
}

/** Summary of codemods executed during --apply. */
export interface CodemodSummary {
  /** Total files changed across all codemods */
  readonly changedFiles: readonly string[];
  /** Number of codemods executed */
  readonly codemodCount: number;
  /** Errors encountered during codemod execution */
  readonly errors: readonly string[];
}

export interface UpgradeResult {
  /** Whether mutations were made (--apply was used and changes were written) */
  readonly applied: boolean;
  /** Package names that were updated in package.json */
  readonly appliedPackages: string[];
  /** Codemod execution summary (populated when --apply runs codemods) */
  readonly codemods?: CodemodSummary;
  /** Version conflicts found across workspace manifests */
  readonly conflicts?: readonly VersionConflict[];
  /** Structured migration guides (populated when --guide is used) */
  readonly guides?: readonly MigrationGuide[];
  /** Whether any update is a breaking change */
  readonly hasBreaking: boolean;
  /** Package version info */
  readonly packages: PackageVersionInfo[];
  /** Package names skipped because they contain breaking changes */
  readonly skippedBreaking: string[];
  /** Total packages checked */
  readonly total: number;
  /** Package names that were requested but not found in the workspace */
  readonly unknownPackages?: readonly string[];
  /** Number of packages with updates available */
  readonly updatesAvailable: number;
}

// =============================================================================
// Version Detection
// =============================================================================

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
const MIGRATION_DOC_PATHS = ["plugins/outfitter/shared/migrations"];

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
    const body = content.replace(FRONTMATTER_BLOCK_REGEX, "").trim();
    if (body) {
      docs.push({ version: docVersion, content: body });
    }
  }

  // Sort by version ascending
  docs.sort((a, b) => Bun.semver.order(a.version, b.version));

  return docs.map((d) => d.content);
}

/**
 * Read the `breaking` flag for an exact migration doc version, if present.
 *
 * Returns:
 * - `true` or `false` when the frontmatter contains `breaking: ...`
 * - `undefined` when the doc is missing, unreadable, or has no valid flag
 */
export function readMigrationBreakingFlag(
  migrationsDir: string,
  shortName: string,
  version: string
): boolean | undefined {
  const filePath = join(migrationsDir, `outfitter-${shortName}-${version}.md`);

  if (!existsSync(filePath)) {
    return undefined;
  }

  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return undefined;
  }

  const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatter?.[1]) {
    return undefined;
  }

  const breakingLine = frontmatter[1]
    .split(/\r?\n/)
    .find((line) => line.trimStart().startsWith("breaking:"));

  if (breakingLine === undefined) {
    return undefined;
  }

  const rawValue = breakingLine.split(":").slice(1).join(":").trim();
  if (rawValue === "true") return true;
  if (rawValue === "false") return false;
  return undefined;
}

// =============================================================================
// Structured Frontmatter Parsing
// =============================================================================

const VALID_CHANGE_TYPES = new Set<MigrationChangeType>([
  "renamed",
  "removed",
  "signature-changed",
  "moved",
  "deprecated",
  "added",
]);

/**
 * Parse a YAML value, stripping optional surrounding quotes.
 */
function parseYamlValue(raw: string): string {
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

/**
 * Parse the full frontmatter from a migration doc, including the `changes` array.
 *
 * Returns `null` if the content has no valid frontmatter or is missing
 * required fields (`package`, `version`, `breaking`).
 */
export function parseMigrationFrontmatter(
  content: string
): MigrationFrontmatter | null {
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fmMatch?.[1]) return null;

  const fmBlock = fmMatch[1];
  const lines = fmBlock.split(/\r?\n/);

  // Parse top-level scalar fields
  let pkg: string | undefined;
  let version: string | undefined;
  let breaking: boolean | undefined;

  // Track where the changes array starts
  let changesStartIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;
    const trimmed = line.trimStart();

    if (trimmed.startsWith("package:")) {
      pkg = parseYamlValue(trimmed.slice("package:".length));
    } else if (trimmed.startsWith("version:")) {
      version = parseYamlValue(trimmed.slice("version:".length));
    } else if (trimmed.startsWith("breaking:")) {
      const val = parseYamlValue(trimmed.slice("breaking:".length));
      if (val === "true") breaking = true;
      else if (val === "false") breaking = false;
    } else if (trimmed.startsWith("changes:")) {
      changesStartIdx = i + 1;
    }
  }

  if (pkg === undefined || version === undefined || breaking === undefined) {
    return null;
  }

  // Parse changes array if present
  let changes: MigrationChange[] | undefined;
  if (changesStartIdx >= 0) {
    changes = parseChangesArray(lines, changesStartIdx);
  }

  return {
    package: pkg,
    version,
    breaking,
    ...(changes !== undefined ? { changes } : {}),
  };
}

/**
 * Parse the YAML `changes` array from frontmatter lines starting at `startIdx`.
 *
 * Each item begins with `  - type: ...` and may have additional key/value pairs
 * indented under it.
 */
function parseChangesArray(
  lines: string[],
  startIdx: number
): MigrationChange[] {
  const changes: MigrationChange[] = [];
  let current: Record<string, string> | null = null;

  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // New list item: starts with "  - "
    if (/^\s+-\s+/.test(line)) {
      if (current !== null) {
        const change = buildChange(current);
        if (change) changes.push(change);
      }
      current = {};
      // Parse the key/value on the same line as the dash
      const afterDash = line.replace(/^\s+-\s+/, "");
      const colonIdx = afterDash.indexOf(":");
      if (colonIdx >= 0) {
        const key = afterDash.slice(0, colonIdx).trim();
        const val = parseYamlValue(afterDash.slice(colonIdx + 1));
        current[key] = val;
      }
    } else if (current !== null && /^\s{4,}\S/.test(line)) {
      // Continuation line for current item (indented further)
      const trimmed = line.trim();
      const colonIdx = trimmed.indexOf(":");
      if (colonIdx >= 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const val = parseYamlValue(trimmed.slice(colonIdx + 1));
        current[key] = val;
      }
    } else if (/^\S/.test(line)) {
      // Non-indented line means we've left the changes block
      break;
    }
  }

  // Flush last item
  if (current !== null) {
    const change = buildChange(current);
    if (change) changes.push(change);
  }

  return changes;
}

/**
 * Build a MigrationChange from a parsed key/value map.
 */
function buildChange(raw: Record<string, string>): MigrationChange | null {
  const type = raw["type"];
  if (!(type && VALID_CHANGE_TYPES.has(type as MigrationChangeType))) {
    return null;
  }

  return {
    type: type as MigrationChangeType,
    ...(raw["from"] ? { from: raw["from"] } : {}),
    ...(raw["to"] ? { to: raw["to"] } : {}),
    ...(raw["path"] ? { path: raw["path"] } : {}),
    ...(raw["export"] ? { export: raw["export"] } : {}),
    ...(raw["detail"] ? { detail: raw["detail"] } : {}),
    ...(raw["codemod"] ? { codemod: raw["codemod"] } : {}),
  };
}

/**
 * Read all migration docs for a package between two versions,
 * returning parsed frontmatter alongside the body content.
 *
 * Like `readMigrationDocs` but returns structured metadata instead of
 * plain strings. Used by the codemod infrastructure to discover
 * machine-actionable changes.
 */
export function readMigrationDocsWithMetadata(
  migrationsDir: string,
  shortName: string,
  fromVersion: string,
  toVersion: string
): MigrationDocWithMetadata[] {
  const glob = new Bun.Glob(`outfitter-${shortName}-*.md`);
  const versionPattern = new RegExp(
    `^outfitter-${shortName}-(\\d+\\.\\d+\\.\\d+)\\.md$`
  );

  const docs: MigrationDocWithMetadata[] = [];

  for (const entry of glob.scanSync({ cwd: migrationsDir })) {
    const match = entry.match(versionPattern);
    if (!match?.[1]) continue;

    const docVersion = match[1];

    if (Bun.semver.order(docVersion, fromVersion) <= 0) continue;
    if (Bun.semver.order(docVersion, toVersion) > 0) continue;

    const filePath = join(migrationsDir, entry);
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      continue;
    }

    const frontmatter = parseMigrationFrontmatter(content);
    if (!frontmatter) continue;

    const body = content.replace(FRONTMATTER_BLOCK_REGEX, "").trim();
    docs.push({ frontmatter, body, version: docVersion });
  }

  docs.sort((a, b) => Bun.semver.order(a.version, b.version));

  return docs;
}

// =============================================================================
// Migration Guide Builder
// =============================================================================

/**
 * Build structured migration guides for packages with available updates.
 *
 * For each package with an update, produces a `MigrationGuide` with steps
 * extracted from migration docs (if a migrations directory is available).
 * Packages without updates or without a resolved latest version are skipped.
 *
 * This function is pure — no side effects beyond reading migration doc files
 * when `migrationsDir` is provided.
 */
export function buildMigrationGuides(
  packages: readonly PackageVersionInfo[],
  migrationsDir: string | null
): MigrationGuide[] {
  const guides: MigrationGuide[] = [];

  for (const pkg of packages) {
    if (!pkg.updateAvailable || pkg.latest === null) continue;

    let steps: string[] = [];
    let allChanges: MigrationChange[] | undefined;

    if (migrationsDir !== null) {
      const shortName = pkg.name.replace("@outfitter/", "");
      const metaDocs = readMigrationDocsWithMetadata(
        migrationsDir,
        shortName,
        pkg.current,
        pkg.latest
      );
      steps = metaDocs.map((doc) => doc.body);

      // Collect structured changes from all migration docs in range.
      const changes: MigrationChange[] = [];
      for (const doc of metaDocs) {
        if (doc.frontmatter.changes) {
          changes.push(...doc.frontmatter.changes);
        }
      }
      if (changes.length > 0) {
        allChanges = changes;
      }
    }

    guides.push({
      packageName: pkg.name,
      fromVersion: pkg.current,
      toVersion: pkg.latest,
      breaking: pkg.breaking,
      steps,
      ...(allChanges !== undefined ? { changes: allChanges } : {}),
    });
  }

  return guides;
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
 * Run the upgrade command — detect installed versions and query npm for latest.
 *
 * Default flow: scan → classify → prompt → apply.
 * `--dry-run` returns a report without mutation.
 * `--all` includes breaking changes.
 * `--yes` or `--non-interactive` bypasses the prompt.
 */
export async function runUpgrade(
  options: UpgradeOptions
): Promise<Result<UpgradeResult, OutfitterError>> {
  const cwd = resolve(options.cwd);
  const startedAt = new Date();
  let workspaceRoot: string | null = null;
  const emptyResult: UpgradeResult = {
    packages: [],
    total: 0,
    updatesAvailable: 0,
    hasBreaking: false,
    applied: false,
    appliedPackages: [],
    skippedBreaking: [],
  };

  const writeReport = (
    status: UpgradeReportStatus,
    result: UpgradeResult,
    error?: OutfitterError
  ): void => {
    writeUpgradeReportSafely(cwd, result, {
      status,
      startedAt,
      workspaceRoot,
      options,
      ...(error !== undefined ? { error } : {}),
    });
  };

  try {
    const migrationsDir = findMigrationDocsDir(cwd);
    // For breaking classification overrides, only use project-discoverable docs.
    // Passing `cwd` as `binaryDir` disables the dev-mode fallback to repo-root docs.
    const migrationFlagsDir = findMigrationDocsDir(cwd, cwd);

    // Workspace-aware scanning: detect workspace root and collect all manifests
    const scanResult = getInstalledPackagesFromWorkspace(cwd);
    if (scanResult.isErr()) {
      writeReport("failed", emptyResult, scanResult.error);
      return scanResult;
    }

    const scan = scanResult.value;
    workspaceRoot = scan.workspaceRoot;

    // Filter to requested packages when positional args are provided
    const requestedPackages = options.guidePackages;
    let installed = scan.packages;
    let unknownPackages: string[] | undefined;

    if (requestedPackages && requestedPackages.length > 0) {
      const filterSet = new Set(
        requestedPackages.map((p) =>
          p.startsWith("@") ? p : `@outfitter/${p}`
        )
      );
      const found = new Set<string>();
      installed = scan.packages.filter((pkg) => {
        if (filterSet.has(pkg.name)) {
          found.add(pkg.name);
          return true;
        }
        return false;
      });
      const notFound = [...filterSet].filter((name) => !found.has(name));
      if (notFound.length > 0) {
        unknownPackages = notFound;
      }
    }

    // Determine the effective root for install (workspace root or cwd)
    const installRoot = scan.workspaceRoot ?? cwd;
    const codemodTargetDir = scan.workspaceRoot ?? cwd;

    if (installed.length === 0 && !unknownPackages?.length) {
      const result: UpgradeResult = {
        ...emptyResult,
        ...(scan.conflicts.length > 0 ? { conflicts: scan.conflicts } : {}),
      };
      writeReport("no_updates", result);
      return Result.ok(result);
    }

    if (installed.length === 0 && unknownPackages?.length) {
      const result: UpgradeResult = {
        ...emptyResult,
        unknownPackages,
        ...(scan.conflicts.length > 0 ? { conflicts: scan.conflicts } : {}),
      };
      writeReport("no_updates", result);
      return Result.ok(result);
    }

    // Query npm for latest versions in parallel
    const latestVersions = new Map<
      string,
      { version: string; breaking?: boolean }
    >();
    const installedMap = new Map<string, string>();
    const npmFailures = new Set<string>();

    await Promise.all(
      installed.map(async (pkg) => {
        installedMap.set(pkg.name, pkg.version);
        const latest = await getLatestVersion(pkg.name);
        if (latest !== null) {
          // npm doesn't tell us if it's breaking. When local migration docs include
          // an explicit breaking flag for this exact target version, prefer it.
          const shortName = pkg.name.replace("@outfitter/", "");
          const docBreaking =
            migrationFlagsDir !== null
              ? readMigrationBreakingFlag(migrationFlagsDir, shortName, latest)
              : undefined;
          latestVersions.set(pkg.name, {
            version: latest,
            ...(docBreaking !== undefined ? { breaking: docBreaking } : {}),
          });
        } else {
          npmFailures.add(pkg.name);
        }
      })
    );

    // Use the pure planner for analysis
    const plan = analyzeUpgrades(installedMap, latestVersions);

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
    const breakingUpgradable = plan.packages.filter(
      (a) => a.classification === "upgradableBreaking"
    );

    // When --all is set, include breaking updates in the apply set
    const includeBreaking = options.all === true;
    const packagesToApply = includeBreaking
      ? [...nonBreakingUpgradable, ...breakingUpgradable]
      : nonBreakingUpgradable;
    const skippedBreaking: string[] = includeBreaking
      ? []
      : breakingUpgradable.map((a) => a.name);

    // Build structured migration guides when --guide is requested
    const guidesData =
      options.guide === true
        ? buildMigrationGuides(packages, migrationsDir)
        : undefined;

    // Note: guide filter is unnecessary here — `buildMigrationGuides` already
    // operates on the filtered `packages` list from the scan filter above.

    const buildResult = (
      overrides: Partial<UpgradeResult> = {}
    ): UpgradeResult => ({
      packages,
      total: packages.length,
      updatesAvailable,
      hasBreaking,
      applied: false,
      appliedPackages: [],
      skippedBreaking,
      ...(guidesData !== undefined ? { guides: guidesData } : {}),
      ...(unknownPackages !== undefined ? { unknownPackages } : {}),
      ...(scan.conflicts.length > 0 ? { conflicts: scan.conflicts } : {}),
      ...overrides,
    });

    // --dry-run: return report without mutation
    if (options.dryRun) {
      const result = buildResult();
      writeReport("dry_run", result);
      return Result.ok(result);
    }

    // No updates to apply — return early
    if (packagesToApply.length === 0) {
      const result = buildResult();
      writeReport("no_updates", result);
      return Result.ok(result);
    }

    // Interactive confirmation (unless --yes or --non-interactive)
    if (options.yes !== true && options.interactive !== false) {
      const { confirmDestructive } = await import("@outfitter/tui/confirm");
      const confirmed = await confirmDestructive({
        message: `Apply ${packagesToApply.length} upgrade(s)?`,
        itemCount: packagesToApply.length,
        bypassFlag: false,
      });

      if (confirmed.isErr()) {
        // User cancelled or non-TTY — return report without mutation
        const result = buildResult();
        writeReport("cancelled", result);
        return Result.ok(result);
      }
    } else if (options.interactive === false && options.yes !== true) {
      // Non-interactive without --yes: skip mutation (same as dry-run)
      const result = buildResult();
      writeReport("skipped_non_interactive", result);
      return Result.ok(result);
    }

    let applied = false;
    const appliedPackages: string[] = [];

    // Apply upgrades
    if (packagesToApply.length > 0) {
      if (scan.workspaceRoot !== null) {
        // Workspace mode: update all manifests in one pass, then install once at root
        const applyResult = await applyUpdatesToWorkspace(
          scan.manifestPaths,
          scan.manifestsByPackage,
          packagesToApply
        );
        if (applyResult.isErr()) {
          const failureResult = buildResult();
          writeReport("failed", failureResult, applyResult.error);
          return applyResult;
        }

        const installResult = await runInstall(installRoot);
        if (installResult.isErr()) {
          const failureResult = buildResult();
          writeReport("failed", failureResult, installResult.error);
          return installResult;
        }
      } else {
        // Single-package mode: applyUpdates handles both write and install
        const applyResult = await applyUpdates(cwd, packagesToApply);
        if (applyResult.isErr()) {
          const failureResult = buildResult();
          writeReport("failed", failureResult, applyResult.error);
          return applyResult;
        }
      }

      applied = true;
      appliedPackages.push(...packagesToApply.map((a) => a.name));
    }

    // Run codemods for applied packages (unless --no-codemods)
    let codemodSummary: CodemodSummary | undefined;
    if (applied && options.noCodemods !== true && migrationsDir !== null) {
      const codemodsDir = findCodemodsDir(cwd);
      if (codemodsDir !== null) {
        const allChangedFiles: string[] = [];
        const allErrors: string[] = [];
        let codemodCount = 0;

        for (const pkg of packagesToApply) {
          const shortName = pkg.name.replace("@outfitter/", "");
          const codemods = discoverCodemods(
            migrationsDir,
            codemodsDir,
            shortName,
            installedMap.get(pkg.name) ?? "0.0.0",
            pkg.latestVersion
          );

          for (const codemod of codemods) {
            const codemodResult = await runCodemod(
              codemod.absolutePath,
              codemodTargetDir,
              false
            );
            codemodCount++;

            if (codemodResult.isOk()) {
              allChangedFiles.push(...codemodResult.value.changedFiles);
              allErrors.push(...codemodResult.value.errors);
            } else {
              allErrors.push(codemodResult.error.message);
            }
          }
        }

        if (codemodCount > 0) {
          codemodSummary = {
            codemodCount,
            changedFiles: allChangedFiles,
            errors: allErrors,
          };
        }
      }
    }

    const finalResult = buildResult({
      applied,
      appliedPackages,
      ...(codemodSummary !== undefined ? { codemods: codemodSummary } : {}),
    });

    writeReport("applied", finalResult);
    return Result.ok(finalResult);
  } catch (error) {
    const normalizedError: OutfitterError =
      error &&
      typeof error === "object" &&
      "category" in error &&
      "message" in error
        ? (error as OutfitterError)
        : InternalError.create("Unexpected error in outfitter upgrade", {
            cwd,
            error: error instanceof Error ? error.message : String(error),
          });

    writeReport("failed", emptyResult, normalizedError);
    return Result.err(normalizedError);
  }
}

/**
 * Format and output upgrade results.
 */
export async function printUpgradeResults(
  result: UpgradeResult,
  options?: {
    mode?: OutputMode;
    guide?: boolean;
    cwd?: string;
    dryRun?: boolean;
    all?: boolean;
  }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);
  if (structuredMode) {
    await output(result, { mode: structuredMode });
    return;
  }

  const theme = createTheme();
  const lines: string[] = ["", "Outfitter Upgrade", "", "=".repeat(60)];

  if (result.packages.length === 0) {
    lines.push("No @outfitter/* packages found in package.json.");
    if (!result.unknownPackages || result.unknownPackages.length === 0) {
      await output(lines, { mode: "human" });
      return;
    }
    lines.push("");
  } else {
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
  }

  // Apply summary
  if (result.applied && result.appliedPackages.length > 0) {
    // Separate applied packages into breaking and non-breaking for display
    const breakingApplied = result.appliedPackages.filter((name) =>
      result.packages.some((p) => p.name === name && p.breaking)
    );
    const nonBreakingApplied = result.appliedPackages.filter(
      (name) => !result.packages.some((p) => p.name === name && p.breaking)
    );

    if (nonBreakingApplied.length > 0) {
      lines.push(
        theme.success(
          `Applied ${nonBreakingApplied.length} non-breaking upgrade(s):`
        )
      );
      for (const name of nonBreakingApplied) {
        lines.push(`  - ${name}`);
      }
      lines.push("");
    }

    if (breakingApplied.length > 0) {
      lines.push(
        theme.error(`Applied ${breakingApplied.length} breaking upgrade(s):`)
      );
      for (const name of breakingApplied) {
        const pkg = result.packages.find((p) => p.name === name);
        lines.push(`  - ${name} (${pkg?.current} -> ${pkg?.latest})`);
      }
      lines.push(
        "",
        theme.muted("Review migration guides: 'outfitter upgrade --guide'")
      );
      lines.push("");
    }
  }

  // Excluded breaking section (when --all is NOT used and breaking changes exist)
  if (result.skippedBreaking.length > 0 && options?.all !== true) {
    if (result.applied) {
      lines.push(
        theme.error(
          `Skipped ${result.skippedBreaking.length} breaking upgrade(s):`
        )
      );
    } else {
      lines.push("  Excluded (breaking):");
    }
    for (const name of result.skippedBreaking) {
      const pkg = result.packages.find((p) => p.name === name);
      const codemodHint = pkg?.breaking ? "(migration guide)" : "";
      lines.push(
        `    ${name.padEnd(24)} ${(pkg?.current ?? "").padEnd(8)} -> ${(pkg?.latest ?? "").padEnd(8)} ${codemodHint}`.trimEnd()
      );
    }
    lines.push("", theme.muted("  Use --all to include breaking changes"));
    lines.push("");
  }

  if (result.codemods !== undefined) {
    const uniqueChangedFiles = [
      ...new Set(result.codemods.changedFiles),
    ].sort();
    lines.push(theme.info(`Ran ${result.codemods.codemodCount} codemod(s).`));

    if (uniqueChangedFiles.length > 0) {
      lines.push(
        theme.success(`Codemods changed ${uniqueChangedFiles.length} file(s):`)
      );
      for (const file of uniqueChangedFiles) {
        lines.push(`  - ${file}`);
      }
    }

    if (result.codemods.errors.length > 0) {
      lines.push(
        theme.error(`Codemod errors (${result.codemods.errors.length}):`)
      );
      for (const error of result.codemods.errors) {
        lines.push(`  - ${error}`);
      }
    }

    lines.push("");
  }

  // Version conflicts section
  if (result.conflicts && result.conflicts.length > 0) {
    lines.push(
      theme.warning(
        `Version conflict(s) across workspace (${result.conflicts.length}):`
      )
    );
    for (const conflict of result.conflicts) {
      lines.push(`  ${conflict.name}`);
      for (const entry of conflict.versions) {
        const manifests = entry.manifests
          .map((m) => {
            // Show the parent directory of package.json (e.g. "packages/cli")
            const dir = m.replace(/\/package\.json$/, "");
            const parts = dir.split("/");
            // Take last 2 path segments for readability
            return parts.slice(-2).join("/");
          })
          .join(", ");
        lines.push(`    ${entry.version.padEnd(10)} ${theme.muted(manifests)}`);
      }
    }
    lines.push("");
  }

  // Unknown packages section
  if (result.unknownPackages && result.unknownPackages.length > 0) {
    lines.push(theme.error("Unknown package(s) not found in workspace:"));
    for (const name of result.unknownPackages) {
      lines.push(`  - ${name}`);
    }
    lines.push("");
  }

  if (!result.applied) {
    if (options?.dryRun) {
      lines.push(theme.muted("Dry run — no changes applied."));
    } else if (result.updatesAvailable > 0) {
      lines.push(
        theme.muted(
          "Run 'outfitter upgrade --guide' for migration instructions."
        )
      );
    } else {
      lines.push(theme.success("All packages are up to date."));
    }
  }

  // Structured migration guide section (from result.guides)
  if (options?.guide && result.guides && result.guides.length > 0) {
    lines.push("", "=".repeat(60), "", "Migration Guide", "");

    for (const guide of result.guides) {
      const label = guide.breaking
        ? theme.error("BREAKING")
        : theme.success("non-breaking");
      lines.push(
        `${theme.info(guide.packageName)} ${guide.fromVersion} -> ${guide.toVersion} [${label}]`
      );

      if (guide.steps.length > 0) {
        for (const step of guide.steps) {
          lines.push(`  ${step}`);
        }
      } else {
        lines.push(
          `  ${theme.muted("No migration steps available. Check release notes.")}`
        );
      }
      lines.push("");
    }
  } else if (options?.guide && result.updatesAvailable > 0 && !result.guides) {
    // Fallback: --guide was requested in output but guides weren't built into the result
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

  await output(lines, { mode: "human" });
}

// =============================================================================
// Upgrade Report
// =============================================================================

export type UpgradeReportStatus =
  | "dry_run"
  | "no_updates"
  | "cancelled"
  | "skipped_non_interactive"
  | "applied"
  | "failed";

/** Snapshot of effective flags for this upgrade run. */
export interface UpgradeReportFlags {
  readonly all: boolean;
  readonly dryRun: boolean;
  readonly interactive: boolean;
  readonly noCodemods: boolean;
  readonly outputMode: OutputMode | null;
  readonly yes: boolean;
}

/** Machine-readable upgrade report written to `.outfitter/reports/upgrade.json`. */
export interface UpgradeReport {
  readonly $schema: "https://outfitter.dev/reports/upgrade/v1";
  readonly applied: boolean;
  readonly checkedAt: string;
  readonly codemods?: CodemodSummary;
  readonly conflicts?: readonly VersionConflict[];
  readonly cwd: string;
  readonly error?: {
    readonly message: string;
    readonly category: string;
    readonly context?: Record<string, unknown>;
  };
  readonly excluded: {
    readonly breaking: readonly string[];
  };
  readonly finishedAt: string;
  readonly flags: UpgradeReportFlags;
  readonly packages: readonly PackageVersionInfo[];
  readonly startedAt: string;
  readonly status: UpgradeReportStatus;
  readonly summary: {
    readonly total: number;
    readonly available: number;
    readonly breaking: number;
    readonly applied: number;
  };
  readonly unknownPackages?: readonly string[];
  readonly workspaceRoot: string | null;
}

interface WriteUpgradeReportMeta {
  readonly error?: OutfitterError;
  readonly options: UpgradeOptions;
  readonly startedAt: Date;
  readonly status: UpgradeReportStatus;
  readonly workspaceRoot: string | null;
}

/**
 * Write a machine-readable upgrade report to `.outfitter/reports/upgrade.json`.
 *
 * Creates the directory if it doesn't exist. Always represents the latest check state.
 */
function writeUpgradeReport(
  cwd: string,
  result: UpgradeResult,
  meta: WriteUpgradeReportMeta
): void {
  const reportsDir = join(cwd, ".outfitter", "reports");
  mkdirSync(reportsDir, { recursive: true });
  const finishedAtIso = new Date().toISOString();
  const errorContext =
    meta.error !== undefined &&
    "context" in meta.error &&
    meta.error.context !== undefined &&
    typeof meta.error.context === "object"
      ? (meta.error.context as Record<string, unknown>)
      : undefined;

  const report: UpgradeReport = {
    $schema: "https://outfitter.dev/reports/upgrade/v1",
    status: meta.status,
    checkedAt: finishedAtIso,
    startedAt: meta.startedAt.toISOString(),
    finishedAt: finishedAtIso,
    cwd,
    workspaceRoot: meta.workspaceRoot,
    flags: {
      dryRun: meta.options.dryRun === true,
      yes: meta.options.yes === true,
      interactive: meta.options.interactive !== false,
      all: meta.options.all === true,
      noCodemods: meta.options.noCodemods === true,
      outputMode: meta.options.outputMode ?? null,
    },
    applied: result.applied,
    summary: {
      total: result.total,
      available: result.updatesAvailable,
      breaking: result.packages.filter((p) => p.breaking).length,
      applied: result.appliedPackages.length,
    },
    packages: result.packages,
    excluded: {
      breaking: result.skippedBreaking,
    },
    ...(result.unknownPackages !== undefined &&
    result.unknownPackages.length > 0
      ? { unknownPackages: result.unknownPackages }
      : {}),
    ...(result.conflicts !== undefined && result.conflicts.length > 0
      ? { conflicts: result.conflicts }
      : {}),
    ...(result.codemods !== undefined ? { codemods: result.codemods } : {}),
    ...(meta.error !== undefined
      ? {
          error: {
            message: meta.error.message,
            category: meta.error.category,
            ...(errorContext !== undefined ? { context: errorContext } : {}),
          },
        }
      : {}),
  };

  writeFileSync(
    join(reportsDir, "upgrade.json"),
    JSON.stringify(report, null, 2)
  );
}

/**
 * Best-effort report writer.
 *
 * Report I/O failures should not change the primary command result.
 */
function writeUpgradeReportSafely(
  cwd: string,
  result: UpgradeResult,
  meta: WriteUpgradeReportMeta
): void {
  try {
    writeUpgradeReport(cwd, result, meta);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `[outfitter upgrade] Failed to write report: ${reason}\n`
    );
  }
}
