/**
 * @outfitter/index - Type Definitions
 *
 * Types and interfaces for SQLite FTS5 full-text search indexing.
 *
 * @packageDocumentation
 */

import type { Result, StorageError } from "@outfitter/contracts";
import type { IndexMigrationRegistry } from "./migrations.js";

// ============================================================================
// Index Options
// ============================================================================

/**
 * FTS5 tokenizer options for text analysis.
 *
 * - `unicode61`: Default tokenizer with Unicode support (recommended for most use cases)
 * - `porter`: Applies Porter stemming algorithm for English text (finds related word forms)
 * - `trigram`: Splits text into 3-character sequences (good for substring matching)
 */
export type TokenizerType = "unicode61" | "porter" | "trigram";

/**
 * Options for creating an FTS5 index.
 *
 * @example
 * ```typescript
 * const options: IndexOptions = {
 *   path: "/path/to/index.db",
 *   tableName: "documents",
 *   tokenizer: "porter",
 * };
 *
 * const index = createIndex(options);
 * ```
 */
export interface IndexOptions {
  /**
   * Absolute path to the SQLite database file.
   * The file will be created if it does not exist.
   */
  path: string;

  /**
   * Name of the FTS5 virtual table.
   * @defaultValue "documents"
   */
  tableName?: string;

  /**
   * FTS5 tokenizer for text analysis.
   * @defaultValue "unicode61"
   */
  tokenizer?: TokenizerType;

  /**
   * Optional tool identifier recorded in index metadata.
   */
  tool?: string;

  /**
   * Optional tool version recorded in index metadata.
   */
  toolVersion?: string;

  /**
   * Optional migration registry for upgrading older index versions.
   */
  migrations?: IndexMigrationRegistry;
}

// =============================================================================
// Versioning Types
// =============================================================================

/**
 * Metadata stored alongside the index to track version and provenance.
 */
export interface IndexMetadata {
  /** File format version */
  version: number;
  /** When this index was created */
  created: string;
  /** Tool that created the index */
  tool: string;
  /** Tool version that created the index */
  toolVersion: string;
}

// ============================================================================
// Document Types
// ============================================================================

/**
 * A document to be indexed in the FTS5 index.
 *
 * Documents have a unique ID, searchable content, and optional metadata.
 * The metadata is stored as JSON and can be used to attach additional
 * information that is returned with search results.
 *
 * @example
 * ```typescript
 * const doc: IndexDocument = {
 *   id: "note-123",
 *   content: "This is the searchable text content",
 *   metadata: { title: "My Note", createdAt: Date.now() },
 * };
 * ```
 */
export interface IndexDocument {
  /** Unique identifier for this document */
  id: string;

  /** Searchable text content */
  content: string;

  /**
   * Optional metadata associated with the document.
   * Stored as JSON and returned with search results.
   */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Search Types
// ============================================================================

/**
 * Query parameters for searching the FTS5 index.
 *
 * Uses FTS5 query syntax which supports:
 * - Simple terms: `search term`
 * - Phrases: `"exact phrase"`
 * - Boolean operators: `term1 AND term2`, `term1 OR term2`, `NOT term`
 * - Prefix matching: `term*`
 * - Grouping: `(term1 OR term2) AND term3`
 *
 * @example
 * ```typescript
 * // Simple search
 * const query1: SearchQuery = { query: "typescript" };
 *
 * // Phrase search with pagination
 * const query2: SearchQuery = {
 *   query: '"error handling"',
 *   limit: 10,
 *   offset: 20,
 * };
 * ```
 */
export interface SearchQuery {
  /** FTS5 query string */
  query: string;

  /**
   * Maximum number of results to return.
   * @defaultValue 25
   */
  limit?: number;

  /**
   * Number of results to skip (for pagination).
   * @defaultValue 0
   */
  offset?: number;
}

/**
 * A single search result from an FTS5 query.
 *
 * Results include the document ID, BM25 relevance score, content,
 * and any associated metadata. Optional highlights show matching
 * snippets from the content.
 *
 * @typeParam T - Type of the metadata (defaults to `unknown`)
 *
 * @example
 * ```typescript
 * interface NoteMetadata {
 *   title: string;
 *   tags: string[];
 * }
 *
 * const result: SearchResult<NoteMetadata> = {
 *   id: "note-123",
 *   score: 0.85,
 *   content: "Full document content...",
 *   metadata: { title: "My Note", tags: ["typescript"] },
 *   highlights: ["...matching <b>snippet</b>..."],
 * };
 * ```
 */
export interface SearchResult<T = unknown> {
  /** Document ID */
  id: string;

  /**
   * BM25 relevance ranking score.
   * Higher scores indicate better matches.
   * Note: FTS5 BM25 returns negative values (closer to 0 = better match).
   */
  score: number;

  /** Full document content */
  content: string;

  /** Document metadata (if present) */
  metadata?: T;

  /**
   * Matching snippets from the content.
   * Uses FTS5 snippet() function for context-aware highlights.
   */
  highlights?: string[];
}

// ============================================================================
// Index Interface
// ============================================================================

/**
 * The FTS5 index interface for full-text search operations.
 *
 * Provides methods for adding, searching, and removing documents
 * from an SQLite FTS5 index. All operations return `Result` types
 * for explicit error handling.
 *
 * @typeParam T - Type of document metadata (defaults to `unknown`)
 *
 * @example
 * ```typescript
 * const index = createIndex<NoteMetadata>({ path: "./index.db" });
 *
 * // Add documents
 * await index.add({ id: "1", content: "Hello world", metadata: { title: "Greeting" } });
 *
 * // Search
 * const results = await index.search({ query: "hello" });
 * if (results.isOk()) {
 *   for (const result of results.value) {
 *     console.log(result.id, result.score);
 *   }
 * }
 *
 * // Cleanup
 * index.close();
 * ```
 */
export interface Index<T = unknown> {
  /**
   * Add a single document to the index.
   * If a document with the same ID exists, it will be replaced.
   *
   * @param doc - Document to add
   * @returns Result indicating success or StorageError
   */
  add(doc: IndexDocument): Promise<Result<void, StorageError>>;

  /**
   * Add multiple documents to the index in a single transaction.
   * More efficient than calling add() multiple times.
   * If a document with the same ID exists, it will be replaced.
   *
   * @param docs - Array of documents to add
   * @returns Result indicating success or StorageError
   */
  addMany(docs: IndexDocument[]): Promise<Result<void, StorageError>>;

  /**
   * Search the index using FTS5 query syntax.
   * Returns results ranked by BM25 relevance score.
   *
   * @param query - Search query parameters
   * @returns Result containing array of search results or StorageError
   */
  search(query: SearchQuery): Promise<Result<SearchResult<T>[], StorageError>>;

  /**
   * Remove a document from the index by ID.
   * No error is returned if the document does not exist.
   *
   * @param id - Document ID to remove
   * @returns Result indicating success or StorageError
   */
  remove(id: string): Promise<Result<void, StorageError>>;

  /**
   * Remove all documents from the index.
   *
   * @returns Result indicating success or StorageError
   */
  clear(): Promise<Result<void, StorageError>>;

  /**
   * Close the index and release resources.
   * The index should not be used after calling close().
   */
  close(): void;
}
