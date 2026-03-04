/**
 * Type definitions for pagination cursor persistence and state management.
 *
 * @module
 */

import type { NotFoundError, Result } from "@outfitter/contracts";

// ============================================================================
// Cursor Types
// ============================================================================

/**
 * A pagination cursor representing a position in a result set.
 *
 * Cursors are immutable (frozen) objects that encapsulate pagination state.
 * They are intentionally opaque to prevent direct manipulation - use
 * {@link advanceCursor} to create a new cursor with an updated position.
 *
 * @example
 * ```typescript
 * const result = createCursor({
 *   position: 0,
 *   metadata: { query: "status:open" },
 *   ttl: 3600000, // 1 hour
 * });
 *
 * if (result.isOk()) {
 *   const cursor = result.value;
 *   console.log(cursor.id);        // UUID
 *   console.log(cursor.position);  // 0
 *   console.log(cursor.expiresAt); // Unix timestamp
 * }
 * ```
 */
export interface Cursor {
  /** Unix timestamp (ms) when this cursor was created */
  readonly createdAt: number;
  /** Unix timestamp (ms) when this cursor expires (computed from createdAt + ttl) */
  readonly expiresAt?: number;
  /** Unique identifier for this cursor (UUID format) */
  readonly id: string;
  /** Optional user-defined metadata associated with this cursor */
  readonly metadata?: Record<string, unknown>;
  /** Current position/offset in the result set (zero-based) */
  readonly position: number;
  /** Time-to-live in milliseconds (optional, omitted if cursor never expires) */
  readonly ttl?: number;
}

/**
 * Options for creating a pagination cursor.
 *
 * @example
 * ```typescript
 * // Minimal options (ID auto-generated, no TTL)
 * const opts1: CreateCursorOptions = { position: 0 };
 *
 * // Full options with custom ID, metadata, and TTL
 * const opts2: CreateCursorOptions = {
 *   id: "my-cursor-id",
 *   position: 50,
 *   metadata: { query: "status:open", pageSize: 25 },
 *   ttl: 30 * 60 * 1000, // 30 minutes
 * };
 * ```
 */
export interface CreateCursorOptions {
  /** Custom cursor ID (UUID generated if not provided) */
  id?: string;
  /** User-defined metadata to associate with the cursor */
  metadata?: Record<string, unknown>;
  /** Starting position in the result set (must be non-negative) */
  position: number;
  /** Time-to-live in milliseconds (cursor never expires if omitted) */
  ttl?: number;
}

// ============================================================================
// Store Types
// ============================================================================

/**
 * A store for managing pagination cursors.
 *
 * Cursor stores handle storage, retrieval, and expiration of cursors.
 * Expired cursors are automatically excluded from `get()` and `has()` operations.
 *
 * @example
 * ```typescript
 * const store = createCursorStore();
 *
 * // Store a cursor
 * const cursor = createCursor({ position: 0 });
 * if (cursor.isOk()) {
 *   store.set(cursor.value);
 * }
 *
 * // Retrieve by ID
 * const result = store.get("cursor-id");
 * if (result.isOk()) {
 *   console.log(result.value.position);
 * }
 *
 * // Cleanup expired cursors
 * const pruned = store.prune();
 * console.log(`Removed ${pruned} expired cursors`);
 * ```
 */
export interface CursorStore {
  /**
   * Remove all cursors from the store.
   */
  clear(): void;
  /**
   * Delete a cursor by ID.
   * @param id - The cursor ID to delete (no-op if not found)
   */
  delete(id: string): void;
  /**
   * Retrieve a cursor by ID.
   * @param id - The cursor ID to look up
   * @returns Result with cursor or NotFoundError (also returned for expired cursors)
   */
  get(id: string): Result<Cursor, InstanceType<typeof NotFoundError>>;
  /**
   * Check if a cursor exists and is not expired.
   * @param id - The cursor ID to check
   * @returns True if cursor exists and is valid, false otherwise
   */
  has(id: string): boolean;
  /**
   * List all cursor IDs in the store (including expired).
   * @returns Array of cursor IDs
   */
  list(): string[];
  /**
   * Remove all expired cursors from the store.
   * @returns Number of cursors that were pruned
   */
  prune(): number;
  /**
   * Save or update a cursor in the store.
   * @param cursor - The cursor to store (replaces existing if same ID)
   */
  set(cursor: Cursor): void;
}

/**
 * A cursor store with namespace isolation.
 *
 * Scoped stores prefix all cursor IDs with the scope name, preventing
 * collisions between different contexts (e.g., "issues" vs "pull-requests").
 *
 * Scopes can be nested: creating a scoped store from another scoped store
 * produces IDs like "parent:child:cursor-id".
 *
 * @example
 * ```typescript
 * const store = createCursorStore();
 * const issueStore = createScopedStore(store, "issues");
 * const prStore = createScopedStore(store, "prs");
 *
 * // These don't conflict - different namespaces
 * issueStore.set(cursor1);  // Stored as "issues:abc123"
 * prStore.set(cursor2);     // Stored as "prs:abc123"
 *
 * // Clear only affects the scope
 * issueStore.clear();  // Only clears issue cursors
 * ```
 */
export interface ScopedStore extends CursorStore {
  /**
   * Get the full scope path for this store.
   * @returns Scope string (e.g., "parent:child" for nested scopes)
   */
  getScope(): string;
}

/**
 * Options for creating a persistent cursor store.
 *
 * @example
 * ```typescript
 * const options: PersistentStoreOptions = {
 *   path: "/home/user/.config/myapp/cursors.json",
 * };
 *
 * const store = await createPersistentStore(options);
 * ```
 */
export interface PersistentStoreOptions {
  /** Absolute file path for cursor persistence (JSON format) */
  path: string;
}

/**
 * A cursor store that persists to disk and survives process restarts.
 *
 * Persistent stores use atomic writes (temp file + rename) to prevent
 * corruption. They automatically load existing data on initialization
 * and handle corrupted files gracefully by starting empty.
 *
 * @example
 * ```typescript
 * const store = await createPersistentStore({
 *   path: "~/.config/myapp/cursors.json",
 * });
 *
 * // Use like any cursor store
 * store.set(cursor);
 *
 * // Flush to disk before exit
 * await store.flush();
 *
 * // Cleanup resources
 * store.dispose();
 * ```
 */
export interface PersistentStore extends CursorStore {
  /**
   * Dispose of the store and cleanup resources.
   * Call this when the store is no longer needed.
   */
  dispose(): void;
  /**
   * Flush all in-memory cursors to disk.
   * Uses atomic write (temp file + rename) to prevent corruption.
   * @returns Promise that resolves when write is complete
   */
  flush(): Promise<void>;
}

// ============================================================================
// Pagination Types
// ============================================================================

/**
 * A simple cursor store for pagination operations.
 *
 * This is a simplified interface compared to {@link CursorStore}, designed
 * specifically for pagination helpers. It returns `null` instead of errors
 * for missing cursors, making pagination code more straightforward.
 *
 * @example
 * ```typescript
 * const store = createPaginationStore();
 *
 * // Store a cursor
 * store.set("my-cursor", cursor);
 *
 * // Retrieve (returns null if not found)
 * const cursor = store.get("my-cursor");
 * if (cursor) {
 *   console.log(cursor.position);
 * }
 * ```
 */
export interface PaginationStore {
  /**
   * Delete a cursor by ID.
   * @param id - The cursor ID to delete
   */
  delete(id: string): void;
  /**
   * Get a cursor by ID.
   * @param id - The cursor ID to look up
   * @returns The cursor if found, null otherwise
   */
  get(id: string): Cursor | null;
  /**
   * Store a cursor by ID.
   * @param id - The ID to store under
   * @param cursor - The cursor to store
   */
  set(id: string, cursor: Cursor): void;
}

/**
 * Result of a pagination operation.
 *
 * @typeParam T - The type of items being paginated
 */
export interface PaginationResult<T> {
  /** The cursor for the next page, or null if this is the last page */
  nextCursor: Cursor | null;
  /** The items in the current page */
  page: T[];
}
