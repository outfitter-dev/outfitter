/**
 * @outfitter/index - FTS5 Implementation
 *
 * SQLite FTS5 full-text search index implementation using bun:sqlite.
 *
 * @packageDocumentation
 */

import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { StorageError } from "@outfitter/contracts";
import { Result } from "@outfitter/contracts";
import type { IndexMigrationContext } from "./migrations.js";
import type {
  Index,
  IndexDocument,
  IndexMetadata,
  IndexOptions,
  SearchQuery,
  SearchResult,
  TokenizerType,
} from "./types.js";
import { INDEX_META_KEY, INDEX_META_TABLE, INDEX_VERSION } from "./version.js";

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

/** Allowed tokenizer values for SQL interpolation */
const VALID_TOKENIZERS: Record<TokenizerType, true> = {
  unicode61: true,
  porter: true,
  trigram: true,
};

/** SQLite identifier rules for table names (prevent injection) */
const TABLE_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** Default tool metadata when not provided */
const DEFAULT_TOOL = "outfitter-index";

/** Default tool version when not provided */
const DEFAULT_TOOL_VERSION = "0.0.0";

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

function assertValidTableName(tableName: string): void {
  if (!TABLE_NAME_PATTERN.test(tableName)) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
}

function assertValidTokenizer(tokenizer: string): TokenizerType {
  if (!Object.hasOwn(VALID_TOKENIZERS, tokenizer)) {
    throw new Error(`Invalid tokenizer: ${tokenizer}`);
  }
  return tokenizer as TokenizerType;
}

function getUserVersion(db: Database): number {
  const row = db.query("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  return row?.user_version ?? 0;
}

function setUserVersion(db: Database, version: number): void {
  if (!Number.isInteger(version) || version < 0) {
    throw new Error(`Invalid user_version: ${version}`);
  }
  db.run(`PRAGMA user_version = ${version}`);
}

function ensureMetaTable(db: Database): void {
  db.run(
    `CREATE TABLE IF NOT EXISTS ${INDEX_META_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`
  );
}

function readIndexMetadata(db: Database): IndexMetadata | null {
  try {
    const row = db
      .query(`SELECT value FROM ${INDEX_META_TABLE} WHERE key = ?`)
      .get(INDEX_META_KEY) as { value: string } | undefined;
    if (!row) {
      return null;
    }
    const parsed = JSON.parse(row.value) as IndexMetadata;
    return parsed;
  } catch {
    return null;
  }
}

function writeIndexMetadata(db: Database, metadata: IndexMetadata): void {
  ensureMetaTable(db);
  db.run(
    `INSERT OR REPLACE INTO ${INDEX_META_TABLE} (key, value) VALUES (?, ?)`,
    [INDEX_META_KEY, JSON.stringify(metadata)]
  );
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
  assertValidTableName(tableName);

  const tokenizer = assertValidTokenizer(
    options.tokenizer ?? DEFAULT_TOKENIZER
  );
  const tool = options.tool ?? DEFAULT_TOOL;
  const toolVersion = options.toolVersion ?? DEFAULT_TOOL_VERSION;

  // Ensure parent directory exists
  const dir = dirname(options.path);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Open database connection
  const db = new Database(options.path);

  // Enable WAL mode for better concurrency
  db.run("PRAGMA journal_mode=WAL");

  const currentVersion = getUserVersion(db);
  if (currentVersion === 0) {
    const metadata: IndexMetadata = {
      version: INDEX_VERSION,
      created: new Date().toISOString(),
      tool,
      toolVersion,
    };
    setUserVersion(db, INDEX_VERSION);
    writeIndexMetadata(db, metadata);
  } else if (currentVersion !== INDEX_VERSION) {
    if (!options.migrations) {
      throw new Error(
        `Index version ${currentVersion} does not match ${INDEX_VERSION}. Provide migrations or rebuild the index.`
      );
    }

    const context: IndexMigrationContext = { db };
    const result = options.migrations.migrate(
      context,
      currentVersion,
      INDEX_VERSION
    );
    if (result.isErr()) {
      throw new Error(`Failed to migrate index: ${result.error.message}`);
    }

    const existing = readIndexMetadata(db);
    const metadata: IndexMetadata = {
      version: INDEX_VERSION,
      created: existing?.created ?? new Date().toISOString(),
      tool,
      toolVersion,
    };

    setUserVersion(db, INDEX_VERSION);
    writeIndexMetadata(db, metadata);
  } else if (!readIndexMetadata(db)) {
    const metadata: IndexMetadata = {
      version: INDEX_VERSION,
      created: new Date().toISOString(),
      tool,
      toolVersion,
    };
    writeIndexMetadata(db, metadata);
  }

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
    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
    async add(doc: IndexDocument): Promise<Result<void, StorageError>> {
      const closedCheck = checkClosed();
      if (closedCheck.isErr()) {
        return closedCheck;
      }

      try {
        const metadataJson = doc.metadata ? JSON.stringify(doc.metadata) : null;

        // FTS5 doesn't support INSERT OR REPLACE, so we delete then insert
        db.run(`DELETE FROM ${tableName} WHERE id = ?`, [doc.id]);
        db.run(
          `INSERT INTO ${tableName} (id, content, metadata) VALUES (?, ?, ?)`,
          [doc.id, doc.content, metadataJson]
        );

        return Result.ok(undefined);
      } catch (error) {
        return Result.err(
          createStorageError(
            error instanceof Error ? error.message : "Failed to add document",
            error
          )
        );
      }
    },

    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
    async addMany(docs: IndexDocument[]): Promise<Result<void, StorageError>> {
      const closedCheck = checkClosed();
      if (closedCheck.isErr()) {
        return closedCheck;
      }

      try {
        // Use a transaction for atomicity
        db.run("BEGIN TRANSACTION");

        try {
          const deleteStmt = db.prepare(
            `DELETE FROM ${tableName} WHERE id = ?`
          );
          const insertStmt = db.prepare(
            `INSERT INTO ${tableName} (id, content, metadata) VALUES (?, ?, ?)`
          );

          for (const doc of docs) {
            const metadataJson = doc.metadata
              ? JSON.stringify(doc.metadata)
              : null;
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
            error
          )
        );
      }
    },

    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
    async search(
      query: SearchQuery
    ): Promise<Result<SearchResult<T>[], StorageError>> {
      const closedCheck = checkClosed();
      if (closedCheck.isErr()) {
        return closedCheck;
      }

      const limit = query.limit ?? DEFAULT_LIMIT;
      const offset = query.offset ?? DEFAULT_OFFSET;

      try {
        // Use BM25 ranking and snippet for highlights
        // BM25 returns lower scores for more relevant matches (often negative)
        // ORDER BY ASC puts best matches (smallest scores) first
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
					ORDER BY bm25(${tableName}) ASC
					LIMIT ? OFFSET ?
				`
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
          createStorageError(
            error instanceof Error ? error.message : "Search failed",
            error
          )
        );
      }
    },

    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
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
            error instanceof Error
              ? error.message
              : "Failed to remove document",
            error
          )
        );
      }
    },

    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
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
            error
          )
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
