/**
 * Output utilities for CLI commands.
 *
 * @packageDocumentation
 */

import { getEnvironment, getEnvironmentDefaults } from "@outfitter/config";
import type { ErrorCategory } from "@outfitter/contracts";
import {
  safeStringify as contractsSafeStringify,
  exitCodeMap,
} from "@outfitter/contracts";

import type { OutputMode, OutputOptions } from "./types.js";

// =============================================================================
// Exit Code Handling
// =============================================================================

/**
 * Default exit code for unknown error categories.
 */
const DEFAULT_EXIT_CODE = 1;

/**
 * Writes to a stream with proper backpressure handling.
 * Returns a promise that resolves when the write is complete.
 */
function writeWithBackpressure(
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

// =============================================================================
// Internal Utilities
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
  const envJsonl = process.env["OUTFITTER_JSONL"];
  const envJson = process.env["OUTFITTER_JSON"];
  if (envJsonl === "1") return "jsonl";
  if (envJson === "1") return "json";
  if (envJsonl === "0" || envJson === "0") return "human";

  // Default: always human. Use --json or OUTFITTER_JSON=1 for machine output.
  return "human";
}

/**
 * Type guard for valid error categories.
 */
function isValidCategory(category: string): category is ErrorCategory {
  return category in exitCodeMap;
}

/**
 * Safe JSON stringify that handles circular references and undefined values.
 * Wraps contracts' safeStringify with undefined → null conversion for CLI JSON output.
 */
export function cliStringify(value: unknown, pretty?: boolean): string {
  // Use contracts' safeStringify which handles BigInt and circular references
  // We wrap the value to convert undefined to null for CLI JSON compatibility
  const wrappedValue = value === undefined ? null : value;
  return contractsSafeStringify(wrappedValue, pretty ? 2 : undefined);
}

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
 * Gets the exit code for an error based on its category.
 * Uses exitCodeMap from @outfitter/contracts for known categories.
 */
function getExitCode(error: Error): number {
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
function serializeErrorToJson(error: Error): string {
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
function formatErrorHuman(error: Error): string {
  const { _tag } = getErrorProperties(error);

  if (_tag) {
    return `${_tag}: ${error.message}`;
  }

  return error.message;
}

function applyOutputTruncation(
  data: unknown,
  truncation: OutputOptions["truncation"]
): unknown {
  if (!truncation || !Array.isArray(data)) {
    return data;
  }

  const offset = Math.max(0, truncation.offset ?? 0);
  const limit = Math.max(0, truncation.limit);
  return data.slice(offset, offset + limit);
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Output data to the console with automatic mode selection.
 *
 * Respects --json, --jsonl, --tree, --table flags automatically.
 * Defaults to human-friendly output when no flags are present.
 *
 * Detection hierarchy (highest wins):
 * 1. Explicit `format` parameter
 * 2. Environment variables (`OUTFITTER_JSON`, `OUTFITTER_JSONL`)
 * 3. Default: `"human"`
 *
 * @param data - The data to output
 * @param format - Explicit output format (e.g. from a resolved CLI flag)
 * @param options - Output configuration options
 *
 * @example
 * ```typescript
 * import { output } from "@outfitter/cli";
 *
 * // Basic usage - mode auto-detected from env
 * output(results);
 *
 * // Explicit format from resolved flag
 * output(results, "json");
 *
 * // Pretty-print JSON
 * output(results, "json", { pretty: true });
 *
 * // Output to stderr
 * output(errors, undefined, { stream: process.stderr });
 *
 * // Await for large outputs (recommended)
 * await output(largeDataset, "jsonl");
 * ```
 */
export async function output(
  data: unknown,
  format?: OutputMode,
  options?: OutputOptions
): Promise<void> {
  const mode = detectMode(format);
  const stream = options?.stream ?? process.stdout;
  const renderedData = applyOutputTruncation(data, options?.truncation);

  let outputText: string;

  switch (mode) {
    case "json": {
      // Handle undefined/null explicitly
      const jsonData = renderedData === undefined ? null : renderedData;
      outputText = cliStringify(jsonData, options?.pretty);
      break;
    }

    case "jsonl": {
      // Arrays get one JSON object per line
      if (Array.isArray(renderedData)) {
        if (renderedData.length === 0) {
          outputText = "";
        } else {
          outputText = data.map((item) => cliStringify(item)).join("\n");
        }
      } else {
        // Single objects get single JSON line
        outputText = cliStringify(data);
      }
      break;
    }

    default: {
      outputText = formatHuman(renderedData);
      break;
    }
  }

  // Only write if there's content (with backpressure handling)
  if (outputText) {
    await writeWithBackpressure(stream, `${outputText}\n`);
  }
}

/**
 * Exit the process with an error message.
 *
 * Formats the error according to the current output mode (human or JSON)
 * and exits with an appropriate exit code.
 *
 * @param error - The error to display
 * @param format - Explicit output format (e.g. from a resolved CLI flag)
 * @returns Never returns (exits the process)
 *
 * @example
 * ```typescript
 * import { exitWithError } from "@outfitter/cli";
 *
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   exitWithError(error instanceof Error ? error : new Error(String(error)));
 * }
 * ```
 */
export function exitWithError(error: Error, format?: OutputMode): never {
  const exitCode = getExitCode(error);
  const mode = detectMode(format);
  const isJsonMode = mode === "json" || mode === "jsonl";

  if (isJsonMode) {
    // JSON mode: serialize to stderr
    process.stderr.write(`${serializeErrorToJson(error)}\n`);
  } else {
    // Human mode: formatted output to stderr
    process.stderr.write(`${formatErrorHuman(error)}\n`);
  }

  // eslint-disable-next-line outfitter/no-process-exit-in-packages -- terminal adapter intentionally exits after serializing errors
  process.exit(exitCode);
}

// =============================================================================
// Environment-Aware Verbose Resolution
// =============================================================================

/**
 * Resolve verbose mode from environment configuration.
 *
 * Precedence (highest wins):
 * 1. `OUTFITTER_VERBOSE` environment variable (`"1"` or `"0"`)
 * 2. Explicit `verbose` parameter (from CLI flag)
 * 3. `OUTFITTER_ENV` environment profile defaults
 * 4. `false` (default)
 *
 * @param verbose - Optional explicit verbose flag (e.g. from --verbose CLI flag)
 * @returns Whether verbose mode is enabled
 *
 * @example
 * ```typescript
 * import { resolveVerbose } from "@outfitter/cli/output";
 *
 * // Auto-resolve from environment
 * const isVerbose = resolveVerbose();
 *
 * // With OUTFITTER_ENV=development → true
 * // With OUTFITTER_VERBOSE=0 → false (overrides everything)
 * // With nothing set → false
 *
 * // From CLI flag
 * const isVerbose = resolveVerbose(cliFlags.verbose);
 * ```
 */
export function resolveVerbose(verbose?: boolean): boolean {
  // 1. OUTFITTER_VERBOSE env var (highest precedence)
  const envVerbose = process.env["OUTFITTER_VERBOSE"];
  if (envVerbose === "1") return true;
  if (envVerbose === "0") return false;

  // 2. Explicit parameter
  if (verbose !== undefined) {
    return verbose;
  }

  // 3. Environment profile
  const env = getEnvironment();
  const defaults = getEnvironmentDefaults(env);
  return defaults.verbose;
}
