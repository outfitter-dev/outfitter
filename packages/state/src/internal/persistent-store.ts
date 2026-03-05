/** File-backed persistent cursor store with atomic writes. @module */

import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { NotFoundError, Result } from "@outfitter/contracts";

import { isExpired } from "./cursor.js";
import type {
  Cursor,
  PersistentStore,
  PersistentStoreOptions,
} from "./types.js";

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
      // oxlint-disable-next-line outfitter/no-throw-in-handler -- catch-rethrow: outer caller handles error
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
