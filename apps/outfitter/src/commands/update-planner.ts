/**
 * Pure, deterministic planner for the `outfitter update` command.
 *
 * Classifies each installed package into one of four bump categories
 * based on the installed version, the latest available version, and
 * metadata about whether the bump contains breaking changes.
 *
 * Pre-1.0 packages (major version 0) treat minor bumps as breaking
 * per semver convention.
 *
 * @packageDocumentation
 */

// =============================================================================
// Types
// =============================================================================

/** Classification of a version bump for a single package. */
export type BumpClassification =
  | "upToDate"
  | "upgradableNonBreaking"
  | "upgradableBreaking"
  | "blocked";

/** Describes the planned action for a single package. */
export interface PackageUpdateAction {
  /** Full package name (e.g. "@outfitter/cli") */
  readonly name: string;
  /** Currently installed version */
  readonly currentVersion: string;
  /** Latest available version */
  readonly latestVersion: string;
  /** Bump classification */
  readonly classification: BumpClassification;
  /** Whether this update contains breaking changes */
  readonly breaking: boolean;
  /** Migration doc path if available */
  readonly migrationDoc?: string;
}

/** The complete update plan with per-package actions and aggregate summary. */
export interface UpdatePlan {
  /** Per-package update actions, sorted by name for deterministic output. */
  readonly packages: PackageUpdateAction[];
  /** Aggregate counts by classification. */
  readonly summary: {
    readonly upToDate: number;
    readonly upgradableNonBreaking: number;
    readonly upgradableBreaking: number;
    readonly blocked: number;
  };
}

// =============================================================================
// Helpers
// =============================================================================

/** Extract the major version number from a semver string. */
function getMajor(version: string): number {
  const parts = version.split(".");
  return Number.parseInt(parts[0] ?? "0", 10);
}

/** Extract the minor version number from a semver string. */
function getMinor(version: string): number {
  const parts = version.split(".");
  return Number.parseInt(parts[1] ?? "0", 10);
}

/**
 * Determine whether a version bump is breaking.
 *
 * Rules (evaluated in order):
 * - Explicit `true` flag: always breaking.
 * - Explicit `false` flag: always non-breaking (overrides semver heuristics).
 * - `undefined` flag: fall through to semver heuristics:
 *   - Major version increase is always breaking.
 *   - For pre-1.0 packages (major === 0), a minor version increase is breaking
 *     (semver convention: 0.x minor bumps may contain breaking changes).
 *   - Otherwise, non-breaking.
 */
function isBreaking(
  currentVersion: string,
  latestVersion: string,
  breakingFlag?: boolean
): boolean {
  // Explicit override takes precedence
  if (breakingFlag === true) return true;
  if (breakingFlag === false) return false;

  // No explicit flag — apply semver heuristics
  const currentMajor = getMajor(currentVersion);
  const latestMajor = getMajor(latestVersion);

  // Major bump is always breaking
  if (latestMajor > currentMajor) {
    return true;
  }

  // Pre-1.0: minor bump is breaking
  if (currentMajor === 0) {
    const currentMinor = getMinor(currentVersion);
    const latestMinor = getMinor(latestVersion);
    if (latestMinor > currentMinor) {
      return true;
    }
  }

  return false;
}

/**
 * Classify a version bump into one of the four categories.
 */
function classify(
  currentVersion: string,
  latestVersion: string,
  breakingFlag?: boolean
): BumpClassification {
  // No update available
  if (Bun.semver.order(latestVersion, currentVersion) <= 0) {
    return "upToDate";
  }

  if (isBreaking(currentVersion, latestVersion, breakingFlag)) {
    return "upgradableBreaking";
  }

  return "upgradableNonBreaking";
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Analyze installed packages against their latest versions and produce
 * a deterministic update plan.
 *
 * This function is **pure** — no side effects, no I/O, no process.env reads.
 * Same inputs always produce the same output.
 *
 * @param installed - Map of package name to currently installed version.
 * @param latest - Map of package name to latest version info (version string + breaking flag).
 * @param migrationDocs - Optional map of package name to migration doc path.
 * @returns A deterministic update plan with per-package actions and summary.
 */
export function analyzeUpdates(
  installed: Map<string, string>,
  latest: Map<string, { version: string; breaking?: boolean }>,
  migrationDocs?: Map<string, string>
): UpdatePlan {
  const packages: PackageUpdateAction[] = [];

  for (const [name, currentVersion] of installed) {
    const latestInfo = latest.get(name);

    // If we have no latest info, treat as up-to-date (we can't determine otherwise)
    const latestVersion = latestInfo?.version ?? currentVersion;
    const breakingFlag = latestInfo?.breaking;

    const classification = classify(
      currentVersion,
      latestVersion,
      breakingFlag
    );
    const breaking = classification === "upgradableBreaking";

    const migrationDoc = migrationDocs?.get(name);

    packages.push({
      name,
      currentVersion,
      latestVersion,
      classification,
      breaking,
      ...(migrationDoc !== undefined ? { migrationDoc } : {}),
    });
  }

  // Sort by name for deterministic output
  packages.sort((a, b) => a.name.localeCompare(b.name));

  // Compute summary counts
  const summary = {
    upToDate: 0,
    upgradableNonBreaking: 0,
    upgradableBreaking: 0,
    blocked: 0,
  };

  for (const pkg of packages) {
    summary[pkg.classification]++;
  }

  return { packages, summary };
}
