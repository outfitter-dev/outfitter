import { basename, extname } from "node:path";

import type { Index } from "@outfitter/index";

import { quoteFtsTerms, shouldRetryAsQuoted } from "./search-query.js";
import type {
  DocRegistryEntry,
  DocsSearchLogger,
  PendingIndexDocument,
  SearchDocMetadata,
} from "./search-types.js";

/**
 * Scan the configured glob patterns and return a deduplicated list of absolute
 * file paths. Overlapping patterns are collapsed by path.
 */
export async function collectSourceFiles(
  patterns: readonly string[],
  cwd?: string
): Promise<string[]> {
  const files: string[] = [];
  const seen = new Set<string>();

  for (const pattern of patterns) {
    const glob = new Bun.Glob(pattern);
    const scanOptions: { absolute: true; cwd?: string } = { absolute: true };
    if (cwd) {
      scanOptions.cwd = cwd;
    }

    for await (const match of glob.scan(scanOptions)) {
      if (seen.has(match)) {
        continue;
      }

      seen.add(match);
      files.push(match);
    }
  }

  return files;
}

/**
 * Read source files and prepare the subset that actually needs re-indexing.
 *
 * Files that cannot be read count as failures. Files whose content hash matches
 * the hydrated registry are skipped.
 */
export async function prepareIndexDocuments(
  filePaths: readonly string[],
  docRegistry: Map<string, DocRegistryEntry>,
  logger?: DocsSearchLogger
): Promise<{
  readonly docsToAdd: PendingIndexDocument[];
  readonly failed: number;
  readonly seen: Set<string>;
  readonly total: number;
}> {
  const docsToAdd: PendingIndexDocument[] = [];
  const seen = new Set<string>();
  let failed = 0;

  for (const filePath of filePaths) {
    let content: string;

    try {
      content = await Bun.file(filePath).text();
    } catch (err) {
      failed++;
      const errorCode =
        err instanceof Error && "code" in err
          ? (err as NodeJS.ErrnoException).code
          : undefined;
      const isNotFound = errorCode === "ENOENT";

      logger?.warn("Failed to read file during indexing", {
        path: filePath,
        code: errorCode,
        error: err instanceof Error ? err.message : String(err),
      });

      // Only treat as absent (stale) if the file is truly gone.
      // For any other read error (EACCES, lock, etc.) keep it in seen
      // so it isn't pruned from the index on a transient failure.
      if (!isNotFound) {
        seen.add(filePath);
      }
      continue;
    }

    seen.add(filePath);

    const contentHash = Bun.hash.wyhash(content, 0n).toString(16);
    const existing = docRegistry.get(filePath);

    if (existing?.contentHash === contentHash) {
      continue;
    }

    const title = extractTitle(content, filePath);

    docsToAdd.push({
      id: filePath,
      content,
      metadata: { title, contentHash },
      sourcePath: filePath,
      title,
    });
  }

  return {
    docsToAdd,
    failed,
    seen,
    total: filePaths.length,
  };
}

/**
 * Add prepared documents to the FTS index, preferring a single `addMany()`
 * call and falling back to individual `add()` calls if the batch fails.
 */
export async function applyIndexDocuments(
  ftsIndex: Index<SearchDocMetadata>,
  docRegistry: Map<string, DocRegistryEntry>,
  docsToAdd: readonly PendingIndexDocument[]
): Promise<{ readonly failed: number; readonly indexed: number }> {
  if (docsToAdd.length === 0) {
    return { failed: 0, indexed: 0 };
  }

  const addResult = await ftsIndex.addMany(
    docsToAdd.map((doc) => ({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata,
    }))
  );

  if (addResult.isOk()) {
    for (const doc of docsToAdd) {
      updateRegistryEntry(docRegistry, doc);
    }

    return {
      failed: 0,
      indexed: docsToAdd.length,
    };
  }

  let failed = 0;
  let indexed = 0;

  for (const doc of docsToAdd) {
    const singleResult = await ftsIndex.add({
      id: doc.id,
      content: doc.content,
      metadata: doc.metadata,
    });

    if (singleResult.isErr()) {
      failed++;
      continue;
    }

    updateRegistryEntry(docRegistry, doc);
    indexed++;
  }

  return { failed, indexed };
}

/**
 * Remove all entries from the index and registry when no source files remain.
 *
 * This handles the transition where all matched docs disappear — a case
 * that `removeStaleDocuments()` intentionally guards against (to prevent
 * misconfigured globs from wiping the index). This function clears
 * entries one by one so the index converges to empty.
 */
export async function removeAllDocuments(
  ftsIndex: Index<SearchDocMetadata>,
  docRegistry: Map<string, DocRegistryEntry>
): Promise<{ readonly removed: number; readonly failed: number }> {
  const ids = [...docRegistry.keys()];
  let removed = 0;
  let failed = 0;

  for (const id of ids) {
    const removeResult = await ftsIndex.remove(id);

    if (removeResult.isOk()) {
      docRegistry.delete(id);
      removed++;
    } else {
      failed++;
    }
  }

  return { removed, failed };
}

/** Remove registry entries whose source files are no longer present. */
export async function removeStaleDocuments(
  ftsIndex: Index<SearchDocMetadata>,
  docRegistry: Map<string, DocRegistryEntry>,
  seen: ReadonlySet<string>
): Promise<{ readonly failed: number }> {
  // Guard: skip stale removal when no files were successfully read.
  // This prevents a misconfigured glob, transient read errors, or
  // legitimate full-file deletion from wiping the entire index.
  // Callers who intentionally remove all docs can delete the index file.
  if (seen.size === 0) {
    return { failed: 0 };
  }

  let failed = 0;
  const staleIds: string[] = [];

  for (const [existingId, entry] of docRegistry) {
    if (!seen.has(entry.sourcePath)) {
      staleIds.push(existingId);
    }
  }

  for (const staleId of staleIds) {
    const removeResult = await ftsIndex.remove(staleId);

    if (removeResult.isErr()) {
      failed++;
      continue;
    }

    docRegistry.delete(staleId);
  }

  return { failed };
}

function updateRegistryEntry(
  docRegistry: Map<string, DocRegistryEntry>,
  doc: PendingIndexDocument
): void {
  docRegistry.set(doc.id, {
    sourcePath: doc.sourcePath,
    title: doc.title,
    contentHash: doc.metadata.contentHash,
  });
}

function extractTitle(content: string, fallback: string): string {
  const match = /^#\s+(.+)$/m.exec(content);
  return match?.[1]?.trim() ?? basename(fallback, extname(fallback));
}

/**
 * Page through FTS search results, filtering out rows whose IDs are not
 * in the in-memory registry (corrupt or orphaned rows).
 *
 * Retry plain-text queries that trip FTS5 syntax errors.
 * Punctuation in terms like "result-api" or "async/await" causes
 * FTS5 parse failures; quoting each term treats them as literals.
 *
 * Returns up to `limit` results, fetching additional pages as needed to
 * fill the limit when some rows are filtered out.
 */
export async function executeFilteredSearch(
  ftsIndex: Index<SearchDocMetadata>,
  docRegistry: Map<string, DocRegistryEntry>,
  query: string,
  limit: number,
  logger?: DocsSearchLogger
): Promise<{ id: string; title: string; score: number; snippet: string }[]> {
  try {
    return await doFilteredSearch(ftsIndex, docRegistry, query, limit, logger);
  } catch (err) {
    if (err instanceof Error && shouldRetryAsQuoted(query, err.message)) {
      return await doFilteredSearch(
        ftsIndex,
        docRegistry,
        quoteFtsTerms(query),
        limit,
        logger
      );
    }
    throw err;
  }
}

async function doFilteredSearch(
  ftsIndex: Index<SearchDocMetadata>,
  docRegistry: Map<string, DocRegistryEntry>,
  query: string,
  limit: number,
  logger?: DocsSearchLogger
): Promise<{ id: string; title: string; score: number; snippet: string }[]> {
  const results: {
    id: string;
    title: string;
    score: number;
    snippet: string;
  }[] = [];
  const pageSize = Math.max(limit, 25);
  let offset = 0;

  while (results.length < limit) {
    const searchResult = await ftsIndex.search({
      query,
      limit: pageSize,
      offset,
    });

    if (searchResult.isErr()) {
      if (results.length === 0) {
        throw new Error(searchResult.error.message);
      }
      break;
    }

    const hits = searchResult.value;

    if (hits.length === 0) {
      break;
    }

    for (const hit of hits) {
      if (results.length >= limit) {
        break;
      }

      if (!docRegistry.has(hit.id)) {
        logger?.warn("Search hit excluded: ID not in registry", {
          id: hit.id,
        });
        continue;
      }

      results.push({
        id: hit.id,
        title: hit.metadata?.title ?? hit.id,
        score: hit.score,
        snippet: hit.highlights?.[0] ?? "",
      });
    }

    offset += hits.length;
  }

  return results;
}
