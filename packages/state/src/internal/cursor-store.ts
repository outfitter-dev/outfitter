/** In-memory cursor store with expiration support. @module */

import { NotFoundError, Result } from "@outfitter/contracts";

import { isExpired } from "./cursor.js";
import type { Cursor, CursorStore, ScopedStore } from "./types.js";

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
