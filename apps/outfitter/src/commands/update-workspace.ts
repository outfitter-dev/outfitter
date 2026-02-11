/**
 * Workspace-aware scanning for `outfitter update`.
 *
 * Detects monorepo workspace roots, collects all package.json manifests
 * matching workspace patterns, and extracts @outfitter/* dependencies
 * across all workspace members with deduplication and conflict reporting.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result } from "@outfitter/contracts";

// =============================================================================
// Types
// =============================================================================

/** A package dependency found across workspace manifests. */
export interface WorkspacePackageEntry {
  /** Full package name (e.g. "@outfitter/cli") */
  readonly name: string;
  /** Cleaned semver version (without range prefix) */
  readonly version: string;
}

/** Version conflict: same package at different versions in different manifests. */
export interface VersionConflict {
  /** Full package name */
  readonly name: string;
  /** All distinct versions found, with their manifest paths */
  readonly versions: ReadonlyArray<{
    readonly version: string;
    readonly manifests: readonly string[];
  }>;
}

/** Result of scanning a workspace for @outfitter/* packages. */
export interface WorkspaceScanResult {
  /** Deduplicated @outfitter/* packages (uses lowest version for conflicts) */
  readonly packages: readonly WorkspacePackageEntry[];
  /** Version conflicts found across manifests */
  readonly conflicts: readonly VersionConflict[];
  /** Maps package name to the manifest paths that contain it */
  readonly manifestsByPackage: ReadonlyMap<string, readonly string[]>;
  /** All manifest paths scanned */
  readonly manifestPaths: readonly string[];
  /** Workspace root directory (null if not a workspace) */
  readonly workspaceRoot: string | null;
}

// =============================================================================
// Internal Types
// =============================================================================

interface PackageDeps {
  workspaces?: unknown;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  [key: string]: unknown;
}

// =============================================================================
// Workspace Detection
// =============================================================================

/**
 * Walk up from `cwd` looking for a workspace root.
 *
 * Workspace root is identified by:
 * - `package.json` with a `workspaces` field (npm/yarn/bun)
 * - `pnpm-workspace.yaml` file
 *
 * Returns `null` (as Ok) if no workspace root found — this is not an error,
 * it means the project is a standalone package.
 */
export function detectWorkspaceRoot(
  cwd: string
): Result<string | null, OutfitterError> {
  let current = resolve(cwd);
  const root = resolve("/");

  while (true) {
    // Check for pnpm-workspace.yaml
    if (existsSync(join(current, "pnpm-workspace.yaml"))) {
      return Result.ok(current);
    }

    // Check for package.json with workspaces field
    const pkgPath = join(current, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const raw = readFileSync(pkgPath, "utf-8");
        const pkg = JSON.parse(raw) as PackageDeps;

        if (hasWorkspacesField(pkg)) {
          return Result.ok(current);
        }
      } catch {
        // Invalid JSON, skip and keep searching
      }
    }

    // Stop at filesystem root
    if (current === root) {
      break;
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  return Result.ok(null);
}

/**
 * Check if a parsed package.json has a `workspaces` field
 * in either array or object format.
 */
function hasWorkspacesField(pkg: PackageDeps): boolean {
  const workspaces = pkg.workspaces;

  if (Array.isArray(workspaces) && workspaces.length > 0) {
    return true;
  }

  if (
    workspaces &&
    typeof workspaces === "object" &&
    !Array.isArray(workspaces)
  ) {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages) && packages.length > 0) {
      return true;
    }
  }

  return false;
}

// =============================================================================
// Manifest Collection
// =============================================================================

/**
 * Resolve workspace patterns from a root package.json into
 * a list of glob patterns targeting package.json files.
 */
function resolveWorkspacePatterns(pkg: PackageDeps): string[] {
  const workspaces = pkg.workspaces;

  let patterns: unknown[];
  if (Array.isArray(workspaces)) {
    patterns = workspaces;
  } else if (
    workspaces &&
    typeof workspaces === "object" &&
    !Array.isArray(workspaces)
  ) {
    const packages = (workspaces as { packages?: unknown }).packages;
    if (Array.isArray(packages)) {
      patterns = packages;
    } else {
      return [];
    }
  } else {
    return [];
  }

  return patterns
    .filter((p): p is string => typeof p === "string")
    .map(normalizeWorkspacePattern);
}

/**
 * Normalize a workspace pattern to always end with `/package.json`.
 */
function normalizeWorkspacePattern(pattern: string): string {
  let value = pattern.trim().replaceAll("\\", "/");
  if (value.length === 0) return value;
  if (value.endsWith("/")) {
    value = value.slice(0, -1);
  }
  if (value.endsWith("package.json")) {
    return value;
  }
  return `${value}/package.json`;
}

/**
 * Collect all package.json files from a workspace root directory.
 *
 * Reads workspace patterns from the root package.json, resolves globs,
 * and returns sorted absolute paths to all matching package.json files.
 * Always includes the root package.json itself.
 */
export function collectWorkspaceManifests(
  rootDir: string
): Result<string[], OutfitterError> {
  const resolvedRoot = resolve(rootDir);
  const rootPackageJson = join(resolvedRoot, "package.json");

  if (!existsSync(rootPackageJson)) {
    return Result.err(
      InternalError.create("No package.json found at workspace root", {
        rootDir: resolvedRoot,
      })
    );
  }

  let pkg: PackageDeps;
  try {
    const raw = readFileSync(rootPackageJson, "utf-8");
    pkg = JSON.parse(raw);
  } catch {
    return Result.err(
      InternalError.create("Invalid JSON in root package.json", {
        rootDir: resolvedRoot,
      })
    );
  }

  const workspacePatterns = resolveWorkspacePatterns(pkg);
  const files = new Set<string>([rootPackageJson]);

  for (const pattern of workspacePatterns) {
    if (pattern.length === 0) continue;

    const glob = new Bun.Glob(pattern);
    for (const entry of glob.scanSync({ cwd: resolvedRoot })) {
      const absolute = resolve(resolvedRoot, entry);
      if (existsSync(absolute) && basename(absolute) === "package.json") {
        files.add(absolute);
      }
    }
  }

  return Result.ok(Array.from(files).sort((a, b) => a.localeCompare(b)));
}

// =============================================================================
// Dependency Extraction
// =============================================================================

/**
 * Extract @outfitter/* packages from a single manifest file.
 * Returns entries with cleaned semver versions (range prefixes stripped).
 */
function extractOutfitterDeps(
  manifestPath: string
): Result<{ name: string; version: string }[], OutfitterError> {
  let pkg: PackageDeps;
  try {
    const raw = readFileSync(manifestPath, "utf-8");
    pkg = JSON.parse(raw);
  } catch {
    return Result.err(
      InternalError.create("Failed to parse package.json", {
        path: manifestPath,
      })
    );
  }

  const deps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  const packages: { name: string; version: string }[] = [];

  for (const [name, version] of Object.entries(deps)) {
    if (!name.startsWith("@outfitter/")) continue;

    // Handle workspace protocol
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
 * Scan all workspace manifests, collect @outfitter/* deps,
 * deduplicate, and detect version conflicts.
 *
 * For deduplication: when the same package appears at the same version
 * in multiple manifests, it appears once in the result.
 * When versions differ, the lowest version is used and a conflict is reported.
 */
export function getInstalledPackagesFromWorkspace(
  rootDir: string
): Result<WorkspaceScanResult, OutfitterError> {
  const resolvedRoot = resolve(rootDir);

  const wsRootResult = detectWorkspaceRoot(resolvedRoot);
  if (wsRootResult.isErr()) return wsRootResult;

  const effectiveRoot = wsRootResult.value ?? resolvedRoot;

  let manifestPaths: string[];
  if (wsRootResult.value !== null) {
    const manifestsResult = collectWorkspaceManifests(effectiveRoot);
    if (manifestsResult.isErr()) return manifestsResult;
    manifestPaths = manifestsResult.value;
  } else {
    // Standalone: only the root package.json
    const rootPkg = join(resolvedRoot, "package.json");
    if (!existsSync(rootPkg)) {
      return Result.err(
        InternalError.create("No package.json found", { cwd: resolvedRoot })
      );
    }
    manifestPaths = [rootPkg];
  }

  // Collect all @outfitter/* deps across all manifests
  // Track: package name -> version -> list of manifest paths
  const packageVersionMap = new Map<string, Map<string, string[]>>();
  const manifestsByPackage = new Map<string, string[]>();

  for (const manifestPath of manifestPaths) {
    const depsResult = extractOutfitterDeps(manifestPath);
    if (depsResult.isErr()) return depsResult;
    const deps = depsResult.value;

    for (const dep of deps) {
      // Track version -> manifests
      let versionMap = packageVersionMap.get(dep.name);
      if (!versionMap) {
        versionMap = new Map();
        packageVersionMap.set(dep.name, versionMap);
      }

      let manifests = versionMap.get(dep.version);
      if (!manifests) {
        manifests = [];
        versionMap.set(dep.version, manifests);
      }
      manifests.push(manifestPath);

      // Track package -> all manifests
      let pkgManifests = manifestsByPackage.get(dep.name);
      if (!pkgManifests) {
        pkgManifests = [];
        manifestsByPackage.set(dep.name, pkgManifests);
      }
      pkgManifests.push(manifestPath);
    }
  }

  // Deduplicate and detect conflicts
  const packages: WorkspacePackageEntry[] = [];
  const conflicts: VersionConflict[] = [];

  for (const [name, versionMap] of packageVersionMap) {
    const versions = Array.from(versionMap.entries())
      .map(([version, manifests]) => ({ version, manifests }))
      .sort((a, b) => {
        try {
          return Bun.semver.order(a.version, b.version);
        } catch {
          return a.version.localeCompare(b.version);
        }
      });

    if (versions.length > 1) {
      conflicts.push({ name, versions });
    }

    // Use the lowest version for the deduplicated entry
    const lowest = versions[0];
    if (lowest) {
      packages.push({ name, version: lowest.version });
    }
  }

  // Sort packages by name for deterministic output
  packages.sort((a, b) => a.name.localeCompare(b.name));

  return Result.ok({
    packages,
    conflicts,
    manifestsByPackage,
    manifestPaths,
    workspaceRoot: wsRootResult.value,
  });
}

// =============================================================================
// Apply Updates to All Manifests
// =============================================================================

/**
 * Apply version updates to all manifests in a workspace that contain
 * the specified @outfitter/* packages.
 *
 * Preserves the existing version range prefix (^, ~, >=, etc.) in each manifest.
 * Does NOT run `bun install` — the caller is responsible for that.
 */
export async function applyUpdatesToWorkspace(
  manifestPaths: readonly string[],
  manifestsByPackage: ReadonlyMap<string, readonly string[]>,
  updates: readonly { name: string; latestVersion: string }[]
): Promise<Result<void, OutfitterError>> {
  // Build lookup: package name -> new version
  const updateMap = new Map<string, string>();
  for (const u of updates) {
    updateMap.set(u.name, u.latestVersion);
  }

  // Collect all manifests that need updating
  const manifestsToUpdate = new Set<string>();
  for (const u of updates) {
    const manifests = manifestsByPackage.get(u.name);
    if (manifests) {
      for (const m of manifests) {
        manifestsToUpdate.add(m);
      }
    }
  }

  // Update each manifest
  for (const manifestPath of manifestPaths) {
    if (!manifestsToUpdate.has(manifestPath)) continue;

    let raw: string;
    try {
      raw = readFileSync(manifestPath, "utf-8");
    } catch {
      return Result.err(
        InternalError.create("Failed to read package.json for apply", {
          path: manifestPath,
        })
      );
    }

    let pkg: PackageDeps;
    try {
      pkg = JSON.parse(raw);
    } catch {
      return Result.err(
        InternalError.create("Invalid JSON in package.json", {
          path: manifestPath,
        })
      );
    }

    let changed = false;

    for (const section of ["dependencies", "devDependencies"] as const) {
      const deps = pkg[section];
      if (!deps) continue;

      for (const name of Object.keys(deps)) {
        const newVersion = updateMap.get(name);
        if (newVersion === undefined) continue;

        const currentSpecifier = deps[name];
        if (currentSpecifier === undefined) continue;

        // Skip workspace:* protocol
        if (
          currentSpecifier.startsWith("workspace:") &&
          ["*", "~", "^"].includes(currentSpecifier.slice("workspace:".length))
        ) {
          continue;
        }

        const prefix = getVersionPrefix(currentSpecifier);
        deps[name] = `${prefix}${newVersion}`;
        changed = true;
      }
    }

    if (changed) {
      try {
        const updated = `${JSON.stringify(pkg, null, 2)}\n`;
        await Bun.write(manifestPath, updated);
      } catch {
        return Result.err(
          InternalError.create("Failed to write updated package.json", {
            path: manifestPath,
          })
        );
      }
    }
  }

  return Result.ok(undefined);
}

/**
 * Determine the version range prefix used for a dependency specifier.
 */
function getVersionPrefix(specifier: string): string {
  if (specifier.startsWith("workspace:")) {
    const inner = specifier.slice("workspace:".length);
    return `workspace:${getVersionPrefix(inner)}`;
  }
  const match = specifier.match(/^([\^~>=<]+)/);
  return match?.[1] ?? "";
}

/**
 * Run `bun install` at the given directory.
 */
export async function runInstall(
  cwd: string
): Promise<Result<void, OutfitterError>> {
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
