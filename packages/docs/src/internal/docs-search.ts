import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

import { createIndex, type Index } from "@outfitter/index";
import { Result } from "better-result";

import { VERSION } from "../version.js";
import { createCorruptRowTracker } from "./search-corrupt.js";
import {
  applyIndexDocuments,
  collectSourceFiles,
  executeFilteredSearch,
  prepareIndexDocuments,
  removeAllDocuments,
  removeStaleDocuments,
} from "./search-indexing.js";
import { resolveDocsSearchIndexPath } from "./search-paths.js";
import { hydrateRegistry, listRegistryEntries } from "./search-registry.js";
import type {
  DocRegistryEntry,
  DocsSearch,
  DocsSearchConfig,
  DocsSearchDocument,
  DocsSearchFreshness,
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
 * On the first call to `index()`, `list()`, `get()`, or `search()`, the
 * in-memory document registry is hydrated from the existing FTS5 index (if present).
 * This enables correct change detection and read access across process
 * restarts without forcing a fresh re-index.
 *
 * @example
 * ```typescript
 * const result = await createDocsSearch({ name: "outfitter", paths: ["docs/*.md"] });
 * if (result.isErr()) throw result.error;
 * const docs = result.value;
 *
 * // Refresh only when stale, then search
 * await docs.refreshIfNeeded();
 * const hits = await docs.search("fts5");
 * await docs.close();
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

  // Tracks FTS rows with corrupt/missing metadata discovered during hydration.
  // Persists across calls because hydrateRegistry() short-circuits after the
  // first call (docRegistry.size > 0), losing visibility into skipped rows.
  const corruptRows = createCorruptRowTracker(ftsIndex, logger);

  return Result.ok({
    async checkFreshness(): Promise<Result<DocsSearchFreshness, Error>> {
      if (isClosed) {
        return Result.err(new Error("DocsSearch instance has been closed"));
      }

      try {
        const hydration = await hydrateRegistry(docRegistry, indexPath, logger);

        if (hydration.skippedIds.length > 0) {
          corruptRows.merge(hydration.skippedIds);
        }

        // An index "exists" when the SQLite file has been written to disk
        // by a previous indexing run. An empty index (zero docs matching
        // globs) is still a valid, existing index.
        const exists = await Bun.file(indexPath).exists();

        const filePaths = await collectSourceFiles(config.paths, frozenCwd);
        const prepared = await prepareIndexDocuments(
          filePaths,
          docRegistry,
          logger
        );

        // Count stale entries: docs in the registry whose source files
        // are no longer matched by the configured globs.
        let staleCount = 0;
        for (const [, entry] of docRegistry) {
          if (!prepared.seen.has(entry.sourcePath)) staleCount++;
        }

        const hasChanges =
          prepared.docsToAdd.length > 0 ||
          staleCount > 0 ||
          prepared.failed > 0 ||
          corruptRows.count > 0;

        return Result.ok({
          exists,
          stale: !exists || hasChanges,
          pendingChanges:
            prepared.docsToAdd.length +
            staleCount +
            prepared.failed +
            corruptRows.count,
          totalSources: filePaths.length,
        });
      } catch (error) {
        return Result.err(
          error instanceof Error
            ? error
            : new Error("Failed to check index freshness")
        );
      }
    },

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

        // Remove corrupt/orphaned FTS rows that hydration skipped.
        const corrupt = await corruptRows.removeAll();

        return Result.ok({
          failed:
            prepared.failed + added.failed + stale.failed + corrupt.failed,
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

    async refreshIfNeeded(): Promise<
      Result<DocsSearchIndexStats | undefined, Error>
    > {
      if (isClosed) {
        return Result.err(new Error("DocsSearch instance has been closed"));
      }

      try {
        const hydration = await hydrateRegistry(docRegistry, indexPath, logger);

        if (hydration.skippedIds.length > 0) {
          corruptRows.merge(hydration.skippedIds);
        }

        const exists = await Bun.file(indexPath).exists();

        const filePaths = await collectSourceFiles(config.paths, frozenCwd);
        const prepared = await prepareIndexDocuments(
          filePaths,
          docRegistry,
          logger
        );

        let hasStale = false;
        for (const [, entry] of docRegistry) {
          if (!prepared.seen.has(entry.sourcePath)) {
            hasStale = true;
            break;
          }
        }

        if (
          exists &&
          prepared.docsToAdd.length === 0 &&
          !hasStale &&
          prepared.failed === 0 &&
          corruptRows.count === 0
        ) {
          return Result.ok(undefined);
        }

        const added = await applyIndexDocuments(
          ftsIndex,
          docRegistry,
          prepared.docsToAdd
        );

        let staleFailed = 0;
        let staleRemoved = 0;

        if (prepared.seen.size === 0 && docRegistry.size > 0) {
          const all = await removeAllDocuments(ftsIndex, docRegistry);
          staleFailed = all.failed;
          staleRemoved = all.removed;
        } else {
          const registrySizeBefore = docRegistry.size;
          const stale = await removeStaleDocuments(
            ftsIndex,
            docRegistry,
            prepared.seen
          );
          staleFailed = stale.failed;
          staleRemoved = registrySizeBefore - docRegistry.size;
        }

        const corrupt = await corruptRows.removeAll();
        const totalFailed =
          prepared.failed + added.failed + staleFailed + corrupt.failed;
        const indexMutated =
          added.indexed > 0 || staleRemoved > 0 || corrupt.removed > 0;

        // Return undefined when nothing was actually added or removed
        // and no failures occurred. When failures exist, report them
        // so callers know something went wrong even though the index
        // wasn't mutated.
        if (!indexMutated) {
          if (totalFailed > 0) {
            return Result.ok({
              failed: totalFailed,
              indexed: 0,
              total: prepared.total,
            });
          }
          return Result.ok(undefined);
        }

        return Result.ok({
          failed: totalFailed,
          indexed: added.indexed,
          total: prepared.total,
        });
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Refresh failed")
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
        const hydration = await hydrateRegistry(docRegistry, indexPath, logger);

        if (hydration.skippedIds.length > 0) {
          corruptRows.merge(hydration.skippedIds);
        }

        const limit = options?.limit ?? 25;

        const results = await executeFilteredSearch(
          ftsIndex,
          docRegistry,
          query,
          limit,
          logger
        );

        return Result.ok(results);
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Search failed")
        );
      }
    },
  });
}
