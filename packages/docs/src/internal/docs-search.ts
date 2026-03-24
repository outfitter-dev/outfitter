import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { createIndex, type Index, type SearchResult } from "@outfitter/index";
import { Result } from "better-result";

import { VERSION } from "../version.js";
import {
  applyIndexDocuments,
  collectSourceFiles,
  prepareIndexDocuments,
  removeStaleDocuments,
} from "./search-indexing.js";
import { resolveDocsSearchIndexPath } from "./search-paths.js";
import { hydrateRegistry, listRegistryEntries } from "./search-registry.js";
import type {
  DocRegistryEntry,
  DocsSearch,
  DocsSearchConfig,
  DocsSearchDocument,
  DocsSearchIndexStats,
  DocsSearchResult,
  SearchDocMetadata,
} from "./search-types.js";

// ---------------------------------------------------------------------------
// FTS5 query helpers — match the retry logic in the CLI's docs-search command
// ---------------------------------------------------------------------------

const FTS_ERROR_PATTERN = /(fts5:|no such column:)/i;
const FTS_SYNTAX_PATTERN = /["*:()]/;
const FTS_OPERATOR_PATTERN = /(^|[\s(])(AND|OR|NOT|NEAR)(?=$|[\s)])/i;

function isFtsParseError(message: string): boolean {
  return FTS_ERROR_PATTERN.test(message);
}

function hasFtsSyntax(query: string): boolean {
  return FTS_SYNTAX_PATTERN.test(query) || FTS_OPERATOR_PATTERN.test(query);
}

/** Quote each whitespace-delimited term so FTS5 treats punctuation as literal. */
function quoteFtsTerms(query: string): string {
  return query
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
    .map((t) => `"${t.replaceAll('"', '""')}"`)
    .join(" ");
}

/**
 * Create a docs search instance backed by FTS5 full-text search.
 *
 * The returned handle exposes methods for indexing, searching, listing,
 * and retrieving documentation. Call `close()` when done to release
 * the underlying database connection.
 *
 * On the first call to `index()`, `list()`, or `get()`, the in-memory
 * document registry is hydrated from the existing FTS5 index (if present).
 * This enables correct change detection and read access across process
 * restarts without forcing a fresh re-index.
 *
 * @example
 * ```typescript
 * const result = await createDocsSearch({
 *   name: "outfitter",
 *   paths: ["docs/*.md"],
 * });
 * if (result.isErr()) throw result.error;
 * const docs = result.value;
 *
 * const indexResult = await docs.index();
 * if (indexResult.isErr()) throw indexResult.error;
 *
 * const searchResult = await docs.search("fts5");
 * if (searchResult.isErr()) throw searchResult.error;
 *
 * const closeResult = await docs.close();
 * if (closeResult.isErr()) throw closeResult.error;
 * ```
 */
export async function createDocsSearch(
  config: DocsSearchConfig
): Promise<Result<DocsSearch, Error>> {
  const indexPath = resolveDocsSearchIndexPath(config);
  const tokenizer = config.tokenizer ?? "porter";

  // Freeze the working directory at creation time so that a later
  // process.chdir() doesn't change what index() scans. The cwd is
  // passed to Bun.Glob.scan() rather than baked into the pattern,
  // which avoids breakage when the path contains glob metacharacters.
  const frozenCwd = process.cwd();

  try {
    await mkdir(dirname(indexPath), { recursive: true });
  } catch (error) {
    return Result.err(
      error instanceof Error
        ? error
        : new Error("Failed to create index directory")
    );
  }

  let ftsIndex: Index<SearchDocMetadata>;

  try {
    ftsIndex = createIndex<SearchDocMetadata>({
      path: indexPath,
      tokenizer,
      tool: "outfitter-docs",
      toolVersion: VERSION,
    });
  } catch (error) {
    return Result.err(
      error instanceof Error
        ? error
        : new Error("Failed to create search index")
    );
  }

  const docRegistry = new Map<string, DocRegistryEntry>();
  const logger = config.logger;
  let isClosed = false;

  return Result.ok({
    async close(): Promise<Result<void, Error>> {
      isClosed = true;

      try {
        ftsIndex.close();
      } catch (error) {
        return Result.err(
          error instanceof Error
            ? error
            : new Error("Failed to close search index")
        );
      }

      docRegistry.clear();
      return Result.ok(undefined);
    },

    async get(
      id: string
    ): Promise<Result<DocsSearchDocument | undefined, Error>> {
      if (isClosed) {
        return Result.err(new Error("DocsSearch instance has been closed"));
      }

      try {
        const hydration = await hydrateRegistry(docRegistry, indexPath, logger);

        if (hydration.skippedIds.length > 0) {
          corruptRows.merge(hydration.skippedIds);
        }

        const entry = docRegistry.get(id);
        if (!entry) {
          return Result.ok(undefined);
        }

        const content = await Bun.file(entry.sourcePath).text();
        return Result.ok({ content, title: entry.title });
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Failed to get document")
        );
      }
    },

    async index(): Promise<Result<DocsSearchIndexStats, Error>> {
      if (isClosed) {
        return Result.err(new Error("DocsSearch instance has been closed"));
      }

      try {
        const hydration = await hydrateRegistry(docRegistry, indexPath, logger);

        if (hydration.skippedIds.length > 0) {
          corruptRows.merge(hydration.skippedIds);
        }

        const filePaths = await collectSourceFiles(config.paths, frozenCwd);
        const prepared = await prepareIndexDocuments(
          filePaths,
          docRegistry,
          logger
        );
        const added = await applyIndexDocuments(
          ftsIndex,
          docRegistry,
          prepared.docsToAdd
        );
        const stale = await removeStaleDocuments(
          ftsIndex,
          docRegistry,
          prepared.seen
        );

        return Result.ok({
          failed: prepared.failed + added.failed + stale.failed,
          indexed: added.indexed,
          total: prepared.total,
        });
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Indexing failed")
        );
      }
    },

    async list() {
      if (isClosed) {
        return Result.err(new Error("DocsSearch instance has been closed"));
      }

      try {
        const hydration = await hydrateRegistry(docRegistry, indexPath, logger);

        if (hydration.skippedIds.length > 0) {
          corruptRows.merge(hydration.skippedIds);
        }

        return Result.ok(listRegistryEntries(docRegistry));
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Failed to list documents")
        );
      }
    },

    async search(
      query: string,
      options?: { readonly limit?: number }
    ): Promise<Result<DocsSearchResult[], Error>> {
      if (isClosed) {
        return Result.err(new Error("DocsSearch instance has been closed"));
      }

      try {
        const limit = options?.limit ?? 25;
        let searchResult = await ftsIndex.search({ query, limit });

        // Retry plain-text queries that trip FTS5 syntax errors.
        // Punctuation in terms like "result-api" or "async/await" causes
        // FTS5 parse failures. Quote each term to treat them as literals.
        if (
          searchResult.isErr() &&
          isFtsParseError(searchResult.error.message) &&
          !hasFtsSyntax(query)
        ) {
          const quoted = quoteFtsTerms(query);
          searchResult = await ftsIndex.search({ query: quoted, limit });
        }

        if (searchResult.isErr()) {
          return Result.err(new Error(searchResult.error.message));
        }

        return Result.ok(
          searchResult.value.map((hit: SearchResult<SearchDocMetadata>) => ({
            id: hit.id,
            title: hit.metadata?.title ?? hit.id,
            score: hit.score,
            snippet: hit.highlights?.[0] ?? "",
          }))
        );
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Search failed")
        );
      }
    },
  });
}
