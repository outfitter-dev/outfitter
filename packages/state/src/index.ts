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
// Cursor Functions
// ============================================================================

/**
 * Create a new cursor with the given options.
 *
 * @param options - Cursor creation options
 * @returns Result containing the cursor or ValidationError
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
 * @param cursor - The cursor to advance
 * @param newPosition - The new position
 * @returns A new cursor with the updated position
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
 * Check if a cursor has expired.
 *
 * @param cursor - The cursor to check
 * @returns True if the cursor has expired, false otherwise
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
 * @returns A new cursor store
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
 * @param options - Persistence options including file path
 * @returns Promise resolving to a persistent cursor store
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
 * @param store - The parent store to scope
 * @param scope - The namespace for this scope
 * @returns A scoped cursor store
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
