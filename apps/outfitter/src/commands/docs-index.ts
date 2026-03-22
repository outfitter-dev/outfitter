/**
 * `outfitter docs index` - Build an FTS5 search index from workspace docs.
 *
 * Discovers all documentation entries via the docs map, reads each file,
 * and indexes content into an SQLite FTS5 database with porter stemming.
 * Uses content hashing for incremental indexing — unchanged files are skipped.
 *
 * @packageDocumentation
 */

import { Database } from "bun:sqlite";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, Result } from "@outfitter/contracts";
import { createIndex } from "@outfitter/index";
import type { Index } from "@outfitter/index";
import { createTheme } from "@outfitter/tui/render";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import { VERSION } from "../version.js";
import { loadDocsModule } from "./docs-module-loader.js";
import type { DocsMapEntryShape } from "./docs-types.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.index action handler. */
export interface DocsIndexInput {
  readonly cwd: string;
  readonly indexPath?: string | undefined;
  readonly outputMode?: CliOutputMode;
}

/** Output shape for the docs.index action. */
export interface DocsIndexOutput {
  readonly failed: number;
  readonly indexed: number;
  readonly indexPath: string;
  readonly removed: number;
  readonly skipped: number;
  readonly total: number;
}

/** Metadata stored alongside each indexed document. */
interface DocIndexMetadata {
  readonly [key: string]: unknown;
  readonly contentHash: string;
  readonly kind: string;
  readonly package?: string;
  readonly title: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Resolve the default index path scoped to a workspace.
 *
 * Hashes the workspace root path to produce a unique index file per workspace,
 * preventing cross-workspace index contamination.
 *
 * @param cwd - Workspace root directory
 * @returns Path to the workspace-scoped SQLite index file
 */
export function resolveIndexPath(cwd: string): string {
  const workspaceHash = Bun.hash.wyhash(cwd, 0n).toString(16).padStart(16, "0");
  return join(homedir(), ".outfitter", "docs", `index-${workspaceHash}.sqlite`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Read existing content hashes from the FTS5 index via direct SQL.
 *
 * The `id` column is UNINDEXED in FTS5, so FTS5 MATCH queries cannot
 * look up documents by ID. This helper opens a read-only connection to
 * the SQLite database and reads id + metadata with a plain SELECT.
 *
 * @param indexPath - Path to the SQLite index file
 * @returns Map of document ID to content hash
 */
function buildExistingHashMap(indexPath: string): Map<string, string> {
  const hashes = new Map<string, string>();

  if (!existsSync(indexPath)) {
    return hashes;
  }

  let db: Database | undefined;
  try {
    db = new Database(indexPath, { readonly: true });
    const rows = db
      .query("SELECT id, metadata FROM documents")
      .all() as Array<{
      id: string;
      metadata: string | null;
    }>;

    for (const row of rows) {
      if (row.metadata) {
        try {
          const meta = JSON.parse(row.metadata) as { contentHash?: string };
          if (typeof meta.contentHash === "string") {
            hashes.set(row.id, meta.contentHash);
          }
        } catch {
          // Skip rows with invalid JSON metadata
        }
      }
    }
  } catch {
    // Index may not exist yet or have a different schema — return empty map
  } finally {
    db?.close();
  }

  return hashes;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Build or update an FTS5 search index from workspace documentation.
 *
 * Discovers docs via `generateDocsMap()`, reads file content, hashes it
 * with `Bun.hash()` for change detection, and indexes changed files into
 * an FTS5 database with porter stemming.
 *
 * @param input - Validated action input
 * @returns Result containing indexing statistics or an error
 */
export async function runDocsIndex(
  input: DocsIndexInput
): Promise<Result<DocsIndexOutput, InternalError>> {
  const cwd = resolve(input.cwd);
  const indexPath = input.indexPath ?? resolveIndexPath(cwd);

  let index: Index<DocIndexMetadata> | undefined;

  try {
    const docsModule = await loadDocsModule();
    const mapResult = await docsModule.generateDocsMap({ workspaceRoot: cwd });

    if (mapResult.isErr()) {
      return Result.err(
        new InternalError({
          message: mapResult.error.message,
          context: { action: "docs.index" },
        })
      );
    }

    // better-result's Result2 dist alias prevents tsc from narrowing .value
    const rawMap = mapResult.value as {
      entries: DocsMapEntryShape[];
    };

    const entries = rawMap.entries;
    const total = entries.length;
    let indexed = 0;
    let skipped = 0;
    let failed = 0;
    let removed = 0;

    // Build a map of existing document hashes for change detection
    // BEFORE opening the FTS5 index, so we don't hold two concurrent
    // database connections to the same file.
    const existingHashes = buildExistingHashMap(indexPath);

    await mkdir(dirname(indexPath), { recursive: true });

    // Open or create the FTS5 index with porter stemming
    index = createIndex<DocIndexMetadata>({
      path: indexPath,
      tokenizer: "porter",
      tool: "outfitter",
      toolVersion: VERSION,
    });

    // Collect documents that need indexing
    const docsToAdd: Array<{
      id: string;
      content: string;
      metadata: DocIndexMetadata;
    }> = [];

    for (const entry of entries) {
      const sourcePath = resolve(cwd, entry.sourcePath);

      let content: string;
      try {
        content = await Bun.file(sourcePath).text();
      } catch {
        // Count unreadable files as failures
        failed++;
        continue;
      }

      // Hash content for change detection (bigint variant avoids float precision loss)
      const contentHash = Bun.hash.wyhash(content, 0n).toString(16);
      const existingHash = existingHashes.get(entry.id);

      if (existingHash === contentHash) {
        skipped++;
        continue;
      }

      const metadata: DocIndexMetadata = {
        title: entry.title,
        kind: entry.kind,
        contentHash,
        ...(entry.package !== undefined ? { package: entry.package } : {}),
      };

      docsToAdd.push({ id: entry.id, content, metadata });
    }

    // Batch add via addMany for single-transaction efficiency
    if (docsToAdd.length > 0) {
      const batchResult = await index.addMany(docsToAdd);

      if (batchResult.isErr()) {
        // Batch failed — fall back to individual adds
        for (const doc of docsToAdd) {
          const addResult = await index.add(doc);

          if (addResult.isErr()) {
            failed++;
            continue;
          }

          indexed++;
        }
      } else {
        indexed += docsToAdd.length;
      }
    }

    // Remove stale entries no longer in the docs map
    const currentIds = new Set(entries.map((e) => e.id));
    for (const staleId of existingHashes.keys()) {
      if (!currentIds.has(staleId)) {
        const removeResult = await index.remove(staleId);
        if (removeResult.isErr()) {
          failed++;
        } else {
          removed++;
        }
      }
    }

    index.close();
    index = undefined;

    return Result.ok({
      failed,
      indexed,
      indexPath,
      removed,
      skipped,
      total,
    });
  } catch (error) {
    // Ensure index is closed on error
    if (index) {
      index.close();
    }

    return Result.err(
      new InternalError({
        message:
          error instanceof Error ? error.message : "Failed to index docs",
        context: { action: "docs.index" },
      })
    );
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Print docs index results in the appropriate output format.
 *
 * @param result - The docs index output
 * @param options - Output formatting options
 */
export async function printDocsIndexResults(
  result: DocsIndexOutput,
  options?: { mode?: CliOutputMode }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (structuredMode) {
    await output(result, structuredMode);
    return;
  }

  const theme = createTheme();
  const lines: string[] = [];

  lines.push("");
  lines.push("Documentation Index");
  lines.push("=".repeat(40));
  lines.push("");
  lines.push(`  Total entries:  ${result.total}`);
  lines.push(`  Indexed:        ${result.indexed}`);
  lines.push(`  Skipped:        ${result.skipped}`);
  if (result.removed > 0) {
    lines.push(`  Removed:        ${result.removed}`);
  }
  if (result.failed > 0) {
    lines.push(`  Failed:         ${result.failed}`);
  }
  lines.push("");
  lines.push(`  Index path:     ${theme.muted(result.indexPath)}`);
  lines.push("");

  await output(lines, "human");
}
