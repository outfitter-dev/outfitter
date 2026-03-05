/** Namespace-isolated cursor store wrapper. @module */

import type { NotFoundError } from "@outfitter/contracts";
import { Result } from "@outfitter/contracts";

import type { Cursor, CursorStore, ScopedStore } from "./types.js";

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
