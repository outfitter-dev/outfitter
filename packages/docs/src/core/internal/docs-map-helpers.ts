/**
 * Internal helpers for the docs-map generator.
 *
 * Constants, utility helpers, kind inference, title extraction, and version
 * reading used by the generator, write, and read functions.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isAbsolute, join, relative } from "node:path";

import type { DocKind } from "../docs-map-schema.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DOCS_MAP_FILENAME = "docs-map.json";
export const DOCS_MAP_DIR = ".outfitter";
export const DEFAULT_PACKAGES_DIR = "packages";
export const DEFAULT_OUTPUT_DIR = "docs/packages";
export const DEFAULT_EXCLUDED_FILES: ReadonlySet<string> = new Set([
  "changelog.md",
]);

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------

export function toPosixPath(path: string): string {
  return path.split("\\").join("/");
}

export function isPathInsideWorkspace(
  workspaceRoot: string,
  absolutePath: string
): boolean {
  const rel = relative(workspaceRoot, absolutePath);
  return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
}

function isSamePathOrDescendant(
  parentPath: string,
  candidatePath: string
): boolean {
  const rel = relative(parentPath, candidatePath);
  return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
}

export function pathsOverlap(pathA: string, pathB: string): boolean {
  return (
    isSamePathOrDescendant(pathA, pathB) || isSamePathOrDescendant(pathB, pathA)
  );
}

// ---------------------------------------------------------------------------
// Doc kind inference
// ---------------------------------------------------------------------------

/**
 * Check whether a filename contains a token as a standalone word boundary.
 *
 * @param name - Filename to check (already lowercased)
 * @param token - Token to search for
 * @returns True when the token appears at a word boundary
 */
const hasToken = (name: string, token: string): boolean =>
  new RegExp(`(?:^|[^a-z0-9])${token}(?:[^a-z0-9]|$)`, "u").test(name);

/**
 * Infer the document kind from a file's relative path.
 *
 * @param relativePath - Path relative to the workspace root
 * @param packageName - Owning package directory name, if applicable
 * @returns The inferred {@link DocKind}
 */
export function inferDocKind(
  relativePath: string,
  packageName?: string
): DocKind {
  const lower = relativePath.toLowerCase();
  const filename = lower.split("/").at(-1) ?? "";
  const isPackageDeepDoc = Boolean(packageName && lower.includes("/docs/"));

  if (filename === "readme.md" || filename === "readme.mdx") return "readme";
  if (filename.includes("changelog") || filename.includes("release"))
    return "release";
  if (filename.includes("architecture") || filename.includes("design"))
    return "architecture";
  if (filename.includes("convention") || filename.includes("patterns"))
    return "convention";
  if (lower.startsWith("docs/llms")) return "generated";

  // Default based on common naming
  if (
    filename.includes("guide") ||
    filename.includes("tutorial") ||
    filename.includes("getting-started")
  )
    return "guide";
  if (
    hasToken(filename, "api") ||
    filename.includes("openapi") ||
    filename.includes("reference")
  )
    return "reference";

  // Files in packages/<pkg>/docs/ are "deep" unless a stronger kind matched.
  if (isPackageDeepDoc) return "deep";

  return "reference"; // safe default
}

// ---------------------------------------------------------------------------
// Title extraction
// ---------------------------------------------------------------------------

/**
 * Extract the first markdown heading from file content.
 *
 * @param content - Raw markdown content
 * @returns The heading text, or null if no heading found
 */
export function extractFirstHeading(content: string): string | null {
  for (const line of content.split(/\r?\n/u)) {
    const match = /^\s*#{1,6}\s+(.+)$/u.exec(line);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// Version helper
// ---------------------------------------------------------------------------

export async function readPackageVersion(
  workspaceRoot: string
): Promise<string | null> {
  const candidate = join(workspaceRoot, "packages", "docs", "package.json");
  if (!existsSync(candidate)) return null;

  try {
    const content = await readFile(candidate, "utf8");
    const parsed = JSON.parse(content) as { version?: string };
    return parsed.version ?? null;
  } catch {
    return null;
  }
}
