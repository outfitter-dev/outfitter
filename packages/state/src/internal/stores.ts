/**
 * Cursor store implementations: in-memory, persistent (file-backed), and scoped.
 *
 * @module
 */

import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { NotFoundError, Result } from "@outfitter/contracts";

import { isExpired } from "./cursor.js";
import type {
  Cursor,
  CursorStore,
  PersistentStore,
  PersistentStoreOptions,
  ScopedStore,
} from "./types.js";

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
const dispose = (): void => {
  // Cleanup resources - in real implementation might unregister exit handlers
};

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
      // eslint-disable-next-line outfitter/no-throw-in-handler -- catch-rethrow: outer caller handles error
      throw error;
    }
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
