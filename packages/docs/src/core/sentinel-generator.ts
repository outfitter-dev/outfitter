/**
 * Sentinel-wrapped section generator for markdown files.
 *
 * Provides utilities to replace content between sentinel comment markers
 * in markdown files, and to generate package list tables from workspace
 * package metadata.
 *
 * Sentinel markers follow the pattern:
 * - `<!-- BEGIN:GENERATED:SECTION_ID -->`
 * - `<!-- END:GENERATED:SECTION_ID -->`
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Sentinel replacement
// ---------------------------------------------------------------------------

/**
 * Escape special regex characters in a string.
 *
 * @param text - The string to escape
 * @returns The escaped string safe for use in a RegExp
 */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Replace content between sentinel markers in a markdown string.
 *
 * Sentinel markers follow the pattern:
 * - `<!-- BEGIN:GENERATED:SECTION_ID -->`
 * - `<!-- END:GENERATED:SECTION_ID -->`
 *
 * Content between the markers is replaced with the provided new content.
 * If the markers are not found, the original content is returned unchanged.
 *
 * @param content - The full markdown content to modify
 * @param sectionId - The sentinel section identifier (e.g. "PACKAGE_LIST")
 * @param newContent - The replacement content (without sentinel markers)
 * @returns The modified markdown content
 *
 * @example
 * ```typescript
 * const updated = replaceSentinelSection(
 *   markdown,
 *   "PACKAGE_LIST",
 *   "| Package | Description |\n|---------|-------------|",
 * );
 * ```
 */
export function replaceSentinelSection(
  content: string,
  sectionId: string,
  newContent: string
): string {
  const beginTag = `<!-- BEGIN:GENERATED:${sectionId} -->`;
  const endTag = `<!-- END:GENERATED:${sectionId} -->`;
  const regex = new RegExp(
    `${escapeRegex(beginTag)}[\\s\\S]*?${escapeRegex(endTag)}`,
    "g"
  );
  return content.replace(regex, `${beginTag}\n${newContent}\n${endTag}`);
}

// ---------------------------------------------------------------------------
// Package discovery
// ---------------------------------------------------------------------------

interface DiscoveredPackageInfo {
  readonly description: string;
  readonly dirName: string;
  readonly name: string;
}

/**
 * Read and parse a package.json file, returning null if it does not exist
 * or is not parseable.
 */
async function readPackageJson(
  packageJsonPath: string
): Promise<{ name?: string; description?: string; private?: boolean } | null> {
  if (!existsSync(packageJsonPath)) {
    return null;
  }

  try {
    const content = await readFile(packageJsonPath, "utf8");
    return JSON.parse(content) as {
      name?: string;
      description?: string;
      private?: boolean;
    };
  } catch {
    return null;
  }
}

/**
 * Discover publishable packages in a workspace's packages directory.
 *
 * Reads each subdirectory's package.json, filters out private packages
 * and directories without a package.json, and returns metadata sorted
 * alphabetically by package name.
 */
async function discoverPublishablePackages(
  packagesRoot: string
): Promise<DiscoveredPackageInfo[]> {
  if (!existsSync(packagesRoot)) {
    return [];
  }

  const entries = await readdir(packagesRoot, { withFileTypes: true });
  const packages: DiscoveredPackageInfo[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packageJsonPath = join(packagesRoot, entry.name, "package.json");
    const parsed = await readPackageJson(packageJsonPath);

    if (!parsed) {
      continue;
    }

    if (parsed.private === true) {
      continue;
    }

    if (!parsed.name) {
      continue;
    }

    packages.push({
      dirName: entry.name,
      name: parsed.name,
      description: parsed.description ?? "",
    });
  }

  return packages.sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Package list generation
// ---------------------------------------------------------------------------

/**
 * Generate a markdown package list table from workspace packages.
 *
 * Reads the packages directory, filters out private packages, and
 * generates a markdown table with package name (linked) and description.
 * Packages are sorted alphabetically by name.
 *
 * The generated content does NOT include sentinel markers -- those belong
 * in the target file. This function returns only the table content.
 *
 * @param workspaceRoot - Absolute path to the workspace root
 * @returns The markdown table content (without sentinel markers)
 *
 * @example
 * ```typescript
 * const table = await generatePackageListSection("/path/to/repo");
 * // Returns:
 * // | Package | Description |
 * // |---------|-------------|
 * // | [`@outfitter/cli`](../packages/cli/) | CLI framework |
 * ```
 */
export async function generatePackageListSection(
  workspaceRoot: string
): Promise<string> {
  const packagesRoot = join(workspaceRoot, "packages");
  const packages = await discoverPublishablePackages(packagesRoot);

  const lines: string[] = [
    "| Package | Description |",
    "|---------|-------------|",
  ];

  for (const pkg of packages) {
    const link = `../packages/${pkg.dirName}/`;
    const descriptionCell = pkg.description ? ` ${pkg.description} ` : " ";
    lines.push(`| [\`${pkg.name}\`](${link}) |${descriptionCell}|`);
  }

  return lines.join("\n");
}
