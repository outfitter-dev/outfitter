/**
 * Render llms.txt and llms-full.txt from a DocsMap.
 *
 * These functions are additive alternatives to the internal
 * `renderLlmsIndex` / `renderLlmsFull` in `./index.ts`. They accept
 * the public DocsMap schema rather than the internal ExpectedOutput type,
 * enabling future CLI commands that operate on the docs map directly.
 *
 * @packageDocumentation
 */

import { readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

import type { DocsMap, DocsMapEntry } from "./docs-map-schema.js";

function isPathInsideWorkspace(
  workspaceRoot: string,
  absolutePath: string
): boolean {
  const rel = relative(workspaceRoot, absolutePath);
  return rel === "" || !(rel.startsWith("..") || isAbsolute(rel));
}

/**
 * Render an llms.txt index from a docs map.
 *
 * Groups entries by package, sorts packages alphabetically, and lists
 * each entry with its output path and optional title. Entries without
 * a `package` field are skipped.
 *
 * @param docsMap - The docs map manifest to render
 * @returns The llms.txt content as a string
 *
 * @example
 * ```typescript
 * const content = renderLlmsIndexFromMap(docsMap);
 * await writeFile("docs/llms.txt", content);
 * ```
 */
export function renderLlmsIndexFromMap(docsMap: DocsMap): string {
  const lines: string[] = [
    "# llms.txt",
    "",
    "Outfitter package docs index for LLM retrieval.",
    "",
  ];

  // Group entries by package, skipping those without one
  const byPackage = new Map<string, DocsMapEntry[]>();
  for (const entry of docsMap.entries) {
    if (!entry.package) continue;
    const pkg = entry.package;
    const existing = byPackage.get(pkg);
    if (existing) {
      existing.push(entry);
    } else {
      byPackage.set(pkg, [entry]);
    }
  }

  // Sort packages alphabetically
  const sortedPackages = [...byPackage.keys()].sort();

  for (const pkg of sortedPackages) {
    lines.push(`## ${pkg}`);
    const entries = byPackage.get(pkg);
    if (!entries) continue;

    const sortedEntries = [...entries].sort((a, b) =>
      a.outputPath.localeCompare(b.outputPath)
    );
    for (const entry of sortedEntries) {
      const titleSuffix = entry.title ? ` \u2014 ${entry.title}` : "";
      lines.push(`- ${entry.outputPath}${titleSuffix}`);
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

/**
 * Render an llms-full.txt corpus from a docs map.
 *
 * Reads actual file content from disk at each entry's `outputPath`
 * (resolved relative to the workspace root) to build the full corpus.
 * Entries without a `package` field are skipped. Files that do not
 * exist on disk are silently skipped.
 *
 * @param docsMap - The docs map manifest to render
 * @param workspaceRoot - Absolute path to the workspace root for resolving output paths
 * @returns The llms-full.txt content as a string
 *
 * @example
 * ```typescript
 * const content = await renderLlmsFullFromMap(docsMap, "/path/to/workspace");
 * await writeFile("docs/llms-full.txt", content);
 * ```
 */
export async function renderLlmsFullFromMap(
  docsMap: DocsMap,
  workspaceRoot: string
): Promise<string> {
  const resolvedWorkspaceRoot = resolve(workspaceRoot);
  const lines: string[] = [
    "# llms-full.txt",
    "",
    "Outfitter package docs corpus for LLM retrieval.",
    "",
  ];

  // Sort entries by output path, skipping those without a package
  const sortedEntries = [...docsMap.entries]
    .filter((e) => e.package)
    .sort((a, b) => a.outputPath.localeCompare(b.outputPath));

  for (const entry of sortedEntries) {
    const absolutePath = resolve(resolvedWorkspaceRoot, entry.outputPath);
    if (!isPathInsideWorkspace(resolvedWorkspaceRoot, absolutePath)) {
      throw new Error(
        `docs-map entry outputPath resolves outside workspace root: ${entry.outputPath}`
      );
    }

    let content: string;
    try {
      content = await readFile(absolutePath, "utf8");
    } catch (error) {
      const code =
        error && typeof error === "object" && "code" in error
          ? (error as { code?: string }).code
          : undefined;
      if (code === "ENOENT") {
        continue; // Skip if file doesn't exist yet
      }

      throw error;
    }

    lines.push("---");
    lines.push(`path: ${entry.outputPath}`);
    lines.push(`package: ${entry.package}`);
    if (entry.title) {
      lines.push(`title: ${entry.title}`);
    }
    lines.push("---");
    lines.push("");
    lines.push(content.replace(/[ \t]+$/gm, "").trimEnd());
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}
