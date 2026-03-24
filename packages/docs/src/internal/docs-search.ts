import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { createIndex, type Index } from "@outfitter/index";
import { Result } from "better-result";

import { VERSION } from "../version.js";
import {
  applyIndexDocuments,
  collectSourceFiles,
  prepareIndexDocuments,
  removeStaleDocuments,
} from "./search-indexing.js";
import { resolveDocsSearchIndexPath } from "./search-paths.js";
import { quoteFtsTerms, shouldRetryAsQuoted } from "./search-query.js";
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
        await hydrateRegistry(docRegistry, indexPath, logger);

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
        await hydrateRegistry(docRegistry, indexPath, logger);

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
        await hydrateRegistry(docRegistry, indexPath, logger);

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
        await hydrateRegistry(docRegistry, indexPath, logger);

        const limit = options?.limit ?? 25;
        let searchResult = await ftsIndex.search({ query, limit });

        // Retry plain-text queries that trip FTS5 syntax errors.
        // Punctuation in terms like "result-api" or "async/await" causes
        // FTS5 parse failures; quoting each term treats them as literals.
        if (
          searchResult.isErr() &&
          shouldRetryAsQuoted(query, searchResult.error.message)
        ) {
          const quoted = quoteFtsTerms(query);
          searchResult = await ftsIndex.search({ query: quoted, limit });
        }

        if (searchResult.isErr()) {
          return Result.err(new Error(searchResult.error.message));
        }

        // Filter out search hits whose IDs are not in the hydrated
        // registry (corrupt or orphaned FTS rows).
        const results: DocsSearchResult[] = [];

        for (const hit of searchResult.value) {
          if (!docRegistry.has(hit.id)) {
            logger?.warn("Search hit excluded: ID not in registry", {
              id: hit.id,
            });
            continue;
          }

          results.push({
            id: hit.id,
            title: hit.metadata?.title ?? hit.id,
            score: hit.score,
            snippet: hit.highlights?.[0] ?? "",
          });
        }

        return Result.ok(results);
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Search failed")
        );
      }
    },
  });
}
