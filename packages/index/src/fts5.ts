/**
 * @outfitter/index - FTS5 Implementation
 *
 * SQLite FTS5 full-text search index implementation using bun:sqlite.
 *
 * @packageDocumentation
 */

import { Database } from "bun:sqlite";
import { Result } from "@outfitter/contracts";
import { mkdirSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import type { StorageError } from "@outfitter/contracts";
import type {
	Index,
	IndexDocument,
	IndexOptions,
	SearchQuery,
	SearchResult,
	TokenizerType,
} from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/** Default table name for the FTS5 index */
const DEFAULT_TABLE_NAME = "documents";

/** Default tokenizer for the FTS5 index */
const DEFAULT_TOKENIZER: TokenizerType = "unicode61";

/** Default limit for search results */
const DEFAULT_LIMIT = 25;

/** Default offset for search results */
const DEFAULT_OFFSET = 0;

// ============================================================================
// Storage Error Factory
// ============================================================================

/**
 * Creates a StorageError with the given message and optional cause.
 */
function createStorageError(message: string, cause?: unknown): StorageError {
	return {
		_tag: "StorageError",
		message,
		cause,
	};
}

// ============================================================================
// FTS5 Index Implementation
// ============================================================================

/**
 * Creates an FTS5 full-text search index.
 *
 * Uses SQLite FTS5 virtual table for fast full-text search with BM25 ranking.
 * The database is configured with WAL mode for better concurrency.
 *
 * @typeParam T - Type of document metadata (defaults to `unknown`)
 * @param options - Index options including database path and table configuration
 * @returns An Index instance for managing documents and searching
 *
 * @example
 * ```typescript
 * // Create an index with default settings
 * const index = createIndex({ path: "./data/index.db" });
 *
 * // Add documents
 * await index.add({
 *   id: "doc-1",
 *   content: "Hello world",
 *   metadata: { title: "Greeting" },
 * });
 *
 * // Search
 * const results = await index.search({ query: "hello" });
 *
 * // Cleanup
 * index.close();
 * ```
 *
 * @example
 * ```typescript
 * // Create an index with Porter stemmer for English text
 * const index = createIndex({
 *   path: "./data/notes.db",
 *   tableName: "notes_fts",
 *   tokenizer: "porter",
 * });
 * ```
 */
export function createIndex<T = unknown>(options: IndexOptions): Index<T> {
	const tableName = options.tableName ?? DEFAULT_TABLE_NAME;
	const tokenizer = options.tokenizer ?? DEFAULT_TOKENIZER;

	// Ensure parent directory exists
	const dir = dirname(options.path);
	if (!existsSync(dir)) {
		mkdirSync(dir, { recursive: true });
	}

	// Open database connection
	const db = new Database(options.path);

	// Enable WAL mode for better concurrency
	db.run("PRAGMA journal_mode=WAL");

	// Create FTS5 virtual table with specified tokenizer
	// Use content, id UNINDEXED, metadata UNINDEXED pattern
	// id and metadata don't need to be searchable
	db.run(`
		CREATE VIRTUAL TABLE IF NOT EXISTS ${tableName}
		USING fts5(
			id UNINDEXED,
			content,
			metadata UNINDEXED,
			tokenize='${tokenizer}'
		)
	`);

	// Track if the index is closed
	let isClosed = false;

	/**
	 * Check if the index is closed and return an error if so.
	 */
	function checkClosed(): Result<void, StorageError> {
		if (isClosed) {
			return Result.err(createStorageError("Index is closed"));
		}
		return Result.ok(undefined);
	}

	return {
		async add(doc: IndexDocument): Promise<Result<void, StorageError>> {
			const closedCheck = checkClosed();
			if (closedCheck.isErr()) {
				return closedCheck;
			}

			try {
				const metadataJson = doc.metadata ? JSON.stringify(doc.metadata) : null;

				// FTS5 doesn't support INSERT OR REPLACE, so we delete then insert
				db.run(`DELETE FROM ${tableName} WHERE id = ?`, [doc.id]);
				db.run(`INSERT INTO ${tableName} (id, content, metadata) VALUES (?, ?, ?)`, [
					doc.id,
					doc.content,
					metadataJson,
				]);

				return Result.ok(undefined);
			} catch (error) {
				return Result.err(
					createStorageError(
						error instanceof Error ? error.message : "Failed to add document",
						error,
					),
				);
			}
		},

		async addMany(docs: IndexDocument[]): Promise<Result<void, StorageError>> {
			const closedCheck = checkClosed();
			if (closedCheck.isErr()) {
				return closedCheck;
			}

			try {
				// Use a transaction for atomicity
				db.run("BEGIN TRANSACTION");

				try {
					const deleteStmt = db.prepare(`DELETE FROM ${tableName} WHERE id = ?`);
					const insertStmt = db.prepare(
						`INSERT INTO ${tableName} (id, content, metadata) VALUES (?, ?, ?)`,
					);

					for (const doc of docs) {
						const metadataJson = doc.metadata ? JSON.stringify(doc.metadata) : null;
						// FTS5 doesn't support INSERT OR REPLACE, so we delete then insert
						deleteStmt.run(doc.id);
						insertStmt.run(doc.id, doc.content, metadataJson);
					}

					deleteStmt.finalize();
					insertStmt.finalize();
					db.run("COMMIT");

					return Result.ok(undefined);
				} catch (error) {
					db.run("ROLLBACK");
					throw error;
				}
			} catch (error) {
				return Result.err(
					createStorageError(
						error instanceof Error ? error.message : "Failed to add documents",
						error,
					),
				);
			}
		},

		async search(query: SearchQuery): Promise<Result<SearchResult<T>[], StorageError>> {
			const closedCheck = checkClosed();
			if (closedCheck.isErr()) {
				return closedCheck;
			}

			const limit = query.limit ?? DEFAULT_LIMIT;
			const offset = query.offset ?? DEFAULT_OFFSET;

			try {
				// Use BM25 ranking and snippet for highlights
				// BM25 returns negative scores where less negative = more relevant
				// ORDER BY DESC puts best matches (closest to 0) first
				const rows = db
					.query(
						`
					SELECT
						id,
						content,
						metadata,
						bm25(${tableName}) as score,
						snippet(${tableName}, 1, '<b>', '</b>', '...', 32) as highlight
					FROM ${tableName}
					WHERE ${tableName} MATCH ?
					ORDER BY bm25(${tableName}) DESC
					LIMIT ? OFFSET ?
				`,
					)
					.all(query.query, limit, offset) as Array<{
					id: string;
					content: string;
					metadata: string | null;
					score: number;
					highlight: string;
				}>;

				const results: SearchResult<T>[] = rows.map((row) => {
					const result: SearchResult<T> = {
						id: row.id,
						content: row.content,
						score: row.score,
						highlights: [row.highlight],
					};

					if (row.metadata) {
						try {
							result.metadata = JSON.parse(row.metadata) as T;
						} catch {
							// Ignore invalid JSON in metadata
						}
					}

					return result;
				});

				return Result.ok(results);
			} catch (error) {
				return Result.err(
					createStorageError(error instanceof Error ? error.message : "Search failed", error),
				);
			}
		},

		async remove(id: string): Promise<Result<void, StorageError>> {
			const closedCheck = checkClosed();
			if (closedCheck.isErr()) {
				return closedCheck;
			}

			try {
				db.run(`DELETE FROM ${tableName} WHERE id = ?`, [id]);
				return Result.ok(undefined);
			} catch (error) {
				return Result.err(
					createStorageError(
						error instanceof Error ? error.message : "Failed to remove document",
						error,
					),
				);
			}
		},

		async clear(): Promise<Result<void, StorageError>> {
			const closedCheck = checkClosed();
			if (closedCheck.isErr()) {
				return closedCheck;
			}

			try {
				db.run(`DELETE FROM ${tableName}`);
				return Result.ok(undefined);
			} catch (error) {
				return Result.err(
					createStorageError(
						error instanceof Error ? error.message : "Failed to clear index",
						error,
					),
				);
			}
		},

		close(): void {
			if (!isClosed) {
				isClosed = true;
				db.close();
			}
		},
	};
}
