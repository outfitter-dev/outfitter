/**
 * @outfitter/state
 *
 * Pagination cursor persistence and ephemeral state management.
 * Handles cursor storage, expiration, and retrieval for paginated
 * CLI and MCP workflows.
 *
 * @packageDocumentation
 */

import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import {
  NotFoundError,
  Result,
  type StorageError,
  ValidationError,
} from "@outfitter/contracts";

// ============================================================================
// Types
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
  /** Unique identifier for this cursor (UUID format) */
  readonly id: string;
  /** Current position/offset in the result set (zero-based) */
  readonly position: number;
  /** Optional user-defined metadata associated with this cursor */
  readonly metadata?: Record<string, unknown>;
  /** Time-to-live in milliseconds (optional, omitted if cursor never expires) */
  readonly ttl?: number;
  /** Unix timestamp (ms) when this cursor expires (computed from createdAt + ttl) */
  readonly expiresAt?: number;
  /** Unix timestamp (ms) when this cursor was created */
  readonly createdAt: number;
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
  /** Starting position in the result set (must be non-negative) */
  position: number;
  /** User-defined metadata to associate with the cursor */
  metadata?: Record<string, unknown>;
  /** Time-to-live in milliseconds (cursor never expires if omitted) */
  ttl?: number;
}

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
   * Save or update a cursor in the store.
   * @param cursor - The cursor to store (replaces existing if same ID)
   */
  set(cursor: Cursor): void;
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
   * Delete a cursor by ID.
   * @param id - The cursor ID to delete (no-op if not found)
   */
  delete(id: string): void;
  /**
   * Remove all cursors from the store.
   */
  clear(): void;
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
   * Flush all in-memory cursors to disk.
   * Uses atomic write (temp file + rename) to prevent corruption.
   * @returns Promise that resolves when write is complete
   */
  flush(): Promise<void>;
  /**
   * Dispose of the store and cleanup resources.
   * Call this when the store is no longer needed.
   */
  dispose(): void;
}

// ============================================================================
// Cursor Functions
// ============================================================================

/**
 * Create a new pagination cursor.
 *
 * Cursors are immutable and frozen. To update position, use {@link advanceCursor}.
 * If no ID is provided, a UUID is generated automatically.
 *
 * @param options - Cursor creation options including position, optional ID, metadata, and TTL
 * @returns Result containing frozen Cursor or ValidationError if position is negative
 *
 * @example
 * ```typescript
 * // Basic cursor at position 0
 * const result = createCursor({ position: 0 });
 *
 * // Cursor with metadata and TTL
 * const result = createCursor({
 *   position: 0,
 *   metadata: { filter: "active" },
 *   ttl: 3600000, // 1 hour
 * });
 *
 * if (result.isOk()) {
 *   store.set(result.value);
 * }
 * ```
 */
export function createCursor(
  options: CreateCursorOptions
): Result<Cursor, InstanceType<typeof ValidationError>> {
  // Validate position is non-negative
  if (options.position < 0) {
    return Result.err(
      new ValidationError({
        message: "Position must be non-negative",
        field: "position",
      })
    );
  }

  const createdAt = Date.now();
  const id = options.id ?? crypto.randomUUID();

  // Build cursor with conditional optional properties
  // Using exactOptionalPropertyTypes means we can't set undefined for optional props
  const cursor: Cursor = Object.freeze({
    id,
    position: options.position,
    createdAt,
    ...(options.metadata !== undefined && { metadata: options.metadata }),
    ...(options.ttl !== undefined && { ttl: options.ttl }),
    ...(options.ttl !== undefined && { expiresAt: createdAt + options.ttl }),
  });

  return Result.ok(cursor);
}

/**
 * Advance a cursor to a new position, returning a new immutable cursor.
 *
 * The original cursor is not modified. All properties (ID, metadata, TTL,
 * expiresAt, createdAt) are preserved in the new cursor.
 *
 * @param cursor - The cursor to advance (not modified)
 * @param newPosition - The new position value (typically cursor.position + pageSize)
 * @returns A new frozen Cursor with the updated position
 *
 * @example
 * ```typescript
 * const cursor = createCursor({ position: 0 });
 * if (cursor.isOk()) {
 *   // Advance by page size of 25
 *   const nextPage = advanceCursor(cursor.value, cursor.value.position + 25);
 *
 *   console.log(cursor.value.position); // 0 (unchanged)
 *   console.log(nextPage.position);     // 25
 *
 *   // Store the advanced cursor
 *   store.set(nextPage);
 * }
 * ```
 */
export function advanceCursor(cursor: Cursor, newPosition: number): Cursor {
  // Build new cursor preserving optional properties
  const newCursor: Cursor = Object.freeze({
    id: cursor.id,
    position: newPosition,
    createdAt: cursor.createdAt,
    ...(cursor.metadata !== undefined && { metadata: cursor.metadata }),
    ...(cursor.ttl !== undefined && { ttl: cursor.ttl }),
    ...(cursor.expiresAt !== undefined && { expiresAt: cursor.expiresAt }),
  });

  return newCursor;
}

/**
 * Check if a cursor has expired based on its TTL.
 *
 * Cursors without a TTL (no `expiresAt` property) never expire and
 * this function will always return `false` for them.
 *
 * @param cursor - The cursor to check for expiration
 * @returns `true` if cursor has expired, `false` if still valid or has no TTL
 *
 * @example
 * ```typescript
 * const cursor = createCursor({ position: 0, ttl: 1000 }); // 1 second TTL
 *
 * if (cursor.isOk()) {
 *   console.log(isExpired(cursor.value)); // false (just created)
 *
 *   // Wait 2 seconds...
 *   await new Promise(resolve => setTimeout(resolve, 2000));
 *
 *   console.log(isExpired(cursor.value)); // true (expired)
 * }
 *
 * // Cursors without TTL never expire
 * const eternal = createCursor({ position: 0 });
 * if (eternal.isOk()) {
 *   console.log(isExpired(eternal.value)); // always false
 * }
 * ```
 */
export function isExpired(cursor: Cursor): boolean {
  // Cursors without TTL never expire
  if (cursor.expiresAt === undefined) {
    return false;
  }
  return Date.now() > cursor.expiresAt;
}

/**
 * Converts standard base64 to URL-safe base64.
 * Replaces + with -, / with _, and removes = padding.
 */
function toBase64Url(base64: string): string {
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const base64Encoder = new TextEncoder();
const base64Decoder = new TextDecoder();

/**
 * Converts UTF-8 text to standard base64.
 */
function toBase64(value: string): string {
  const bytes = base64Encoder.encode(value);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

/**
 * Converts standard base64 to UTF-8 text.
 */
function fromBase64(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return base64Decoder.decode(bytes);
}

/**
 * Converts URL-safe base64 to standard base64.
 * Replaces - with +, _ with /, and adds padding if needed.
 */
function fromBase64Url(base64Url: string): string {
  let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  // Add padding if needed
  const padLength = (4 - (base64.length % 4)) % 4;
  base64 += "=".repeat(padLength);
  return base64;
}

/**
 * Encodes a cursor to an opaque URL-safe string.
 *
 * The internal structure is hidden from consumers. The cursor is serialized
 * to JSON and then encoded using URL-safe base64 (RFC 4648 Section 5).
 *
 * @param cursor - Cursor to encode
 * @returns URL-safe base64 encoded string (no +, /, or = characters)
 *
 * @example
 * ```typescript
 * const cursor = createCursor({ position: 0, metadata: { query: "status:open" } });
 * if (cursor.isOk()) {
 *   const encoded = encodeCursor(cursor.value);
 *   // encoded is a URL-safe string like "eyJpZCI6IjEyMzQ..."
 *
 *   // Can be safely used in URLs, query params, headers
 *   const url = `/api/items?cursor=${encoded}`;
 * }
 * ```
 */
export function encodeCursor(cursor: Cursor): string {
  const json = JSON.stringify(cursor);
  // Encode to standard base64, then convert to URL-safe
  const base64 = toBase64(json);
  return toBase64Url(base64);
}

/**
 * Decodes an opaque cursor string back to a Cursor.
 *
 * Validates the structure after decoding, ensuring all required fields
 * are present and have correct types.
 *
 * @param encoded - URL-safe base64 encoded cursor
 * @returns Result with decoded Cursor or ValidationError if invalid
 *
 * @example
 * ```typescript
 * // Successful decode
 * const result = decodeCursor(encodedString);
 * if (result.isOk()) {
 *   console.log(result.value.position);
 * }
 *
 * // Handle invalid input
 * const invalid = decodeCursor("not-a-valid-cursor");
 * if (invalid.isErr()) {
 *   console.log(invalid.error.message); // "Invalid cursor: ..."
 * }
 * ```
 */
export function decodeCursor(
  encoded: string
): Result<Cursor, InstanceType<typeof ValidationError>> {
  // Step 1: Decode base64
  let json: string;
  try {
    const base64 = fromBase64Url(encoded);
    json = fromBase64(base64);
  } catch {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: failed to decode base64",
        field: "cursor",
      })
    );
  }

  // Step 2: Parse JSON
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: failed to parse JSON",
        field: "cursor",
      })
    );
  }

  // Step 3: Validate structure
  if (typeof data !== "object" || data === null) {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: expected object",
        field: "cursor",
      })
    );
  }

  interface ParsedCursor {
    id: string;
    position: number;
    createdAt: number;
    metadata?: Record<string, unknown>;
    ttl?: number;
    expiresAt?: number;
  }

  const obj = data as Partial<ParsedCursor>;

  // Validate required fields
  if (typeof obj.id !== "string") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: missing or invalid 'id' field",
        field: "cursor.id",
      })
    );
  }

  if (typeof obj.position !== "number") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: missing or invalid 'position' field",
        field: "cursor.position",
      })
    );
  }

  // Reject negative positions (matches createCursor validation)
  if (obj.position < 0) {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: position must be non-negative",
        field: "cursor.position",
      })
    );
  }

  if (typeof obj.createdAt !== "number") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: missing or invalid 'createdAt' field",
        field: "cursor.createdAt",
      })
    );
  }

  // Validate optional fields if present
  if (
    obj.metadata !== undefined &&
    (typeof obj.metadata !== "object" || obj.metadata === null)
  ) {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: 'metadata' must be an object",
        field: "cursor.metadata",
      })
    );
  }

  if (obj.ttl !== undefined && typeof obj.ttl !== "number") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: 'ttl' must be a number",
        field: "cursor.ttl",
      })
    );
  }

  if (obj.expiresAt !== undefined && typeof obj.expiresAt !== "number") {
    return Result.err(
      new ValidationError({
        message: "Invalid cursor: 'expiresAt' must be a number",
        field: "cursor.expiresAt",
      })
    );
  }

  // Build the cursor with proper typing
  const cursor: Cursor = Object.freeze({
    id: obj.id,
    position: obj.position,
    createdAt: obj.createdAt,
    ...(obj.metadata !== undefined && {
      metadata: obj.metadata as Record<string, unknown>,
    }),
    ...(obj.ttl !== undefined && { ttl: obj.ttl }),
    ...(obj.expiresAt !== undefined && { expiresAt: obj.expiresAt }),
  });

  return Result.ok(cursor);
}

// ============================================================================
// Cursor Store
// ============================================================================

/**
 * Create an in-memory cursor store.
 *
 * The store automatically handles expiration: `get()` and `has()` return
 * not-found/false for expired cursors. Use `prune()` to remove expired
 * cursors from memory.
 *
 * @returns A new cursor store implementing both CursorStore and ScopedStore interfaces
 *
 * @example
 * ```typescript
 * const store = createCursorStore();
 *
 * // Create and store a cursor
 * const cursor = createCursor({
 *   position: 0,
 *   metadata: { query: "status:open" },
 *   ttl: 3600000, // 1 hour
 * });
 *
 * if (cursor.isOk()) {
 *   store.set(cursor.value);
 *
 *   // Retrieve later
 *   const result = store.get(cursor.value.id);
 *   if (result.isOk()) {
 *     console.log(result.value.position);
 *   }
 * }
 *
 * // List all cursors
 * console.log(store.list()); // ["cursor-id", ...]
 *
 * // Cleanup expired
 * const pruned = store.prune();
 * ```
 */
export function createCursorStore(): CursorStore & ScopedStore {
  const cursors = new Map<string, Cursor>();

  return {
    set(cursor: Cursor): void {
      cursors.set(cursor.id, cursor);
    },

    get(id: string): Result<Cursor, InstanceType<typeof NotFoundError>> {
      const cursor = cursors.get(id);

      if (cursor === undefined) {
        return Result.err(
          new NotFoundError({
            message: `Cursor not found: ${id}`,
            resourceType: "cursor",
            resourceId: id,
          })
        );
      }

      // Check if cursor has expired
      if (isExpired(cursor)) {
        return Result.err(
          new NotFoundError({
            message: `Cursor expired: ${id}`,
            resourceType: "cursor",
            resourceId: id,
          })
        );
      }

      return Result.ok(cursor);
    },

    has(id: string): boolean {
      const cursor = cursors.get(id);
      if (cursor === undefined) {
        return false;
      }
      // Don't report expired cursors as existing
      return !isExpired(cursor);
    },

    delete(id: string): void {
      cursors.delete(id);
    },

    clear(): void {
      cursors.clear();
    },

    list(): string[] {
      return Array.from(cursors.keys());
    },

    prune(): number {
      let count = 0;
      for (const [id, cursor] of cursors) {
        if (isExpired(cursor)) {
          cursors.delete(id);
          count++;
        }
      }
      return count;
    },

    getScope(): string {
      return "";
    },
  };
}

// ============================================================================
// Persistent Store
// ============================================================================

interface StorageFormat {
  cursors: Record<string, Cursor>;
}

/**
 * Create a persistent cursor store that saves to disk.
 *
 * The store loads existing cursors from the file on initialization.
 * Changes are kept in memory until `flush()` is called. Uses atomic
 * writes (temp file + rename) to prevent corruption.
 *
 * If the file is corrupted or invalid JSON, the store starts empty
 * rather than throwing an error.
 *
 * @param options - Persistence options including the file path
 * @returns Promise resolving to a PersistentStore
 *
 * @example
 * ```typescript
 * // Create persistent store
 * const store = await createPersistentStore({
 *   path: "/home/user/.config/myapp/cursors.json",
 * });
 *
 * // Use like any cursor store
 * const cursor = createCursor({ position: 0 });
 * if (cursor.isOk()) {
 *   store.set(cursor.value);
 * }
 *
 * // Flush to disk (call before process exit)
 * await store.flush();
 *
 * // Cleanup when done
 * store.dispose();
 * ```
 *
 * @example
 * ```typescript
 * // Combine with scoped stores for organized persistence
 * const persistent = await createPersistentStore({
 *   path: "~/.config/myapp/cursors.json",
 * });
 *
 * const issuesCursors = createScopedStore(persistent, "issues");
 * const prsCursors = createScopedStore(persistent, "prs");
 *
 * // All scopes share the same persistence file
 * await persistent.flush();
 * ```
 */
export async function createPersistentStore(
  options: PersistentStoreOptions
): Promise<PersistentStore> {
  const { path: storagePath } = options;
  const cursors = new Map<string, Cursor>();

  // Load existing data from file if it exists
  if (existsSync(storagePath)) {
    try {
      const content = await Bun.file(storagePath).text();
      const data = JSON.parse(content) as StorageFormat;
      if (data.cursors && typeof data.cursors === "object") {
        for (const [id, cursor] of Object.entries(data.cursors)) {
          cursors.set(id, cursor);
        }
      }
    } catch {
      // File corrupted or invalid - start with empty store
    }
  }

  const flush = async (): Promise<void> => {
    // Ensure directory exists
    const dir = dirname(storagePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Convert Map to object for serialization
    const data: StorageFormat = {
      cursors: Object.fromEntries(cursors),
    };

    // Atomic write: write to temp file, then rename
    const tempPath = `${storagePath}.tmp.${Date.now()}`;
    const content = JSON.stringify(data, null, 2);

    try {
      writeFileSync(tempPath, content, { encoding: "utf-8" });
      // Rename is atomic on most filesystems
      renameSync(tempPath, storagePath);
    } catch (error) {
      // Try to clean up temp file on failure
      try {
        const { unlinkSync } = await import("node:fs");
        unlinkSync(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  };

  const dispose = (): void => {
    // Cleanup resources - in real implementation might unregister exit handlers
  };

  return {
    set(cursor: Cursor): void {
      cursors.set(cursor.id, cursor);
    },

    get(id: string): Result<Cursor, InstanceType<typeof NotFoundError>> {
      const cursor = cursors.get(id);

      if (cursor === undefined) {
        return Result.err(
          new NotFoundError({
            message: `Cursor not found: ${id}`,
            resourceType: "cursor",
            resourceId: id,
          })
        );
      }

      if (isExpired(cursor)) {
        return Result.err(
          new NotFoundError({
            message: `Cursor expired: ${id}`,
            resourceType: "cursor",
            resourceId: id,
          })
        );
      }

      return Result.ok(cursor);
    },

    has(id: string): boolean {
      const cursor = cursors.get(id);
      if (cursor === undefined) {
        return false;
      }
      return !isExpired(cursor);
    },

    delete(id: string): void {
      cursors.delete(id);
    },

    clear(): void {
      cursors.clear();
    },

    list(): string[] {
      return Array.from(cursors.keys());
    },

    prune(): number {
      let count = 0;
      for (const [id, cursor] of cursors) {
        if (isExpired(cursor)) {
          cursors.delete(id);
          count++;
        }
      }
      return count;
    },

    flush,
    dispose,
  };
}

// ============================================================================
// Scoped Store
// ============================================================================

/**
 * Create a scoped cursor store with namespace isolation.
 *
 * Scoped stores prefix all cursor IDs with the scope name, preventing
 * collisions between different contexts (e.g., "issues" vs "pull-requests").
 *
 * Scopes can be nested: `createScopedStore(scopedStore, "child")` creates
 * IDs like "parent:child:cursor-id".
 *
 * When retrieving cursors, the scope prefix is automatically stripped,
 * so consumers see clean IDs without the namespace prefix.
 *
 * @param store - Parent store to scope (CursorStore or another ScopedStore for nesting)
 * @param scope - Namespace for this scope (will be prefixed to all cursor IDs)
 * @returns ScopedStore with isolated cursor management
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
 * // Retrieved cursors have clean IDs
 * const result = issueStore.get("abc123");
 * if (result.isOk()) {
 *   result.value.id; // "abc123" (not "issues:abc123")
 * }
 *
 * // Clear only affects the scope
 * issueStore.clear();  // Only clears issue cursors
 * prStore.list();      // PR cursors still exist
 * ```
 *
 * @example
 * ```typescript
 * // Nested scopes for hierarchical organization
 * const store = createCursorStore();
 * const githubStore = createScopedStore(store, "github");
 * const issuesStore = createScopedStore(githubStore, "issues");
 *
 * issuesStore.getScope(); // "github:issues"
 *
 * // Cursor stored as "github:issues:cursor-id"
 * issuesStore.set(cursor);
 * ```
 */
export function createScopedStore(
  store: CursorStore | ScopedStore,
  scope: string
): ScopedStore {
  // Get parent scope if available
  const parentScope = "getScope" in store ? store.getScope() : "";
  const fullScope = parentScope ? `${parentScope}:${scope}` : scope;
  const prefix = `${fullScope}:`;

  return {
    set(cursor: Cursor): void {
      // Create a new cursor with the prefixed ID
      const scopedCursor = Object.freeze({
        ...cursor,
        id: `${prefix}${cursor.id}`,
      });
      store.set(scopedCursor);
    },

    get(id: string): Result<Cursor, InstanceType<typeof NotFoundError>> {
      const result = store.get(`${prefix}${id}`);
      if (result.isErr()) {
        return result;
      }
      // Strip prefix from cursor ID to present clean ID to caller
      // This prevents double-prefixing when cursor is updated and set again
      const cursor = result.value;
      return Result.ok(
        Object.freeze({
          ...cursor,
          id: cursor.id.slice(prefix.length),
        })
      );
    },

    has(id: string): boolean {
      return store.has(`${prefix}${id}`);
    },

    delete(id: string): void {
      store.delete(`${prefix}${id}`);
    },

    clear(): void {
      // Only clear cursors in this scope
      const ids = store.list().filter((id) => id.startsWith(prefix));
      for (const id of ids) {
        store.delete(id);
      }
    },

    list(): string[] {
      // Return only IDs in this scope, without the prefix
      return store
        .list()
        .filter((id) => id.startsWith(prefix))
        .map((id) => id.slice(prefix.length));
    },

    prune(): number {
      return store.prune();
    },

    getScope(): string {
      return fullScope;
    },
  };
}

// ============================================================================
// Pagination Helpers
// ============================================================================

/**
 * Default page size when limit is not specified in cursor metadata.
 */
export const DEFAULT_PAGE_LIMIT = 25;

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
  /**
   * Delete a cursor by ID.
   * @param id - The cursor ID to delete
   */
  delete(id: string): void;
}

// Module-level default store instance (lazy initialization)
let defaultPaginationStore: PaginationStore | null = null;

/**
 * Get the default pagination store (module-level singleton).
 *
 * The default store is lazily initialized on first access.
 * Use this when you want cursors to persist across multiple
 * load/save calls within the same process.
 *
 * @returns The default pagination store instance
 *
 * @example
 * ```typescript
 * const store = getDefaultPaginationStore();
 * store.set("cursor-1", cursor);
 *
 * // Later, same store is returned
 * const sameStore = getDefaultPaginationStore();
 * sameStore.get("cursor-1"); // Returns the cursor
 * ```
 */
export function getDefaultPaginationStore(): PaginationStore {
  if (defaultPaginationStore === null) {
    defaultPaginationStore = createPaginationStore();
  }
  return defaultPaginationStore;
}

/**
 * Create an in-memory pagination store.
 *
 * This is a simple Map-backed store for cursor persistence.
 * Unlike {@link createCursorStore}, this store does not handle
 * TTL/expiration - it's designed for simple pagination use cases.
 *
 * @returns A new pagination store instance
 *
 * @example
 * ```typescript
 * const store = createPaginationStore();
 *
 * const cursor = createCursor({ position: 0, metadata: { limit: 25 } });
 * if (cursor.isOk()) {
 *   store.set(cursor.value.id, cursor.value);
 *   const retrieved = store.get(cursor.value.id);
 * }
 * ```
 */
export function createPaginationStore(): PaginationStore {
  const cursors = new Map<string, Cursor>();

  return {
    get(id: string): Cursor | null {
      return cursors.get(id) ?? null;
    },

    set(id: string, cursor: Cursor): void {
      cursors.set(id, cursor);
    },

    delete(id: string): void {
      cursors.delete(id);
    },
  };
}

/**
 * Result of a pagination operation.
 *
 * @typeParam T - The type of items being paginated
 */
export interface PaginationResult<T> {
  /** The items in the current page */
  page: T[];
  /** The cursor for the next page, or null if this is the last page */
  nextCursor: Cursor | null;
}

/**
 * Extract a page of items based on cursor position.
 *
 * Uses `cursor.position` as the offset and `cursor.metadata.limit` as
 * the page size (defaults to {@link DEFAULT_PAGE_LIMIT} if not specified).
 *
 * Returns a `nextCursor` for fetching the next page, or `null` if there
 * are no more items (i.e., this is the last page).
 *
 * @typeParam T - The type of items being paginated
 * @param items - The full array of items to paginate
 * @param cursor - Cursor containing position (offset) and optionally limit in metadata
 * @returns Object containing the page slice and next cursor (or null)
 *
 * @example
 * ```typescript
 * const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
 * const cursor = createCursor({
 *   position: 0,
 *   metadata: { limit: 3 },
 * });
 *
 * if (cursor.isOk()) {
 *   const { page, nextCursor } = paginate(items, cursor.value);
 *   console.log(page); // [1, 2, 3]
 *   console.log(nextCursor?.position); // 3
 *
 *   if (nextCursor) {
 *     const { page: page2 } = paginate(items, nextCursor);
 *     console.log(page2); // [4, 5, 6]
 *   }
 * }
 * ```
 */
export function paginate<T>(items: T[], cursor: Cursor): PaginationResult<T> {
  const offset = cursor.position;

  // Validate limit: must be a positive integer, fallback to DEFAULT_PAGE_LIMIT
  const rawLimit = (cursor.metadata as { limit?: unknown } | undefined)?.limit;
  const limit =
    typeof rawLimit === "number" && Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.floor(rawLimit)
      : DEFAULT_PAGE_LIMIT;

  // Extract the page slice
  const page = items.slice(offset, offset + limit);

  // Calculate next position
  const nextPosition = offset + page.length;

  // If we've reached or passed the end, no next cursor
  if (nextPosition >= items.length) {
    return { page, nextCursor: null };
  }

  // Create next cursor with updated position
  const nextCursor = advanceCursor(cursor, nextPosition);

  return { page, nextCursor };
}

/**
 * Load a cursor from a pagination store.
 *
 * Returns `Ok(null)` if the cursor is not found (not an error).
 * This differs from {@link CursorStore.get} which returns a `NotFoundError`.
 *
 * @param id - The cursor ID to load
 * @param store - Optional store to load from (defaults to module-level store)
 * @returns Result containing the cursor or null if not found
 *
 * @example
 * ```typescript
 * // Using default store
 * const result = loadCursor("my-cursor");
 * if (result.isOk()) {
 *   if (result.value) {
 *     console.log(`Found cursor at position ${result.value.position}`);
 *   } else {
 *     console.log("Cursor not found, starting fresh");
 *   }
 * }
 *
 * // Using custom store
 * const store = createPaginationStore();
 * const result = loadCursor("my-cursor", store);
 * ```
 */
export function loadCursor(
  id: string,
  store?: PaginationStore
): Result<Cursor | null, StorageError> {
  const effectiveStore = store ?? getDefaultPaginationStore();
  const cursor = effectiveStore.get(id);
  return Result.ok(cursor);
}

/**
 * Save a cursor to a pagination store.
 *
 * The cursor is stored by its `id` property.
 *
 * @param cursor - The cursor to save
 * @param store - Optional store to save to (defaults to module-level store)
 * @returns Result indicating success or storage error
 *
 * @example
 * ```typescript
 * const cursor = createCursor({
 *   id: "search-results",
 *   position: 50,
 *   metadata: { limit: 25, query: "status:open" },
 * });
 *
 * if (cursor.isOk()) {
 *   // Save to default store
 *   saveCursor(cursor.value);
 *
 *   // Or save to custom store
 *   const store = createPaginationStore();
 *   saveCursor(cursor.value, store);
 * }
 * ```
 */
export function saveCursor(
  cursor: Cursor,
  store?: PaginationStore
): Result<void, StorageError> {
  const effectiveStore = store ?? getDefaultPaginationStore();
  effectiveStore.set(cursor.id, cursor);
  return Result.ok(undefined);
}
