import type { Result } from "better-result";

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

/** A single search result from the docs search API. */
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

/** A document retrieved from the docs search registry. */
export interface DocsSearchDocument {
  readonly content: string;
  readonly title: string;
}

/** A lightweight registry entry used by `list()`. */
export interface DocsSearchListEntry {
  readonly id: string;
  readonly title: string;
}

/** Aggregated statistics returned from `index()`. */
export interface DocsSearchIndexStats {
  readonly failed: number;
  readonly indexed: number;
  readonly total: number;
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
   */
  get(id: string): Promise<Result<DocsSearchDocument | undefined, Error>>;
  /** Re-index: scan doc sources and update the FTS5 index. */
  index(): Promise<Result<DocsSearchIndexStats, Error>>;
  /**
   * List all indexed documents.
   *
   * Lazily hydrates the in-memory registry from an existing index when needed.
   */
  list(): Promise<Result<DocsSearchListEntry[], Error>>;
  /** Search across all indexed docs using FTS5 BM25. */
  search(
    query: string,
    options?: { readonly limit?: number }
  ): Promise<Result<DocsSearchResult[], Error>>;
}

/** Metadata stored alongside each indexed document in FTS5. */
export interface SearchDocMetadata {
  readonly [key: string]: unknown;
  readonly contentHash: string;
  readonly title: string;
}

/** In-memory registry entry used for read access and change detection. */
export interface DocRegistryEntry {
  readonly contentHash: string;
  readonly sourcePath: string;
  readonly title: string;
}

/** Prepared document payload for batch indexing. */
export interface PendingIndexDocument {
  readonly content: string;
  readonly id: string;
  readonly metadata: SearchDocMetadata;
  readonly sourcePath: string;
  readonly title: string;
}
