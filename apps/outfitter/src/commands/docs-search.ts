/**
 * `outfitter docs search` - Full-text search across documentation content.
 *
 * Generates the docs map from the workspace, reads each matching file,
 * and performs case-insensitive substring search to find matching lines.
 *
 * @packageDocumentation
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { output } from "@outfitter/cli";
import { InternalError, Result } from "@outfitter/contracts";
import { generateDocsMap } from "@outfitter/docs";
import { createTheme } from "@outfitter/tui/render";
import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import type { DocsMapEntryShape } from "./docs-types.js";
import { applyJq } from "./jq-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.search action handler. */
export interface DocsSearchInput {
  readonly cwd: string;
  readonly jq?: string | undefined;
  readonly kind?: string | undefined;
  readonly outputMode: CliOutputMode;
  readonly package?: string | undefined;
  readonly query: string;
}

/** A single match found in a documentation file. */
export interface DocsSearchMatch {
  readonly id: string;
  readonly kind: string;
  readonly matchLines: string[];
  readonly outputPath: string;
  readonly package?: string;
  readonly sourcePath: string;
  readonly title: string;
}

/** Output shape for the docs.search action. */
export interface DocsSearchOutput {
  readonly matches: DocsSearchMatch[];
  readonly query: string;
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Search documentation content for a query string.
 *
 * Generates the docs map for the workspace, reads each file's content,
 * and performs case-insensitive substring matching to find relevant lines.
 *
 * @param input - Validated action input
 * @returns Result containing the search matches or an error
 */
export async function runDocsSearch(
  input: DocsSearchInput
): Promise<Result<DocsSearchOutput, InternalError>> {
  try {
    const cwd = resolve(input.cwd);
    const mapResult = await generateDocsMap({ workspaceRoot: cwd });

    if (mapResult.isErr()) {
      return Result.err(
        new InternalError({
          message: mapResult.error.message,
          context: { action: "docs.search" },
        })
      );
    }

    // better-result's Result2 dist alias prevents tsc from narrowing .value;
    // cast through the known DocsMap shape
    const rawMap = mapResult.value as {
      entries: DocsMapEntryShape[];
    };

    let entries = rawMap.entries;

    // Apply kind filter
    if (input.kind) {
      entries = entries.filter((entry) => entry.kind === input.kind);
    }

    // Apply package filter
    if (input.package) {
      entries = entries.filter((entry) => entry.package === input.package);
    }

    const queryLower = input.query.toLowerCase();
    const matches: DocsSearchMatch[] = [];

    for (const entry of entries) {
      const sourcePath = resolve(cwd, entry.sourcePath);
      try {
        const content = await readFile(sourcePath, "utf8");
        const lines = content.split("\n");
        const matchLines: string[] = [];

        for (const line of lines) {
          if (line.toLowerCase().includes(queryLower)) {
            matchLines.push(line);
          }
        }

        if (matchLines.length > 0) {
          matches.push({
            id: entry.id,
            kind: entry.kind,
            title: entry.title,
            sourcePath: entry.sourcePath,
            outputPath: entry.outputPath,
            ...(entry.package !== undefined ? { package: entry.package } : {}),
            matchLines,
          });
        }
      } catch {
        // Skip files that cannot be read (e.g. deleted since map generation)
      }
    }

    return Result.ok({
      matches,
      query: input.query,
      total: matches.length,
    });
  } catch (error) {
    return Result.err(
      new InternalError({
        message:
          error instanceof Error ? error.message : "Failed to search docs",
        context: { action: "docs.search" },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Print docs search results in the appropriate output format.
 *
 * @param result - The docs search output
 * @param options - Output formatting options
 */
export async function printDocsSearchResults(
  result: DocsSearchOutput,
  options?: { mode?: CliOutputMode; jq?: string | undefined }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (structuredMode) {
    if (options?.jq) {
      const filtered = await applyJq(result, options.jq, {
        compact: structuredMode === "jsonl",
      });
      process.stdout.write(filtered);
    } else {
      await output(result, { mode: structuredMode });
    }
    return;
  }

  const theme = createTheme();
  const lines: string[] = [];

  if (result.total === 0) {
    lines.push(
      theme.muted(`No documentation entries matched "${result.query}".`)
    );
    await output(lines, { mode: "human" });
    return;
  }

  lines.push("");
  lines.push(`Search Results for "${result.query}" (${result.total})`);
  lines.push("=".repeat(60));
  lines.push("");

  for (const match of result.matches) {
    const pkg = match.package ? theme.muted(` [${match.package}]`) : "";
    const kind = theme.muted(`(${match.kind})`);
    lines.push(`  ${match.id} ${kind}${pkg}`);
    lines.push(`    ${match.title}`);
    lines.push(
      `    ${theme.muted(`${match.matchLines.length} matching line(s)`)}`
    );
    for (const line of match.matchLines.slice(0, 3)) {
      lines.push(`      ${theme.muted(line.trim())}`);
    }
    if (match.matchLines.length > 3) {
      lines.push(
        `      ${theme.muted(`... and ${match.matchLines.length - 3} more`)}`
      );
    }
    lines.push("");
  }

  await output(lines, { mode: "human" });
}
