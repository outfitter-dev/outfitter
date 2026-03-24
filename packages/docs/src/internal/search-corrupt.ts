import type { Index } from "@outfitter/index";

import type { DocsSearchLogger, SearchDocMetadata } from "./search-types.js";

/**
 * Tracks and removes FTS rows with corrupt or missing metadata.
 *
 * During hydration, rows that can't be parsed are skipped and their IDs
 * collected here. The tracker persists across calls within a single
 * `DocsSearch` instance so that subsequent `checkFreshness()` calls
 * correctly report stale even after `hydrateRegistry()` short-circuits.
 */
export interface CorruptRowTracker {
  /** Number of corrupt row IDs currently tracked. */
  readonly count: number;
  /** Merge newly discovered corrupt IDs (deduplicates with existing). */
  merge(ids: readonly string[]): void;
  /**
   * Remove all tracked corrupt rows from the FTS index.
   * Successfully removed IDs are cleared from tracking.
   */
  removeAll(): Promise<{ readonly removed: number; readonly failed: number }>;
}

/**
 * Create a tracker for corrupt/orphaned FTS rows.
 *
 * @param ftsIndex - The FTS5 index to remove corrupt rows from
 * @param logger - Optional logger for removal diagnostics
 */
export function createCorruptRowTracker(
  ftsIndex: Index<SearchDocMetadata>,
  logger?: DocsSearchLogger
): CorruptRowTracker {
  let ids: string[] = [];

  return {
    get count() {
      return ids.length;
    },

    merge(newIds: readonly string[]): void {
      if (newIds.length === 0) return;
      const merged = new Set([...ids, ...newIds]);
      ids = [...merged];
    },

    async removeAll(): Promise<{
      readonly removed: number;
      readonly failed: number;
    }> {
      if (ids.length === 0) {
        return { removed: 0, failed: 0 };
      }

      let removed = 0;
      let failed = 0;
      const remaining: string[] = [];

      for (const id of ids) {
        const removeResult = await ftsIndex.remove(id);

        if (removeResult.isOk()) {
          removed++;
        } else {
          failed++;
          remaining.push(id);
        }
      }

      ids = remaining;

      if (removed > 0) {
        logger?.warn("Removed corrupt/orphaned FTS rows", {
          removed,
          failed,
        });
      }

      return { removed, failed };
    },
  };
}
