/**
 * `outfitter docs search` - FTS5 BM25-ranked search across documentation.
 *
 * Refreshes the FTS5 index built by `outfitter docs index` before querying
 * so search results stay in sync with the current workspace docs.
 *
 * @packageDocumentation
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, Result } from "@outfitter/contracts";
import { quoteFtsTerms, shouldRetryAsQuoted } from "@outfitter/docs/search";
import { createIndex } from "@outfitter/index";
import type { Index, SearchResult } from "@outfitter/index";
import { createTheme } from "@outfitter/tui/render";

/**
 * FTS5 table name used by `@outfitter/index` by default.
 * See `packages/index/src/internal/fts5-helpers.ts` for the canonical definition.
 */
const DEFAULT_TABLE_NAME = "documents";

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

async function searchIndex(
  index: Index<DocIndexMetadata>,
  query: string,
  limit: number
): Promise<
  Result<
    {
      readonly effectiveQuery: string;
      readonly matches: SearchResult<DocIndexMetadata>[];
    },
    InternalError
  >
> {
  const initialResult = await index.search({ query, limit });

  if (initialResult.isOk()) {
    return Result.ok({
      effectiveQuery: query,
      matches: initialResult.value,
    });
  }

  if (!shouldRetryAsQuoted(query, initialResult.error.message)) {
    return Result.err(
      new InternalError({
        message: initialResult.error.message,
        context: { action: "docs.search" },
      })
    );
  }

  const quotedQuery = quoteFtsTerms(query);
  const retryResult = await index.search({ query: quotedQuery, limit });

  if (retryResult.isErr()) {
    return Result.err(
      new InternalError({
        message: retryResult.error.message,
        context: { action: "docs.search" },
      })
    );
  }

  return Result.ok({
    effectiveQuery: quotedQuery,
    matches: retryResult.value,
  });
}

function countMatches(
  indexPath: string,
  query: string
): Result<number, InternalError> {
  let db: Database | undefined;

  try {
    db = new Database(indexPath, { readonly: true });
    const row = db
      .query(
        `SELECT COUNT(*) as count FROM ${DEFAULT_TABLE_NAME} WHERE ${DEFAULT_TABLE_NAME} MATCH ?`
      )
      .get(query) as { count: number } | null;

    return Result.ok(row?.count ?? 0);
  } catch (error) {
    return Result.err(
      new InternalError({
        message:
          error instanceof Error
            ? error.message
            : "Failed to count docs search matches",
        context: { action: "docs.search" },
      })
    );
  } finally {
    db?.close();
  }
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
    // Refresh the index before searching in three cases:
    // 1. No custom indexPath — using default path, always refresh to stay current
    // 2. Custom indexPath that doesn't exist yet — must build before we can query
    // 3. Custom indexPath that already exists — skip refresh, trust the caller's index
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
      return searchResult;
    }

    // Deliberate concurrent WAL-mode read: countMatches opens a separate
    // read-only connection while the main index connection is still open.
    // SQLite WAL mode allows concurrent readers, so this is safe.
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
  lines.push(
    result.matches.length < result.total
      ? `Search Results for "${result.query}" (showing ${result.matches.length} of ${result.total})`
      : `Search Results for "${result.query}" (${result.total})`
  );
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
