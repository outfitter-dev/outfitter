/**
 * Pagination helpers: paginate, load/save cursors, and default store singleton.
 *
 * @module
 */

import { Result, type StorageError } from "@outfitter/contracts";

import { advanceCursor } from "./cursor.js";
import type { Cursor, PaginationResult, PaginationStore } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/**
 * Default page size when limit is not specified in cursor metadata.
 */
export const DEFAULT_PAGE_LIMIT = 25;

// ============================================================================
// Pagination Store
// ============================================================================

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

// ============================================================================
// Pagination Functions
// ============================================================================

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
