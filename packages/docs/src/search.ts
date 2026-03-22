/**
 * Reusable FTS5-backed documentation search API.
 *
 * Wraps `@outfitter/index` to provide a high-level search interface
 * for markdown documentation. Designed with an adapter seam so the
 * underlying search backend can be swapped (e.g., to vector/semantic
 * search) without changing the consumer API.
 *
 * @example
 * ```typescript
 * import { createDocsSearch } from "@outfitter/docs/search";
 *
 * const docsResult = await createDocsSearch({
 *   name: "my-project",
 *   paths: ["docs/*.md"],
 * });
 *
 * if (docsResult.isErr()) {
 *   throw docsResult.error;
 * }
 *
 * const docs = docsResult.value;
 * const indexed = await docs.index();
 * if (indexed.isErr()) {
 *   throw indexed.error;
 * }
 *
 * const results = await docs.search("authentication");
 * if (results.isOk()) {
 *   for (const hit of results.value) {
 *     console.log(`${hit.title} (${hit.score}): ${hit.snippet}`);
 *   }
 * }
 *
 * const closed = await docs.close();
 * if (closed.isErr()) {
 *   throw closed.error;
 * }
 * ```
 *
 * @packageDocumentation
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import {
  createIndex,
  DEFAULT_TABLE_NAME,
  type Index,
  type SearchResult,
} from "@outfitter/index";
import { Result } from "better-result";

import { VERSION } from "./version.js";

// ============================================================================
// Types
// ============================================================================

/** Metadata stored alongside each indexed document in FTS5. */
interface SearchDocMetadata {
  readonly [key: string]: unknown;
  readonly contentHash: string;
  readonly title: string;
}

/**
 * Configuration for creating a docs search instance.
 *
 * @example
 * ```typescript
 * const config: DocsSearchConfig = {
 *   name: "my-project",
 *   paths: ["docs/*.md", "packages/cli/README.md"],
 * };
 * ```
 */
export interface DocsSearchConfig {
  /** Override the default index path (`~/.{name}/docs/index.sqlite`). */
  readonly indexPath?: string;
  /** Project name -- used to derive default index and assembly paths. */
  readonly name: string;
  /** Glob patterns for documentation source files. */
  readonly paths: readonly string[];
  /** Tokenizer for FTS5 indexing. @defaultValue "porter" */
  readonly tokenizer?: "porter" | "trigram" | "unicode61";
}

/**
 * A single search result from the docs search API.
 */
export interface DocsSearchResult {
  /** Document ID (absolute file path). */
  readonly id: string;
  /**
   * BM25 relevance score.
   * FTS5 BM25 returns negative values; more negative (farther from 0) indicates a stronger match.
   */
  readonly score: number;
  /** Matching snippet with context. */
  readonly snippet: string;
  /** Document title extracted from the first `#` heading. */
  readonly title: string;
}

/**
 * Handle to a docs search instance.
 *
 * Provides search, indexing, and document retrieval over a set of
 * markdown documentation files backed by an FTS5 full-text index.
 */
export interface DocsSearch {
  /**
   * Release resources (database connection).
   * @returns Result indicating whether the connection was closed cleanly
   */
  close(): Promise<Result<void, Error>>;
  /**
   * Get a specific document by ID.
   *
   * Lazily hydrates the in-memory registry from an existing index when needed.
   *
   * @returns Result containing the document content and title, undefined if not found, or an Error
   */
  get(
    id: string
  ): Promise<Result<{ content: string; title: string } | undefined, Error>>;
  /**
   * Re-index: scan doc sources and update the FTS5 index.
   * @returns Result containing indexing statistics (failed, indexed, total) or an Error
   */
  index(): Promise<
    Result<{ failed: number; indexed: number; total: number }, Error>
  >;
  /**
   * List all indexed documents.
   *
   * Lazily hydrates the in-memory registry from an existing index when needed.
   *
   * @returns Result containing an array of document IDs and titles, or an Error
   */
  list(): Promise<Result<Array<{ id: string; title: string }>, Error>>;
  /**
   * Search across all indexed docs using FTS5 BM25.
   * @returns Result containing an array of scored search results, or an Error
   */
  search(
    query: string,
    options?: { readonly limit?: number }
  ): Promise<Result<DocsSearchResult[], Error>>;
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Extract the title from markdown content by finding the first `#` heading.
 *
 * @param content - Raw markdown text
 * @param fallback - Fallback title if no heading is found
 * @returns The extracted title
 */
function extractTitle(content: string, fallback: string): string {
  const match = /^#\s+(.+)$/m.exec(content);
  return match?.[1]?.trim() ?? fallback;
}

// ============================================================================
// Factory
// ============================================================================

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
 * @param config - Search configuration (project name, glob paths, etc.)
 * @returns A `DocsSearch` handle
 *
 * @example
 * ```typescript
 * const docsResult = await createDocsSearch({
 *   name: "my-project",
 *   paths: ["docs/*.md"],
 *   indexPath: "/tmp/my-index.sqlite",
 * });
 *
 * if (docsResult.isErr()) {
 *   throw docsResult.error;
 * }
 *
 * const docs = docsResult.value;
 * const indexed = await docs.index();
 * if (indexed.isErr()) {
 *   throw indexed.error;
 * }
 *
 * const results = await docs.search("setup");
 * const closed = await docs.close();
 * if (closed.isErr()) {
 *   throw closed.error;
 * }
 * ```
 */
export async function createDocsSearch(
  config: DocsSearchConfig
): Promise<Result<DocsSearch, Error>> {
  const indexPath =
    config.indexPath ??
    join(homedir(), `.${config.name}`, "docs", "index.sqlite");
  const tokenizer = config.tokenizer ?? "porter";

  try {
    // Ensure parent directory exists
    await mkdir(dirname(indexPath), { recursive: true });
  } catch (error) {
    return Result.err(
      error instanceof Error
        ? error
        : new Error("Failed to create index directory")
    );
  }

  // Create the FTS5 index
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

  // In-memory tracking of indexed documents for list(), get(), and change detection
  const docRegistry = new Map<
    string,
    { contentHash: string; sourcePath: string; title: string }
  >();

  async function hydrateRegistry(): Promise<void> {
    if (docRegistry.size > 0 || !existsSync(indexPath)) {
      return;
    }

    const db = new Database(indexPath, { readonly: true });
    try {
      const rows = db
        .query(`SELECT id, metadata FROM ${DEFAULT_TABLE_NAME}`)
        .all() as Array<{
        id: string;
        metadata: string | null;
      }>;

      for (const row of rows) {
        if (!row.metadata) {
          continue;
        }

        try {
          const meta = JSON.parse(row.metadata) as {
            contentHash?: string;
            title?: string;
          };
          docRegistry.set(row.id, {
            sourcePath: row.id,
            title: meta.title ?? row.id,
            contentHash: meta.contentHash ?? "",
          });
        } catch {
          /* skip invalid metadata */
        }
      }
    } finally {
      db.close();
    }
  }

  return Result.ok({
    async search(
      query: string,
      options?: { readonly limit?: number }
    ): Promise<Result<DocsSearchResult[], Error>> {
      try {
        const limit = options?.limit ?? 25;
        const searchResult = await ftsIndex.search({ query, limit });

        if (searchResult.isErr()) {
          return Result.err(new Error(searchResult.error.message));
        }

        const results: DocsSearchResult[] = searchResult.value.map(
          (hit: SearchResult<SearchDocMetadata>) => ({
            id: hit.id,
            title: hit.metadata?.title ?? hit.id,
            score: hit.score,
            snippet: hit.highlights?.[0] ?? "",
          })
        );

        return Result.ok(results);
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Search failed")
        );
      }
    },

    async index(): Promise<
      Result<{ failed: number; indexed: number; total: number }, Error>
    > {
      try {
        await hydrateRegistry();

        // Collect all files from glob patterns, deduplicating overlaps
        const files: Array<{ absolutePath: string }> = [];
        const seen = new Set<string>();

        for (const pattern of config.paths) {
          const glob = new Bun.Glob(pattern);
          for await (const match of glob.scan({ absolute: true })) {
            if (!seen.has(match)) {
              seen.add(match);
              files.push({ absolutePath: match });
            }
          }
        }

        const total = files.length;
        let indexed = 0;
        let failed = 0;

        // Collect documents to add in batch
        const docsToAdd: Array<{
          content: string;
          id: string;
          metadata: SearchDocMetadata;
          sourcePath: string;
          title: string;
        }> = [];

        for (const file of files) {
          // Use absolute path as the document ID for stability regardless
          // of process.cwd() at index time
          const id = file.absolutePath;

          let content: string;
          try {
            content = await Bun.file(file.absolutePath).text();
          } catch {
            // Skip unreadable files
            failed++;
            continue;
          }

          // Hash content for change detection (bigint variant avoids float precision loss)
          const contentHash = Bun.hash.wyhash(content, 0n).toString(16);
          const existing = docRegistry.get(id);

          if (existing?.contentHash === contentHash) {
            // Content unchanged, skip re-indexing
            continue;
          }

          const title = extractTitle(content, id);
          const metadata: SearchDocMetadata = { title, contentHash };

          docsToAdd.push({
            id,
            content,
            metadata,
            sourcePath: file.absolutePath,
            title,
          });
        }

        // Batch add via addMany for single-transaction efficiency
        if (docsToAdd.length > 0) {
          const addResult = await ftsIndex.addMany(
            docsToAdd.map((d) => ({
              id: d.id,
              content: d.content,
              metadata: d.metadata,
            }))
          );

          if (addResult.isErr()) {
            // If batch fails, fall back to individual adds
            for (const doc of docsToAdd) {
              const singleResult = await ftsIndex.add({
                id: doc.id,
                content: doc.content,
                metadata: doc.metadata,
              });

              if (singleResult.isErr()) {
                failed++;
                continue;
              }

              docRegistry.set(doc.id, {
                sourcePath: doc.sourcePath,
                title: doc.title,
                contentHash: doc.metadata.contentHash,
              });
              indexed++;
            }
          } else {
            // Batch succeeded — update registry
            for (const doc of docsToAdd) {
              docRegistry.set(doc.id, {
                sourcePath: doc.sourcePath,
                title: doc.title,
                contentHash: doc.metadata.contentHash,
              });
              indexed++;
            }
          }
        }

        // Remove stale entries no longer matched by glob patterns
        const staleIds: string[] = [];
        for (const [existingId, entry] of docRegistry) {
          if (!seen.has(entry.sourcePath)) {
            staleIds.push(existingId);
          }
        }
        for (const staleId of staleIds) {
          const removeResult = await ftsIndex.remove(staleId);
          if (removeResult.isErr()) {
            failed++;
          } else {
            docRegistry.delete(staleId);
          }
        }

        return Result.ok({ failed, indexed, total });
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Indexing failed")
        );
      }
    },

    async get(
      id: string
    ): Promise<Result<{ content: string; title: string } | undefined, Error>> {
      try {
        await hydrateRegistry();
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

    async list(): Promise<Result<Array<{ id: string; title: string }>, Error>> {
      try {
        await hydrateRegistry();
        const entries: Array<{ id: string; title: string }> = [];
        for (const [id, entry] of docRegistry) {
          entries.push({ id, title: entry.title });
        }
        return Result.ok(entries);
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error("Failed to list documents")
        );
      }
    },

    async close(): Promise<Result<void, Error>> {
      try {
        ftsIndex.close();
        return Result.ok(undefined);
      } catch (error) {
        return Result.err(
          error instanceof Error
            ? error
            : new Error("Failed to close search index")
        );
      } finally {
        docRegistry.clear();
      }
    },
  });
}
