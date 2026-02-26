/**
 * `outfitter upgrade` - Detect installed @outfitter/* versions and show available updates.
 *
 * Reads package.json, queries npm for latest versions, and optionally
 * shows migration guidance from the outfitter plugin's migration docs.
 *
 * @packageDocumentation
 */

import { resolve } from "node:path";

import type { OutputMode } from "@outfitter/cli/types";
import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result } from "@outfitter/contracts";

import { applyUpdates } from "./upgrade-apply.js";
import {
  discoverCodemods,
  findCodemodsDir,
  runCodemod,
} from "./upgrade-codemods.js";
import { getLatestVersion } from "./upgrade-latest-version.js";
import {
  findMigrationDocsDir,
  readMigrationBreakingFlag,
  readMigrationDocs,
  readMigrationDocsWithMetadata,
} from "./upgrade-migration-docs.js";
import {
  buildMigrationGuides,
  type MigrationGuide,
} from "./upgrade-migration-guides.js";
import { analyzeUpgrades } from "./upgrade-planner.js";
import {
  writeUpgradeReportSafely,
  type UpgradeReportStatus,
} from "./upgrade-report.js";
import {
  applyUpdatesToWorkspace,
  getInstalledPackagesFromWorkspace,
  runInstall,
  type VersionConflict,
} from "./upgrade-workspace.js";

// =============================================================================
// Types
// =============================================================================

/** Input options for `runUpgrade`. */
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

/** Version metadata for a single installed @outfitter/* package. */
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

export {
  findMigrationDocsDir,
  readMigrationBreakingFlag,
  readMigrationDocs,
  readMigrationDocsWithMetadata,
};
export type { MigrationDocWithMetadata } from "./upgrade-migration-docs.js";
export { parseMigrationFrontmatter } from "./upgrade-migration-frontmatter.js";
export type {
  MigrationChange,
  MigrationChangeType,
  MigrationFrontmatter,
} from "./upgrade-migration-frontmatter.js";
export { printUpgradeResults } from "./upgrade-output.js";
export type {
  UpgradeReport,
  UpgradeReportFlags,
  UpgradeReportStatus,
} from "./upgrade-report.js";
export { buildMigrationGuides };
export type { MigrationGuide } from "./upgrade-migration-guides.js";

/** Summary of codemods executed during --apply. */
export interface CodemodSummary {
  /** Total files changed across all codemods */
  readonly changedFiles: readonly string[];
  /** Number of codemods executed */
  readonly codemodCount: number;
  /** Errors encountered during codemod execution */
  readonly errors: readonly string[];
}

/** Complete output of a single upgrade run. */
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
