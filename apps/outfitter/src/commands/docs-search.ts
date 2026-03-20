/**
 * `outfitter docs search` - Hybrid search across documentation via qmd.
 *
 * Uses the qmd-backed search index for BM25 keyword + vector similarity
 * search. Falls back to lazy-indexing if no index exists yet.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, Result } from "@outfitter/contracts";
import { createTheme } from "@outfitter/tui/render";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import { applyJq } from "./jq-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.search action handler. */
export interface DocsSearchInput {
  readonly cwd: string;
  readonly jq?: string | undefined;
  readonly limit?: number | undefined;
  readonly outputMode: CliOutputMode;
  readonly query: string;
}

/** A single search hit from the qmd index. */
export interface DocsSearchMatch {
  readonly path: string;
  readonly score: number;
  readonly snippet: string;
  readonly title: string;
}

/** Output shape for the docs.search action. */
export interface DocsSearchOutput {
  readonly matches: DocsSearchMatch[];
  readonly query: string;
  readonly total: number;
}

// ---------------------------------------------------------------------------
// Lazy index path
// ---------------------------------------------------------------------------

/** Default index database path under `~/.outfitter/docs/`. */
const DEFAULT_INDEX_PATH = join(
  homedir(),
  ".outfitter",
  "docs",
  "index.sqlite"
);

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Search documentation using the qmd hybrid search index.
 *
 * If the index does not exist yet, runs `docs.index` first (lazy indexing)
 * to build the index before searching.
 *
 * @param input - Validated action input
 * @returns Result containing search results or an error
 */
export async function runDocsSearch(
  input: DocsSearchInput
): Promise<Result<DocsSearchOutput, InternalError>> {
  try {
    const cwd = resolve(input.cwd);

    // Lazy-index: build the index if it doesn't exist yet
    if (!existsSync(DEFAULT_INDEX_PATH)) {
      const { runDocsIndex } = (await import("./docs-index.js")) as {
        runDocsIndex: typeof import("./docs-index.js").runDocsIndex;
      };

      const indexResult = await runDocsIndex({ cwd, outputMode: "human" });

      if (indexResult.isErr()) {
        return Result.err(
          new InternalError({
            message: `Failed to build search index: ${indexResult.error.message}`,
            context: { action: "docs.search" },
          })
        );
      }
    }

    // Dynamically import to avoid hard dep at module level
    const { createDocsSearch } = (await import("@outfitter/docs/search")) as {
      createDocsSearch: typeof import("@outfitter/docs/search").createDocsSearch;
    };

    const assemblyPath = join(homedir(), ".outfitter", "docs", "assembled");

    const docs = await createDocsSearch({
      name: "outfitter",
      paths: [assemblyPath],
      assemblyPath,
    });

    try {
      const limit = input.limit ?? 10;
      const searchResult = await docs.search(input.query, { limit });

      if (searchResult.isErr()) {
        return Result.err(
          new InternalError({
            message: searchResult.error.message,
            context: { action: "docs.search" },
          })
        );
      }

      const matches: DocsSearchMatch[] = searchResult.value.map((hit) => ({
        path: hit.path,
        score: hit.score,
        snippet: hit.snippet,
        title: hit.title,
      }));

      return Result.ok({
        matches,
        query: input.query,
        total: matches.length,
      });
    } finally {
      await docs.close();
    }
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
      await output(result, structuredMode);
    }
    return;
  }

  const theme = createTheme();
  const lines: string[] = [];

  if (result.total === 0) {
    lines.push(
      theme.muted(`No documentation entries matched "${result.query}".`)
    );
    await output(lines, "human");
    return;
  }

  lines.push("");
  lines.push(`Search Results for "${result.query}" (${result.total})`);
  lines.push("=".repeat(60));
  lines.push("");

  for (const match of result.matches) {
    const scoreLabel = theme.muted(`(score: ${match.score.toFixed(2)})`);
    lines.push(`  ${match.title} ${scoreLabel}`);
    lines.push(`    ${theme.muted(match.path)}`);
    if (match.snippet) {
      // Show first 3 lines of snippet
      const snippetLines = match.snippet.split("\n").slice(0, 3);
      for (const line of snippetLines) {
        lines.push(`      ${theme.muted(line.trim())}`);
      }
    }
    lines.push("");
  }

  await output(lines, "human");
}
