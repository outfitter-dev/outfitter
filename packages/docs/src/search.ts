/**
 * On-device hybrid search for documentation using QMD.
 *
 * Wraps `@tobilu/qmd` with a Result-returning API surface that integrates
 * with the Outfitter handler contract. Supports BM25 keyword search,
 * vector similarity, and LLM reranking for markdown documentation.
 *
 * @example
 * ```typescript
 * import { createDocsSearch } from "@outfitter/docs/search";
 *
 * const docs = await createDocsSearch({
 *   name: "myapp",
 *   paths: ["./docs"],
 * });
 *
 * const results = await docs.search("how do handlers work?");
 * if (results.isOk()) {
 *   for (const hit of results.value) {
 *     console.log(`${hit.title} (${hit.score}): ${hit.snippet}`);
 *   }
 * }
 *
 * await docs.close();
 * ```
 *
 * @packageDocumentation
 */

import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join, dirname } from "node:path";

import { Result } from "better-result";

/**
 * Lazy-load qmd to avoid pulling in native dependencies (better-sqlite3,
 * sqlite-vec, node-llama-cpp) at import time. This keeps @outfitter/docs
 * usable in CI and environments without native build tooling.
 */
async function loadQmd() {
  try {
    return await import("@tobilu/qmd");
  } catch {
    throw new Error(
      "@tobilu/qmd is required for docs search but could not be loaded. " +
        "Install it with: bun add @tobilu/qmd"
    );
  }
}

/** Configuration for creating a docs search instance. */
export interface DocsSearchConfig {
  /** Project name — used to derive default index and assembly paths. */
  readonly name: string;
  /** Glob patterns for doc source directories (reserved for future assembly). */
  readonly paths: readonly string[];
  /** Override the default index path (`~/.{name}/docs/index.sqlite`). */
  readonly indexPath?: string;
  /** Override the default assembly directory (`~/.{name}/docs/assembled/`). */
  readonly assemblyPath?: string;
}

/** A single search result with metadata and snippet. */
export interface DocsSearchResult {
  /** Document path (virtual path or relative to assembly dir). */
  readonly path: string;
  /** Relevance score (higher is better). */
  readonly score: number;
  /** Matching snippet with surrounding context. */
  readonly snippet: string;
  /** Document title (first heading). */
  readonly title: string;
}

/** Handle to a docs search instance with search, index, get, and list operations. */
export interface DocsSearch {
  /** Search across all indexed docs using hybrid BM25 + vector retrieval. */
  search(
    query: string,
    options?: { readonly limit?: number }
  ): Promise<Result<DocsSearchResult[], Error>>;

  /** Re-index: scan doc sources, update the QMD store, and generate embeddings. */
  index(): Promise<Result<{ indexed: number; embedded: number }, Error>>;

  /** Get a specific document by path. */
  get(path: string): Promise<Result<{ content: string; title: string }, Error>>;

  /** List all indexed documents. */
  list(): Promise<Result<Array<{ path: string; title: string }>, Error>>;

  /** Release resources (database connection, LLM models). */
  close(): Promise<void>;
}

/**
 * Resolve default storage paths for a project name.
 *
 * @param name - Project name used as subdirectory
 * @returns Default indexPath and assemblyPath under `~/.{name}/docs/`
 */
function resolveDefaultPaths(name: string): {
  indexPath: string;
  assemblyPath: string;
} {
  const baseDir = join(homedir(), `.${name}`, "docs");
  return {
    indexPath: join(baseDir, "index.sqlite"),
    assemblyPath: join(baseDir, "assembled"),
  };
}

/**
 * Create a result mapper bound to the loaded qmd module.
 *
 * @param qmdModule - The lazily loaded qmd module
 */
function createResultMapper(qmdModule: Awaited<ReturnType<typeof loadQmd>>) {
  return (
    r: {
      displayPath?: string;
      file: string;
      score: number;
      bestChunk?: string;
      body: string;
      title?: string;
    },
    query: string
  ): DocsSearchResult => ({
    path: r.displayPath || r.file,
    score: r.score,
    snippet:
      r.bestChunk ||
      qmdModule.extractSnippet(r.body, query).snippet ||
      r.body.slice(0, 200),
    title: r.title || r.displayPath || "Untitled",
  });
}

/**
 * Check whether a document lookup result is a "not found" sentinel.
 *
 * @param doc - Result from `store.get()`
 */
function isNotFound(doc: unknown): doc is { error: "not_found" } {
  return (
    typeof doc === "object" &&
    doc !== null &&
    "error" in doc &&
    (doc as { error: string }).error === "not_found"
  );
}

/**
 * Create a docs search instance backed by QMD.
 *
 * The returned handle provides Result-returning methods for search, indexing,
 * document retrieval, and listing. Call `close()` when finished to release
 * database connections and LLM model resources.
 *
 * @param config - Search configuration (project name, paths, optional overrides)
 * @returns A DocsSearch handle
 *
 * @example
 * ```typescript
 * const docs = await createDocsSearch({
 *   name: "myapp",
 *   paths: ["./docs"],
 *   indexPath: "/tmp/test/index.sqlite",
 *   assemblyPath: "/tmp/test/assembled",
 * });
 *
 * const indexResult = await docs.index();
 * const searchResult = await docs.search("handler pattern");
 *
 * await docs.close();
 * ```
 */
export async function createDocsSearch(
  config: DocsSearchConfig
): Promise<DocsSearch> {
  const defaults = resolveDefaultPaths(config.name);
  const indexPath = config.indexPath ?? defaults.indexPath;
  const assemblyPath = config.assemblyPath ?? defaults.assemblyPath;

  // Ensure directories exist
  mkdirSync(dirname(indexPath), { recursive: true });
  mkdirSync(assemblyPath, { recursive: true });

  const qmd = await loadQmd();
  const toSearchResult = createResultMapper(qmd);
  const store = await qmd.createStore({
    dbPath: indexPath,
    config: {
      collections: {
        docs: {
          path: assemblyPath,
          pattern: "**/*.md",
        },
      },
    },
  });

  return {
    async search(query, options) {
      try {
        const results = await store.search({
          query,
          collection: "docs",
          limit: options?.limit ?? 10,
        });

        return Result.ok(results.map((r) => toSearchResult(r, query)));
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    async index() {
      try {
        const updateResult = await store.update({ collections: ["docs"] });

        // Embedding is best-effort — sqlite-vec or LLM models may not be available
        let embedded = 0;
        try {
          const embedResult = await store.embed();
          embedded = embedResult.chunksEmbedded;
        } catch {
          // Vector embeddings unavailable; lexical search still works
        }

        return Result.ok({
          indexed: updateResult.indexed + updateResult.updated,
          embedded,
        });
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    async get(path) {
      try {
        const doc = await store.get(path);
        if (isNotFound(doc)) {
          return Result.err(new Error(`Document not found: ${path}`));
        }
        const body = await store.getDocumentBody(path);
        return Result.ok({
          content: body ?? "",
          title:
            ("title" in doc ? (doc as { title?: string }).title : undefined) ||
            path,
        });
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    async list() {
      try {
        const { docs } = await store.multiGet("**/*.md", {
          includeBody: false,
        });
        return Result.ok(
          docs
            .filter((d) => !d.skipped)
            .map((d) => ({
              path: d.doc.displayPath || d.doc.filepath,
              title:
                ("title" in d.doc ? d.doc.title : undefined) ?? d.doc.filepath,
            }))
        );
      } catch (error) {
        return Result.err(
          error instanceof Error ? error : new Error(String(error))
        );
      }
    },

    async close() {
      await store.close();
    },
  };
}
