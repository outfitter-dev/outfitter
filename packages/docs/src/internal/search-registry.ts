import { Database } from "bun:sqlite";
import { basename, extname } from "node:path";

import type {
  DocRegistryEntry,
  DocsSearchListEntry,
  DocsSearchLogger,
} from "./search-types.js";

/**
 * FTS5 table name used by `@outfitter/index` by default.
 * See `packages/index/src/internal/fts5-helpers.ts` for the canonical definition.
 */
const DEFAULT_TABLE_NAME = "documents";
const hydrationPromises = new WeakMap<
  Map<string, DocRegistryEntry>,
  Promise<void>
>();

/**
 * Populate the in-memory registry from an existing FTS5 index if present.
 *
 * The index stores metadata as JSON text, so hydration only needs the `id` and
 * `metadata` columns. Invalid metadata rows are ignored.
 */
export async function hydrateRegistry(
  docRegistry: Map<string, DocRegistryEntry>,
  indexPath: string,
  logger?: DocsSearchLogger
): Promise<void> {
  if (docRegistry.size > 0) {
    return;
  }

  const existingPromise = hydrationPromises.get(docRegistry);
  if (existingPromise) {
    await existingPromise;
    return;
  }

  const hydrationPromise = doHydrateRegistry(docRegistry, indexPath, logger);
  hydrationPromises.set(docRegistry, hydrationPromise);

  try {
    await hydrationPromise;
  } finally {
    hydrationPromises.delete(docRegistry);
  }
}

async function doHydrateRegistry(
  docRegistry: Map<string, DocRegistryEntry>,
  indexPath: string,
  logger?: DocsSearchLogger
): Promise<void> {
  if (docRegistry.size > 0 || !(await Bun.file(indexPath).exists())) {
    return;
  }

  // NOTE: TOCTOU gap — the file could be deleted between the exists() check
  // and the Database open. In practice this is vanishingly unlikely (the index
  // is only removed by explicit user action), and the Database constructor will
  // throw which is caught by the caller's try/catch. Tracked for future
  // hardening if atomic open-or-skip is needed.
  const db = new Database(indexPath, { readonly: true });

  try {
    const rows = db
      .query(`SELECT id, metadata FROM ${DEFAULT_TABLE_NAME}`)
      .all() as Array<{
      id: string;
      metadata: string | null;
    }>;

    let skipped = 0;
    const skippedIds: string[] = [];

    for (const row of rows) {
      if (!row.metadata) {
        skipped++;
        skippedIds.push(row.id);
        logger?.warn("Skipping row with missing metadata during hydration", {
          id: row.id,
        });
        continue;
      }

      try {
        const meta = JSON.parse(row.metadata) as {
          contentHash?: string;
          title?: string;
        };

        docRegistry.set(row.id, {
          sourcePath: row.id,
          title: meta.title ?? basename(row.id, extname(row.id)),
          contentHash: meta.contentHash ?? "",
        });
      } catch {
        skipped++;
        skippedIds.push(row.id);
        logger?.warn(
          "Skipping row with invalid metadata JSON during hydration",
          {
            id: row.id,
            error:
              parseErr instanceof Error ? parseErr.message : String(parseErr),
          }
        );
      }
    }

    if (skipped > 0) {
      logger?.warn("Registry hydration completed with skipped rows", {
        hydrated: docRegistry.size,
        skipped,
        total: rows.length,
      });
    }
  } finally {
    db.close();
  }
}

/** Convert the registry map into the public `list()` shape. */
export function listRegistryEntries(
  docRegistry: Map<string, DocRegistryEntry>
): DocsSearchListEntry[] {
  return Array.from(docRegistry, ([id, entry]) => ({
    id,
    title: entry.title,
  }));
}
