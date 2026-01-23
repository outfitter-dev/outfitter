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
import { Result, NotFoundError, ValidationError } from "@outfitter/contracts";

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
	options: CreateCursorOptions,
): Result<Cursor, InstanceType<typeof ValidationError>> {
	// Validate position is non-negative
	if (options.position < 0) {
		return Result.err(
			new ValidationError({
				message: "Position must be non-negative",
				field: "position",
			}),
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
					}),
				);
			}

			// Check if cursor has expired
			if (isExpired(cursor)) {
				return Result.err(
					new NotFoundError({
						message: `Cursor expired: ${id}`,
						resourceType: "cursor",
						resourceId: id,
					}),
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
	options: PersistentStoreOptions,
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
					}),
				);
			}

			if (isExpired(cursor)) {
				return Result.err(
					new NotFoundError({
						message: `Cursor expired: ${id}`,
						resourceType: "cursor",
						resourceId: id,
					}),
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
export function createScopedStore(store: CursorStore | ScopedStore, scope: string): ScopedStore {
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
				}),
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
