/**
 * Codemod discovery and execution for `outfitter update`.
 *
 * Codemods are TypeScript scripts that export a `transform` function.
 * They are referenced from migration doc frontmatter via the `codemod` field
 * and discovered by scanning migration docs for the relevant version range.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import type { OutfitterError } from "@outfitter/contracts";
import { InternalError, Result } from "@outfitter/contracts";
import { readMigrationDocsWithMetadata } from "./update.js";

// =============================================================================
// Types
// =============================================================================

/** Options passed to a codemod's transform function. */
export interface CodemodOptions {
  readonly targetDir: string;
  readonly dryRun: boolean;
}

/** Result returned by a codemod's transform function. */
export interface CodemodResult {
  readonly changedFiles: readonly string[];
  readonly skippedFiles: readonly string[];
  readonly errors: readonly string[];
}

/** A discovered codemod with resolved paths. */
export interface DiscoveredCodemod {
  /** Path relative to the codemods directory. */
  readonly relativePath: string;
  /** Absolute path to the codemod file. */
  readonly absolutePath: string;
}

// =============================================================================
// Codemod Directory Discovery
// =============================================================================

/** Known relative locations for codemod scripts. */
const CODEMOD_PATHS = [
  "plugins/outfitter/shared/codemods",
  "node_modules/@outfitter/kit/shared/codemods",
];

/**
 * Find the codemods directory, checking known locations.
 *
 * Searches:
 * 1. Relative to the target cwd
 * 2. Walking up parent directories from cwd (monorepo root detection)
 * 3. Relative to the outfitter binary itself (development mode)
 */
export function findCodemodsDir(
  cwd: string,
  binaryDir?: string
): string | null {
  for (const relative of CODEMOD_PATHS) {
    const dir = join(cwd, relative);
    if (existsSync(dir)) return dir;
  }

  let current = resolve(cwd);
  const root = resolve("/");
  while (current !== root) {
    const parent = resolve(current, "..");
    if (parent === current) break;
    current = parent;

    for (const relative of CODEMOD_PATHS) {
      const dir = join(current, relative);
      if (existsSync(dir)) return dir;
    }
  }

  const resolvedBinaryDir =
    binaryDir ?? resolve(import.meta.dir, "../../../..");
  for (const relative of CODEMOD_PATHS) {
    const dir = join(resolvedBinaryDir, relative);
    if (existsSync(dir)) return dir;
  }

  return null;
}

// =============================================================================
// Codemod Discovery
// =============================================================================

/**
 * Discover codemods referenced in migration docs for a package version range.
 *
 * Scans migration doc frontmatter for `codemod` references in the `changes`
 * array, resolves them to absolute paths in the codemods directory, and
 * deduplicates.
 */
export function discoverCodemods(
  migrationsDir: string,
  codemodsDir: string,
  shortName: string,
  fromVersion: string,
  toVersion: string
): DiscoveredCodemod[] {
  const resolvedCodemodsDir = resolve(codemodsDir);
  const docs = readMigrationDocsWithMetadata(
    migrationsDir,
    shortName,
    fromVersion,
    toVersion
  );

  const seen = new Set<string>();
  const codemods: DiscoveredCodemod[] = [];

  for (const doc of docs) {
    if (!doc.frontmatter.changes) continue;

    for (const change of doc.frontmatter.changes) {
      if (!change.codemod) continue;
      if (seen.has(change.codemod)) continue;
      seen.add(change.codemod);

      const absolutePath = resolveCodemodPath(
        resolvedCodemodsDir,
        change.codemod
      );
      if (absolutePath === null) continue;
      if (!existsSync(absolutePath)) continue;

      codemods.push({
        relativePath: change.codemod,
        absolutePath,
      });
    }
  }

  return codemods;
}

function resolveCodemodPath(
  codemodsDir: string,
  relativePath: string
): string | null {
  if (relativePath.trim().length === 0) {
    return null;
  }

  // Codemod references in migration docs must be project-relative, never absolute.
  if (isAbsolute(relativePath)) {
    return null;
  }

  const resolvedPath = resolve(codemodsDir, relativePath);
  const relPath = relative(codemodsDir, resolvedPath);
  if (relPath === "" || relPath.startsWith("..") || isAbsolute(relPath)) {
    return null;
  }

  return resolvedPath;
}

// =============================================================================
// Codemod Execution
// =============================================================================

/**
 * Run a single codemod by importing and executing its `transform` function.
 */
export async function runCodemod(
  codemodPath: string,
  targetDir: string,
  dryRun: boolean
): Promise<Result<CodemodResult, OutfitterError>> {
  let mod: Record<string, unknown>;
  try {
    mod = (await import(codemodPath)) as Record<string, unknown>;
  } catch (error) {
    return Result.err(
      InternalError.create("Failed to load codemod", {
        codemodPath,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }

  if (typeof mod["transform"] !== "function") {
    return Result.err(
      InternalError.create(`Codemod has no transform export: ${codemodPath}`, {
        codemodPath,
      })
    );
  }

  const transform = mod["transform"] as (
    options: CodemodOptions
  ) => Promise<CodemodResult>;

  try {
    const result = await transform({ targetDir, dryRun });
    return Result.ok(result);
  } catch (error) {
    return Result.err(
      InternalError.create("Codemod execution failed", {
        codemodPath,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}
