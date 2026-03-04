/**
 * Output formatting utilities for CLI commands.
 *
 * Handles mode detection, human/JSON/JSONL formatting, error serialization,
 * and output truncation.
 *
 * @internal
 */

import type { ErrorCategory } from "@outfitter/contracts";
import {
  safeStringify as contractsSafeStringify,
  exitCodeMap,
} from "@outfitter/contracts";

import type { OutputMode, OutputOptions } from "../types.js";

// =============================================================================
// Exit Code Handling
// =============================================================================

/**
 * Default exit code for unknown error categories.
 */
const DEFAULT_EXIT_CODE = 1;

// =============================================================================
// Mode Detection
// =============================================================================

/**
 * Detects output mode based on explicit format, environment, and options.
 *
 * Priority: explicit format > env var > default (human)
 *
 * Per CLI conventions (clig.dev), human output is the default.
 * Machine-readable output requires explicit opt-in via --json flag
 * or OUTFITTER_JSON=1 environment variable.
 */
export function detectMode(format?: OutputMode): OutputMode {
  // Explicit format takes highest priority
  if (format) {
    return format;
  }

  // Check environment variables (JSONL takes priority over JSON)
  // eslint-disable-next-line outfitter/no-process-env-in-packages -- boundary: runtime env read
  const envJsonl = process.env["OUTFITTER_JSONL"];
  // eslint-disable-next-line outfitter/no-process-env-in-packages -- boundary: runtime env read
  const envJson = process.env["OUTFITTER_JSON"];
  if (envJsonl === "1") return "jsonl";
  if (envJson === "1") return "json";
  if (envJsonl === "0" || envJson === "0") return "human";

  // Default: always human. Use --json or OUTFITTER_JSON=1 for machine output.
  return "human";
}

// =============================================================================
// JSON Utilities
// =============================================================================

/**
 * Safe JSON stringify that handles circular references and undefined values.
 * Wraps contracts' safeStringify with undefined -> null conversion for CLI JSON output.
 */
export function cliStringify(value: unknown, pretty?: boolean): string {
  // Use contracts' safeStringify which handles BigInt and circular references
  // We wrap the value to convert undefined to null for CLI JSON compatibility
  const wrappedValue = value === undefined ? null : value;
  return contractsSafeStringify(wrappedValue, pretty ? 2 : undefined);
}

// =============================================================================
// Human Formatting
// =============================================================================

/**
 * Formats data for human-readable output.
 */
export function formatHuman(data: unknown): string {
  if (data === null || data === undefined) {
    return "";
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return String(data);
  }

  if (Array.isArray(data)) {
    return data.map((item) => formatHuman(item)).join("\n");
  }

  if (typeof data === "object") {
    // Simple key: value formatting for objects
    const lines: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      lines.push(`${key}: ${formatHuman(value)}`);
    }
    return lines.join("\n");
  }

  return String(data);
}

// =============================================================================
// Error Formatting
// =============================================================================

/**
 * Extracts OutfitterError-compatible properties from an error.
 * Works with both actual OutfitterError instances and duck-typed errors.
 */
interface KitErrorLike {
  _tag: string | undefined;
  category: string | undefined;
  context: Record<string, unknown> | undefined;
}

function getErrorProperties(error: Error): KitErrorLike {
  const errorObj = error as Error & {
    _tag?: string;
    category?: string;
    context?: Record<string, unknown>;
  };
  return {
    _tag: errorObj._tag,
    category: errorObj.category,
    context: errorObj.context,
  };
}

/**
 * Type guard for valid error categories.
 */
function isValidCategory(category: string): category is ErrorCategory {
  return category in exitCodeMap;
}

/**
 * Gets the exit code for an error based on its category.
 * Uses exitCodeMap from @outfitter/contracts for known categories.
 */
export function getExitCode(error: Error): number {
  const { category } = getErrorProperties(error);

  if (category !== undefined && isValidCategory(category)) {
    return exitCodeMap[category];
  }

  return DEFAULT_EXIT_CODE;
}

/**
 * Serializable error structure for JSON output.
 */
interface SerializedCliError {
  _tag?: string;
  category?: string;
  context?: Record<string, unknown>;
  message: string;
}

/**
 * Serializes an error to JSON format for CLI output.
 * Handles both OutfitterError instances and plain Error objects.
 */
export function serializeErrorToJson(error: Error): string {
  const { _tag, category, context } = getErrorProperties(error);

  const result: SerializedCliError = {
    message: error.message,
  };

  if (_tag !== undefined) {
    result._tag = _tag;
  }

  if (category !== undefined) {
    result.category = category;
  }

  if (context !== undefined) {
    result.context = context;
  }

  return JSON.stringify(result);
}

/**
 * Formats an error for human-readable output.
 */
export function formatErrorHuman(error: Error): string {
  const { _tag } = getErrorProperties(error);

  if (_tag) {
    return `${_tag}: ${error.message}`;
  }

  return error.message;
}

// =============================================================================
// Truncation
// =============================================================================

type OutputSliceTruncation = Pick<
  NonNullable<OutputOptions["truncation"]>,
  "limit" | "offset"
>;

/**
 * Applies array truncation (limit/offset) to output data.
 */
export function applyOutputTruncation(
  data: unknown,
  truncation: OutputSliceTruncation | undefined
): unknown {
  if (!truncation || !Array.isArray(data)) {
    return data;
  }

  const rawOffset = truncation.offset;
  const offset =
    typeof rawOffset === "number" && Number.isFinite(rawOffset)
      ? Math.max(0, rawOffset)
      : 0;

  const rawLimit = truncation.limit;
  if (typeof rawLimit !== "number" || !Number.isFinite(rawLimit)) {
    return data;
  }

  const limit = Math.max(0, rawLimit);
  return data.slice(offset, offset + limit);
}

// =============================================================================
// Backpressure-Aware Write
// =============================================================================

/**
 * Writes to a stream with proper backpressure handling.
 * Returns a promise that resolves when the write is complete.
 */
export function writeWithBackpressure(
  stream: NodeJS.WritableStream,
  data: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const canContinue = stream.write(data, (error) => {
      if (error) reject(error);
    });

    if (canContinue) {
      resolve();
    } else {
      // Backpressure: wait for drain before resolving
      stream.once("drain", () => resolve());
      stream.once("error", reject);
    }
  });
}
