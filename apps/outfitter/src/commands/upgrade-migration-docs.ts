/**
 * Migration doc discovery and reading for `outfitter upgrade`.
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  parseMigrationFrontmatter,
  stripMigrationFrontmatter,
  type MigrationFrontmatter,
} from "./upgrade-migration-frontmatter.js";

/** A migration doc with parsed frontmatter and body content. */
export interface MigrationDocWithMetadata {
  readonly body: string;
  readonly frontmatter: MigrationFrontmatter;
  readonly version: string;
}

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

    const body = stripMigrationFrontmatter(content);
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

    const body = stripMigrationFrontmatter(content);
    docs.push({ frontmatter, body, version: docVersion });
  }

  docs.sort((a, b) => Bun.semver.order(a.version, b.version));

  return docs;
}
