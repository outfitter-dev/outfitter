/**
 * @outfitter/state
 *
 * Pagination cursor persistence and ephemeral state management.
 * Handles cursor storage, expiration, and retrieval for paginated
 * CLI and MCP workflows.
 *
 * @packageDocumentation
 */

import type { Result } from "@outfitter/contracts";
import type { NotFoundError, ValidationError } from "@outfitter/contracts";

// ============================================================================
// Types
// ============================================================================

/**
 * A pagination cursor representing a position in a result set.
 */
export interface Cursor {
	/** Unique identifier for this cursor */
	readonly id: string;
	/** Current position/offset in the result set */
	readonly position: number;
	/** Optional metadata associated with this cursor */
	readonly metadata?: Record<string, unknown>;
	/** Time-to-live in milliseconds (optional) */
	readonly ttl?: number;
	/** Unix timestamp when this cursor expires (if TTL was set) */
	readonly expiresAt?: number;
	/** Timestamp when this cursor was created */
	readonly createdAt: number;
}

/**
 * Options for creating a cursor.
 */
export interface CreateCursorOptions {
	/** Optional cursor ID (generated if not provided) */
	id?: string;
	/** Starting position in the result set */
	position: number;
	/** Optional metadata to associate with the cursor */
	metadata?: Record<string, unknown>;
	/** Time-to-live in milliseconds (optional) */
	ttl?: number;
}

/**
 * A store for managing cursors.
 */
export interface CursorStore {
	/** Save a cursor to the store */
	set(cursor: Cursor): void;
	/** Retrieve a cursor by ID */
	get(id: string): Result<Cursor, InstanceType<typeof NotFoundError>>;
	/** Check if a cursor exists */
	has(id: string): boolean;
	/** Delete a cursor by ID */
	delete(id: string): void;
	/** Remove all cursors */
	clear(): void;
	/** List all cursor IDs */
	list(): string[];
	/** Remove all expired cursors, returns count of pruned cursors */
	prune(): number;
}

/**
 * A scoped cursor store with namespace isolation.
 */
export interface ScopedStore extends CursorStore {
	/** Get the current scope name */
	getScope(): string;
}

/**
 * Options for creating a persistent store.
 */
export interface PersistentStoreOptions {
	/** File path for cursor persistence */
	path: string;
}

/**
 * A persistent cursor store that survives process restarts.
 */
export interface PersistentStore extends CursorStore {
	/** Flush changes to disk */
	flush(): Promise<void>;
	/** Dispose of the store and cleanup resources */
	dispose(): void;
}

// ============================================================================
// Stub Implementations - Will throw until implemented
// ============================================================================

/**
 * Create a new cursor with the given options.
 *
 * @param options - Cursor creation options
 * @returns Result containing the cursor or ValidationError
 */
export function createCursor(
	_options: CreateCursorOptions,
): Result<Cursor, InstanceType<typeof ValidationError>> {
	throw new Error("Not implemented: createCursor");
}

/**
 * Advance a cursor to a new position, returning a new immutable cursor.
 *
 * @param cursor - The cursor to advance
 * @param newPosition - The new position
 * @returns A new cursor with the updated position
 */
export function advanceCursor(_cursor: Cursor, _newPosition: number): Cursor {
	throw new Error("Not implemented: advanceCursor");
}

/**
 * Check if a cursor has expired.
 *
 * @param cursor - The cursor to check
 * @returns True if the cursor has expired, false otherwise
 */
export function isExpired(_cursor: Cursor): boolean {
	throw new Error("Not implemented: isExpired");
}

/**
 * Create an in-memory cursor store.
 *
 * @returns A new cursor store
 */
export function createCursorStore(): CursorStore & ScopedStore {
	throw new Error("Not implemented: createCursorStore");
}

/**
 * Create a persistent cursor store that saves to disk.
 *
 * @param options - Persistence options including file path
 * @returns Promise resolving to a persistent cursor store
 */
export async function createPersistentStore(
	_options: PersistentStoreOptions,
): Promise<PersistentStore> {
	throw new Error("Not implemented: createPersistentStore");
}

/**
 * Create a scoped cursor store with namespace isolation.
 *
 * @param store - The parent store to scope
 * @param scope - The namespace for this scope
 * @returns A scoped cursor store
 */
export function createScopedStore(_store: CursorStore | ScopedStore, _scope: string): ScopedStore {
	throw new Error("Not implemented: createScopedStore");
}
