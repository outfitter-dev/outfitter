/**
 * `outfitter docs search` - FTS5 BM25-ranked search across documentation.
 *
 * Refreshes the FTS5 index built by `outfitter docs index` before querying
 * so search results stay in sync with the current workspace docs.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, Result } from "@outfitter/contracts";
import { createIndex } from "@outfitter/index";

/**
 * FTS5 table name used by `@outfitter/index` by default.
 * See `packages/index/src/internal/fts5-helpers.ts` for the canonical definition.
 */
const DEFAULT_TABLE_NAME = "documents";
import type { Index, SearchResult } from "@outfitter/index";
import { createTheme } from "@outfitter/tui/render";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import { VERSION } from "../version.js";
import {
  type DocIndexMetadata,
  resolveIndexPath,
  runDocsIndex,
} from "./docs-index.js";
import { applyJq } from "./jq-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.search action handler. */
export interface DocsSearchInput {
  readonly cwd: string;
  readonly indexPath?: string | undefined;
  readonly jq?: string | undefined;
  readonly limit?: number | undefined;
  readonly outputMode?: CliOutputMode;
  readonly query: string;
}

/** A single match found via FTS5 search. */
export interface DocsSearchMatch {
  readonly id: string;
  readonly kind?: string;
  readonly package?: string;
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
// Runner
// ---------------------------------------------------------------------------

/**
 * Search documentation content using FTS5 BM25 ranking.
 *
 * Refreshes the FTS5 index at the given (or default) path before searching,
 * then returns BM25-ranked matches. Plain-text queries that would otherwise
 * trip FTS5 parser errors are retried with quoted terms.
 *
 * @param input - Validated action input
 * @returns Result containing BM25-ranked search matches or an error
 */
export async function runDocsSearch(
  input: DocsSearchInput
): Promise<Result<DocsSearchOutput, InternalError>> {
  const cwd = resolve(input.cwd);
  const indexPath = input.indexPath ?? resolveIndexPath(cwd);

  let index: Index<DocIndexMetadata> | undefined;

  try {
    const shouldRefreshIndex =
      input.indexPath === undefined || !existsSync(indexPath);

    if (shouldRefreshIndex) {
      const indexResult = await runDocsIndex({
        cwd,
        indexPath,
      });

      if (indexResult.isErr()) {
        return Result.err(
          new InternalError({
            message: indexResult.error.message,
            context: { action: "docs.search" },
          })
        );
      }
    }

    // Open the FTS5 index
    index = createIndex<DocIndexMetadata>({
      path: indexPath,
      tokenizer: "porter",
      tool: "outfitter",
      toolVersion: VERSION,
    });

    const limit = input.limit ?? 10;
    const searchResult = await searchIndex(index, input.query, limit);

    if (searchResult.isErr()) {
      index.close();
      index = undefined;

    const totalResult = countMatches(
      indexPath,
      searchResult.value.effectiveQuery
    );

    if (totalResult.isErr()) {
      index.close();
      index = undefined;
      return totalResult;
    }

    const matches: DocsSearchMatch[] = searchResult.value.matches.map(
      (hit) => ({
        id: hit.id,
        title: hit.metadata?.title ?? hit.id,
        score: hit.score,
        snippet: hit.highlights?.[0] ?? "",
        ...(hit.metadata?.package !== undefined
          ? { package: hit.metadata.package }
          : {}),
        ...(hit.metadata?.kind !== undefined
          ? { kind: hit.metadata.kind }
          : {}),
      })
    );

    index.close();
    index = undefined;

    return Result.ok({
      matches,
      query: input.query,
      total: totalResult.value,
    });
  } catch (error) {
    if (index) {
      index.close();
    }

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
 * For human-readable output, shows score, title, snippet, and metadata.
 * For JSON/JSONL mode, outputs the structured data directly.
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
    const scoreLabel = formatScore(match.score);
    const pkg = match.package ? theme.muted(` [${match.package}]`) : "";
    const kind = match.kind ? theme.muted(` (${match.kind})`) : "";

    lines.push(`  ${scoreLabel} ${match.title}${kind}${pkg}`);
    lines.push(`    ${theme.muted(match.id)}`);
    if (match.snippet) {
      lines.push(`    ${theme.muted(match.snippet)}`);
    }
    lines.push("");
  }

  await output(lines, "human");
}

/**
 * Format a BM25 score as a compact relevance label.
 *
 * BM25 scores from FTS5 are negative — more negative (farther from 0)
 * indicates a stronger match. This converts them to a short visual indicator.
 */
function formatScore(score: number): string {
  const abs = Math.abs(score);
  if (abs > 5) return "[***]";
  if (abs > 2) return "[ **]";
  if (abs > 0.5) return "[  *]";
  return "[   ]";
}
