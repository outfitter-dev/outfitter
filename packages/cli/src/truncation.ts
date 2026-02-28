/**
 * Output truncation with pagination hints and file pointers.
 *
 * When a `limit` option is configured and the output exceeds that limit,
 * this module truncates the result and provides:
 *
 * - Truncation metadata (`{ showing, total, truncated }`)
 * - Pagination CLIHint(s) for continuation (`--offset`, `--limit`)
 * - File pointer (`{ full_output: path }`) for very large output
 *
 * Without `limit`, output passes through untouched.
 * Structured output (JSON/JSONL) remains parseable after truncation.
 * File write failures degrade gracefully (no crash).
 *
 * @packageDocumentation
 */

import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join, normalize } from "node:path";

import type { CLIHint } from "@outfitter/contracts";

import { cliStringify } from "./output.js";

// =============================================================================
// Constants
// =============================================================================

/**
 * Default threshold (in items) above which a file pointer is generated
 * for the full output. Can be overridden via `filePointerThreshold` option.
 */
export const DEFAULT_FILE_POINTER_THRESHOLD = 1000;

/**
 * Prefix for temp files written by truncation.
 */
const TEMP_FILE_PREFIX = "outfitter-output-";

// =============================================================================
// Types
// =============================================================================

/**
 * Options for output truncation.
 */
export interface TruncationOptions {
  /**
   * Command name used in pagination hints.
   * When provided, hints include the full command for continuation.
   */
  readonly commandName?: string;

  /**
   * Threshold (in items) above which full output is written to a temp file.
   * Defaults to {@link DEFAULT_FILE_POINTER_THRESHOLD}.
   */
  readonly filePointerThreshold?: number;

  /**
   * Maximum number of items to include in the output.
   * When undefined, output is not truncated.
   */
  readonly limit?: number;

  /**
   * Starting offset for pagination (0-based).
   * Defaults to 0.
   */
  readonly offset?: number;

  /**
   * Custom temp directory for file pointers.
   * Defaults to the OS temp directory.
   * Primarily used for testing fault injection.
   */
  readonly tempDir?: string;
}

/**
 * Metadata about truncation applied to the output.
 *
 * Present only when truncation was applied.
 */
export interface TruncationMetadata {
  /**
   * Path to a temp file containing the complete output.
   * Present only when output exceeds the file pointer threshold.
   */
  readonly full_output?: string;

  /** Number of items in the truncated output. */
  readonly showing: number;

  /** Total number of items before truncation. */
  readonly total: number;

  /** Always `true` when metadata is present. */
  readonly truncated: true;
}

/**
 * Result of applying truncation to an output array.
 *
 * @typeParam T - Type of items in the output array
 */
export interface TruncationResult<T = unknown> {
  /** The (possibly truncated) output data. */
  readonly data: T[];

  /** Pagination and warning hints. Empty when no truncation applied. */
  readonly hints: CLIHint[];

  /** Truncation metadata. Undefined when no truncation was applied. */
  readonly metadata: TruncationMetadata | undefined;
}

// =============================================================================
// Implementation
// =============================================================================

/**
 * Pattern matching unsafe path components:
 * - `..` traversal segments (e.g., `/../`, `\..`, etc.)
 */
const PATH_TRAVERSAL_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)/;

/**
 * Validate that a tempDir path is safe for writing.
 *
 * A safe tempDir must be:
 * - An absolute path (starts with /)
 * - Free of `..` traversal segments after normalization
 *
 * Returns the validated (normalized) path, or undefined if unsafe.
 */
function validateTempDir(dir: string): string | undefined {
  // Must be an absolute path
  if (!isAbsolute(dir)) {
    return undefined;
  }

  // Normalize to resolve any `.` or `..` segments
  const normalized = normalize(dir);

  // normalize() on POSIX fully resolves all `..` segments, so this check
  // should never match — kept as a defense-in-depth safety net only.
  if (PATH_TRAVERSAL_PATTERN.test(normalized)) {
    return undefined;
  }

  // Also reject if the normalized path differs significantly from input
  // (e.g., /tmp/safe/../../../etc normalizes to /etc — outside expected dir)
  // Check that the normalized result is still under a reasonable root
  // by verifying no `..` pattern existed in the original input
  if (PATH_TRAVERSAL_PATTERN.test(dir)) {
    return undefined;
  }

  return normalized;
}

/**
 * Generate a unique temp file path for full output persistence.
 */
function generateTempFilePath(dir: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  return join(dir, `${TEMP_FILE_PREFIX}${timestamp}-${random}.json`);
}

/**
 * Attempt to write full output to a temp file.
 *
 * Returns the file path on success, or undefined on failure.
 * Never throws — file write failures are handled gracefully.
 */
function writeFullOutput(
  data: unknown[],
  tempDir: string
): { path: string } | { error: string } {
  try {
    const filePath = generateTempFilePath(tempDir);
    const content = cliStringify(data, true);
    writeFileSync(filePath, content, "utf-8");
    return { path: filePath };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { error: message };
  }
}

/**
 * Build pagination continuation hints for truncated output.
 */
function buildPaginationHints(
  total: number,
  limit: number,
  offset: number,
  commandName?: string
): CLIHint[] {
  const hints: CLIHint[] = [];
  const nextOffset = offset + limit;

  // Only add a "next page" hint if there are more items to show
  if (nextOffset < total) {
    const remaining = total - nextOffset;
    const nextPageSize = Math.min(limit, remaining);
    const cmdPrefix = commandName ? `${commandName} ` : "";

    hints.push({
      description: `Show next ${nextPageSize} of ${remaining} remaining items`,
      command: `${cmdPrefix}--offset ${nextOffset} --limit ${limit}`,
    });
  }

  return hints;
}

/**
 * Truncate output with pagination hints and optional file pointers.
 *
 * When `limit` is not configured (undefined), output passes through untouched.
 * When data length is at or below limit, output passes through untouched.
 * When data exceeds limit, it is truncated with metadata and hints.
 *
 * For very large output (exceeding `filePointerThreshold`), the full result
 * is written to a temp file and a file pointer is included in metadata.
 * If the file write fails, truncated output is returned with a warning hint.
 *
 * @typeParam T - Type of items in the output array
 * @param data - The output data to potentially truncate
 * @param options - Truncation configuration
 * @returns Truncation result with data, metadata, and hints
 *
 * @example
 * ```typescript
 * import { truncateOutput } from "@outfitter/cli/truncation";
 *
 * // No truncation (limit not set)
 * const result1 = truncateOutput(items, {});
 * // result1.data === items, result1.metadata === undefined
 *
 * // Truncate to 20 items
 * const result2 = truncateOutput(items, { limit: 20, commandName: "list" });
 * // result2.data.length === 20
 * // result2.metadata === { showing: 20, total: 100, truncated: true }
 * // result2.hints includes pagination continuation
 *
 * // With offset (page 2)
 * const result3 = truncateOutput(items, { limit: 20, offset: 20 });
 * ```
 */
export function truncateOutput<T>(
  data: T[] | unknown,
  options: TruncationOptions
): TruncationResult<T> {
  const { limit, commandName } = options;

  // Non-array data passes through untouched
  if (!Array.isArray(data)) {
    return {
      data: data as T[],
      metadata: undefined,
      hints: [],
    };
  }

  const items = data as T[];

  // No limit configured → pass through untouched
  if (limit === undefined) {
    return {
      data: items,
      metadata: undefined,
      hints: [],
    };
  }

  const total = items.length;

  // Data at or below limit (and no offset) → pass through untouched
  if (total <= limit && (options.offset === undefined || options.offset <= 0)) {
    return {
      data: items,
      metadata: undefined,
      hints: [],
    };
  }

  // Truncation path
  const offset = Math.max(0, options.offset ?? 0);
  const sliced = items.slice(offset, offset + limit);
  const showing = sliced.length;

  // Build pagination hints
  const hints: CLIHint[] = buildPaginationHints(
    total,
    limit,
    offset,
    commandName
  );

  // File pointer for very large output
  const filePointerThreshold =
    options.filePointerThreshold ?? DEFAULT_FILE_POINTER_THRESHOLD;
  let fullOutput: string | undefined;

  if (total > filePointerThreshold) {
    // Validate custom tempDir; fall back to OS tmpdir if unsafe
    const rawTempDir = options.tempDir;
    const tempDir = rawTempDir
      ? (validateTempDir(rawTempDir) ?? tmpdir())
      : tmpdir();

    if (rawTempDir && !validateTempDir(rawTempDir)) {
      hints.push({
        description: `Warning: Unsafe tempDir "${rawTempDir}" was rejected; using OS tmpdir instead`,
        command: `${commandName ? `${commandName} ` : ""}--limit ${total}`,
      });
    }

    const writeResult = writeFullOutput(items, tempDir);

    if ("path" in writeResult) {
      fullOutput = writeResult.path;
    } else {
      // File write failed — degrade gracefully with warning hint
      hints.push({
        description: `Warning: Could not write full output to file (${writeResult.error})`,
        command: `${commandName ? `${commandName} ` : ""}--limit ${total}`,
      });
    }
  }

  const metadata: TruncationMetadata = fullOutput
    ? { showing, total, truncated: true, full_output: fullOutput }
    : { showing, total, truncated: true };

  return {
    data: sliced,
    metadata,
    hints,
  };
}
