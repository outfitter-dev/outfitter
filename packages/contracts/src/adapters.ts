import type { Result } from "better-result";

/**
 * Error types for adapter operations.
 * These extend the base error taxonomy for adapter-specific failures.
 */

/** Error during indexing operations */
export interface IndexError {
  readonly _tag: "IndexError";
  readonly cause?: unknown;
  readonly message: string;
}

/** Error during cache operations */
export interface CacheError {
  readonly _tag: "CacheError";
  readonly cause?: unknown;
  readonly message: string;
}

/** Error during auth/credential operations */
export interface AdapterAuthError {
  readonly _tag: "AdapterAuthError";
  readonly cause?: unknown;
  readonly message: string;
}

/** Error during storage operations */
export interface StorageError {
  readonly _tag: "StorageError";
  readonly cause?: unknown;
  readonly message: string;
}

/**
 * Search options for index adapter.
 */
export interface SearchOptions {
  /** Fields to boost in relevance scoring */
  boostFields?: string[];

  /** Field-specific filters */
  filters?: Record<string, unknown>;
  /** Maximum results to return */
  limit?: number;

  /** Offset for pagination */
  offset?: number;
}

/**
 * Search result from index adapter.
 */
export interface SearchResult<T> {
  /** Matched items with relevance scores */
  hits: Array<{
    item: T;
    score: number;
    highlights?: Record<string, string[]>;
  }>;

  /** Search execution time in milliseconds */
  took: number;

  /** Total number of matches (for pagination) */
  total: number;
}

/**
 * Index statistics.
 */
export interface IndexStats {
  /** Total documents indexed */
  documentCount: number;

  /** Last update timestamp */
  lastUpdated: Date | null;

  /** Index size in bytes (if available) */
  sizeBytes?: number;
}

/**
 * Index adapter - pluggable full-text search backends.
 *
 * Implementations: SQLite FTS5, future: Tantivy, Meilisearch
 *
 * @typeParam T - The indexed document type
 *
 * @example
 * ```typescript
 * const sqliteIndex = new SqliteFts5Adapter<Note>({
 *   db: database,
 *   table: "notes_fts",
 *   fields: ["title", "content", "tags"],
 * });
 *
 * await sqliteIndex.index(notes);
 * const results = await sqliteIndex.search("authentication patterns");
 * ```
 */
export interface IndexAdapter<T> {
  /** Clear all indexed documents */
  clear(): Promise<Result<void, IndexError>>;
  /** Add or update documents in the index */
  index(items: T[]): Promise<Result<void, IndexError>>;

  /** Remove documents by ID */
  remove(ids: string[]): Promise<Result<void, IndexError>>;

  /** Full-text search with optional filters */
  search(
    query: string,
    options?: SearchOptions
  ): Promise<Result<SearchResult<T>, IndexError>>;

  /** Get index statistics */
  stats(): Promise<Result<IndexStats, IndexError>>;
}

/**
 * Cache adapter - pluggable caching backends.
 *
 * Implementations: SQLite, in-memory LRU, future: Redis via Bun.RedisClient
 *
 * @typeParam T - The cached value type
 *
 * @example
 * ```typescript
 * const cache = new SqliteCacheAdapter<User>({ db, table: "user_cache" });
 *
 * await cache.set("user:123", user, 3600); // 1 hour TTL
 * const cached = await cache.get("user:123");
 * ```
 */
export interface CacheAdapter<T> {
  /** Clear all cached values */
  clear(): Promise<Result<void, CacheError>>;

  /** Delete cached value, returns true if existed */
  delete(key: string): Promise<Result<boolean, CacheError>>;
  /** Get cached value, null if not found or expired */
  get(key: string): Promise<Result<T | null, CacheError>>;

  /** Get multiple values at once */
  getMany(keys: string[]): Promise<Result<Map<string, T>, CacheError>>;

  /** Check if key exists (without retrieving value) */
  has(key: string): Promise<Result<boolean, CacheError>>;

  /** Set value with optional TTL in seconds */
  set(
    key: string,
    value: T,
    ttlSeconds?: number
  ): Promise<Result<void, CacheError>>;
}

/**
 * Auth adapter - pluggable credential storage.
 *
 * Implementations: Environment, OS Keychain (via Bun.secrets), file-based
 *
 * @example
 * ```typescript
 * const auth = new KeychainAuthAdapter({ service: "outfitter" });
 *
 * await auth.set("github_token", token);
 * const stored = await auth.get("github_token");
 * ```
 */
export interface AuthAdapter {
  /** Remove credential */
  delete(key: string): Promise<Result<boolean, AdapterAuthError>>;
  /** Retrieve credential by key */
  get(key: string): Promise<Result<string | null, AdapterAuthError>>;

  /** List available credential keys (not values) */
  list(): Promise<Result<string[], AdapterAuthError>>;

  /** Store credential */
  set(key: string, value: string): Promise<Result<void, AdapterAuthError>>;
}

/**
 * Storage adapter - pluggable blob/file storage.
 *
 * Implementations: Local filesystem, S3 via Bun.S3Client, R2
 *
 * @example
 * ```typescript
 * const storage = new LocalStorageAdapter({ basePath: "/data" });
 *
 * await storage.write("notes/abc.md", content);
 * const data = await storage.read("notes/abc.md");
 * ```
 */
export interface StorageAdapter {
  /** Delete file */
  delete(path: string): Promise<Result<boolean, StorageError>>;

  /** Check if file exists */
  exists(path: string): Promise<Result<boolean, StorageError>>;

  /** List files in directory */
  list(prefix: string): Promise<Result<string[], StorageError>>;
  /** Read file contents */
  read(path: string): Promise<Result<Uint8Array, StorageError>>;

  /** Get file metadata (size, modified time) */
  stat(
    path: string
  ): Promise<Result<{ size: number; modifiedAt: Date } | null, StorageError>>;

  /** Write file contents */
  write(path: string, data: Uint8Array): Promise<Result<void, StorageError>>;
}
