/**
 * @outfitter/presets — Scaffold presets and shared dependency versions.
 *
 * The presets package is the single source of truth for:
 * - Scaffold preset files (templates for new projects)
 * - Shared dependency versions (resolved from Bun catalog at publish time)
 *
 * @packageDocumentation
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEPENDENCY_SECTIONS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

export interface ResolvedVersions {
  /** All dependency versions from the presets package (catalog-resolved at publish time). */
  readonly all: Readonly<Record<string, string>>;
}

export interface PresetInfo {
  /** The preset name (directory name). */
  readonly name: string;
  /** Absolute path to the preset directory. */
  readonly path: string;
}

/**
 * Get the absolute path to the presets directory.
 * Works both in the monorepo (source) and when published to npm (dist/).
 */
export function getPresetsDir(): string {
  const thisFile = dirname(fileURLToPath(import.meta.url));
  // In monorepo: src/ → ../ → presets/
  // In published: dist/ → ../ → presets/
  const presetsDir = join(thisFile, "..", "presets");
  if (existsSync(presetsDir)) {
    return presetsDir;
  }
  throw new Error(
    `Presets directory not found at ${presetsDir}. Ensure @outfitter/presets is properly installed.`
  );
}

/**
 * List all available presets.
 */
export function listPresets(): readonly PresetInfo[] {
  const presetsDir = getPresetsDir();
  return readdirSync(presetsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: join(presetsDir, entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Get the absolute path to a specific preset directory.
 * Returns undefined if the preset does not exist.
 */
export function getPresetPath(presetName: string): string | undefined {
  const presetsDir = getPresetsDir();
  const presetDir = resolve(presetsDir, presetName);
  const relativePath = relative(presetsDir, presetDir);
  if (
    relativePath.length === 0 ||
    relativePath.startsWith("..") ||
    isAbsolute(relativePath)
  ) {
    return undefined;
  }

  if (!existsSync(presetDir)) {
    return undefined;
  }

  return statSync(presetDir).isDirectory() ? presetDir : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Read the Bun workspace catalog from the root package.json.
 * Returns an empty record if no catalog exists (e.g., when published to npm).
 */
function loadWorkspaceCatalog(packageDir: string): Record<string, string> {
  // Walk up to find the workspace root with a catalog.
  let dir = packageDir;
  for (let i = 0; i < 10; i++) {
    const rootPkgPath = join(dir, "package.json");
    if (existsSync(rootPkgPath)) {
      try {
        const raw: unknown = JSON.parse(readFileSync(rootPkgPath, "utf-8"));
        if (isRecord(raw) && isRecord(raw["catalog"])) {
          const catalog: Record<string, string> = {};
          for (const [name, version] of Object.entries(raw["catalog"])) {
            if (typeof version === "string") {
              catalog[name] = version;
            }
          }
          return catalog;
        }
      } catch {
        // Continue searching.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}

/**
 * Read resolved dependency versions from the presets package's own package.json.
 *
 * When published to npm, `catalog:` is replaced with concrete semver ranges,
 * so versions are read directly. In the monorepo, `catalog:` references are
 * resolved by reading the workspace root's catalog field.
 *
 * @returns Resolved versions for all declared dependencies.
 *
 * @example
 * ```typescript
 * import { getResolvedVersions } from "@outfitter/presets";
 *
 * const { all } = getResolvedVersions();
 * console.log(all["zod"]); // "^4.3.5"
 * ```
 */
export function getResolvedVersions(): ResolvedVersions {
  const packageDir = join(dirname(fileURLToPath(import.meta.url)), "..");
  const packageJsonPath = join(packageDir, "package.json");
  const raw: unknown = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

  if (!isRecord(raw)) {
    throw new Error("@outfitter/presets package.json must be a JSON object");
  }

  const all: Record<string, string> = {};
  let hasCatalogRefs = false;

  for (const section of DEPENDENCY_SECTIONS) {
    const deps = raw[section];
    if (!isRecord(deps)) continue;
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === "string") {
        if (version === "catalog:") {
          hasCatalogRefs = true;
        } else {
          all[name] = version;
        }
      }
    }
  }

  // In the monorepo, resolve catalog: references from the root catalog.
  if (hasCatalogRefs) {
    const catalog = loadWorkspaceCatalog(packageDir);
    const unresolved: string[] = [];
    for (const section of DEPENDENCY_SECTIONS) {
      const deps = raw[section];
      if (!isRecord(deps)) continue;
      for (const [name, version] of Object.entries(deps)) {
        if (version === "catalog:") {
          if (catalog[name]) {
            all[name] = catalog[name];
          } else {
            unresolved.push(name);
          }
        }
      }
    }
    if (unresolved.length > 0) {
      throw new Error(
        `Unresolvable catalog: references (no catalog entry found): ${unresolved.join(", ")}`
      );
    }
  }

  return { all };
}
