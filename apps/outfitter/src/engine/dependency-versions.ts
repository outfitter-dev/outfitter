import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { InternalError, Result } from "@outfitter/contracts";
import { getResolvedVersions } from "@outfitter/presets";
import { isPlainObject } from "@outfitter/types";

export const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export interface ResolvedPresetDependencyVersions {
  readonly external: Record<string, string>;
  readonly internal: Record<string, string>;
}

let cachedResolvedVersions: ResolvedPresetDependencyVersions | undefined;

export function clearResolvedVersionsCache(): void {
  cachedResolvedVersions = undefined;
}

function readJsonFile(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf-8"));
}

/** Extract bare semver from a range string for comparison (e.g., `^1.2.3` -> `1.2.3`). */
export function normalizeVersionRange(version: string): string {
  const trimmed = version.trim();
  const semverMatch = trimmed.match(/\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?/);
  if (semverMatch) {
    return semverMatch[0];
  }
  return trimmed.replace(/^[\^~>=<]+/, "");
}

/** Normalize a dependency range for resolution (e.g., bare `1.2.3` -> `^1.2.3`). Returns undefined for empty/workspace values. */
function normalizeRange(value: string): string | undefined {
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === "workspace:*") {
    return undefined;
  }
  if (/^\d+\.\d+\.\d+(?:[-+].+)?$/.test(trimmed)) {
    return `^${trimmed}`;
  }
  return trimmed;
}

function findOutfitterPackageRoot(): Result<string, InternalError> {
  let currentDir = dirname(fileURLToPath(import.meta.url));

  for (let i = 0; i < 10; i += 1) {
    const packageJsonPath = join(currentDir, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const parsed = readJsonFile(packageJsonPath);
        if (
          isPlainObject(parsed) &&
          typeof parsed["name"] === "string" &&
          parsed["name"] === "outfitter"
        ) {
          return Result.ok(currentDir);
        }
      } catch {
        // Continue walking up.
      }
    }
    currentDir = dirname(currentDir);
  }

  return Result.err(
    InternalError.create(
      `Unable to find outfitter package root (walked 10 levels up from ${dirname(fileURLToPath(import.meta.url))}). ` +
        "Ensure this module is running from within the outfitter package tree."
    )
  );
}

function collectOutfitterDepsFromPackageJson(
  packageJson: Record<string, unknown>
): Record<string, string> {
  const collected: Record<string, string> = {};

  for (const section of DEPENDENCY_SECTIONS) {
    const sectionValue = packageJson[section];
    if (!isPlainObject(sectionValue)) {
      continue;
    }

    for (const [name, value] of Object.entries(sectionValue)) {
      if (typeof value !== "string" || !name.startsWith("@outfitter/")) {
        continue;
      }
      const normalized = normalizeRange(value);
      if (normalized) {
        collected[name] = normalized;
      }
    }
  }

  return collected;
}

function collectWorkspacePackageRanges(
  packageRoot: string
): Record<string, string> {
  const repoRoot = resolve(packageRoot, "..", "..");
  const expectedPackageRoot = join(repoRoot, "apps", "outfitter");
  if (resolve(expectedPackageRoot) !== resolve(packageRoot)) {
    return {};
  }

  const packagesDir = join(repoRoot, "packages");
  if (!existsSync(packagesDir)) {
    return {};
  }

  const collected: Record<string, string> = {};
  for (const entry of readdirSync(packagesDir)) {
    const packageJsonPath = join(packagesDir, entry, "package.json");
    if (!existsSync(packageJsonPath)) {
      continue;
    }

    try {
      const parsed = readJsonFile(packageJsonPath);
      if (!isPlainObject(parsed)) {
        continue;
      }

      const name = parsed["name"];
      const version = parsed["version"];
      if (
        typeof name === "string" &&
        typeof version === "string" &&
        name.startsWith("@outfitter/")
      ) {
        const normalized = normalizeRange(version);
        if (normalized) {
          collected[name] = normalized;
        }
      }
    } catch {
      // Ignore malformed workspace package.json entries.
    }
  }

  return collected;
}

/**
 * Resolve dependency versions for scaffold presets.
 *
 * External deps (zod, commander, etc.) come from `@outfitter/presets` which
 * has concrete versions (catalog: resolved at publish time).
 *
 * Internal deps (`@outfitter/*`) come from workspace package scanning (monorepo)
 * or from the outfitter CLI's own package.json deps (when published).
 *
 * Returns `Result<ResolvedPresetDependencyVersions, InternalError>` — never throws.
 * Successful results are cached; failures are not cached (allowing retry).
 */
export function resolvePresetDependencyVersions(): Result<
  ResolvedPresetDependencyVersions,
  InternalError
> {
  if (cachedResolvedVersions) {
    return Result.ok(cachedResolvedVersions);
  }

  try {
    // External deps from @outfitter/presets (catalog-resolved at publish time).
    const { all: presetsVersions } = getResolvedVersions();

    // Internal deps: workspace packages (monorepo) take precedence over
    // outfitter's own package.json deps (published, frozen at release time).
    const packageRootResult = findOutfitterPackageRoot();
    if (packageRootResult.isErr()) {
      return packageRootResult;
    }
    const packageRoot = packageRootResult.value;

    const packageJsonPath = join(packageRoot, "package.json");
    const raw = existsSync(packageJsonPath)
      ? readJsonFile(packageJsonPath)
      : undefined;
    const fromOutfitterPackage =
      raw !== undefined && isPlainObject(raw)
        ? collectOutfitterDepsFromPackageJson(raw)
        : {};
    const fromWorkspacePackages = collectWorkspacePackageRanges(packageRoot);

    // Workspace overrides outfitter's own deps (live vs frozen).
    const internal: Record<string, string> = {
      ...fromOutfitterPackage,
      ...fromWorkspacePackages,
    };

    cachedResolvedVersions = {
      internal,
      external: { ...presetsVersions },
    };
    return Result.ok(cachedResolvedVersions);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Result.err(
      InternalError.create(
        `Failed to resolve preset dependency versions: ${message}`
      )
    );
  }
}

export function applyResolvedDependencyVersions(
  parsedPackageJson: Record<string, unknown>,
  versions: ResolvedPresetDependencyVersions
): string[] {
  const unresolved = new Set<string>();

  for (const section of DEPENDENCY_SECTIONS) {
    const sectionValue = parsedPackageJson[section];
    if (!isPlainObject(sectionValue)) {
      continue;
    }

    for (const [name, value] of Object.entries(sectionValue)) {
      if (typeof value !== "string") {
        continue;
      }

      if (name.startsWith("@outfitter/")) {
        const resolvedInternal = versions.internal[name];
        if (resolvedInternal) {
          sectionValue[name] = resolvedInternal;
        }
        continue;
      }

      const resolvedExternal = versions.external[name];
      if (resolvedExternal) {
        sectionValue[name] = resolvedExternal;
        continue;
      }

      if (value === "catalog:") {
        unresolved.add(name);
      }
    }
  }

  return [...unresolved].toSorted();
}
