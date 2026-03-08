/* eslint-disable outfitter/max-file-lines -- Envelope hint and metadata helpers are easier to audit together. */
/**
 * Envelope construction and internal helper functions.
 *
 * @internal
 */

import type { CLIHint, ErrorCategory } from "@outfitter/contracts";
import { errorCategoryMeta, exitCodeMap } from "@outfitter/contracts";

import type {
  CommandEnvelope,
  ErrorEnvelope,
  SuccessEnvelope,
} from "./envelope-types.js";
import { formatHuman } from "./output-formatting.js";

// =============================================================================
// Envelope Construction
// =============================================================================

/**
 * Create a success envelope wrapping a command result.
 *
 * The `hints` field is omitted when hints is undefined, null, or empty.
 *
 * @param command - Command name
 * @param result - Handler result value
 * @param hints - Optional CLI hints for next actions
 * @returns A success envelope
 *
 * @example
 * ```typescript
 * const envelope = createSuccessEnvelope("deploy", { status: "deployed" }, [
 *   { description: "Check status", command: "deploy status" },
 * ]);
 * ```
 */
export function createSuccessEnvelope<T>(
  command: string,
  result: T,
  hints?: CLIHint[]
): SuccessEnvelope<T> {
  const envelope: SuccessEnvelope<T> = {
    ok: true,
    command,
    result,
  };

  // Only add hints if non-empty — absent, not empty array
  if (hints && hints.length > 0) {
    return { ...envelope, hints };
  }

  return envelope;
}

/**
 * Create an error envelope wrapping a command failure.
 *
 * The `hints` field is omitted when hints is undefined, null, or empty.
 * The `retryable` field is derived from the error category metadata.
 * The `retry_after` field is included only when `retryAfterSeconds` is provided
 * (typically from a `RateLimitError`).
 *
 * @param command - Command name
 * @param category - Error category from the taxonomy
 * @param message - Human-readable error message
 * @param hints - Optional CLI hints for error recovery
 * @param retryAfterSeconds - Optional retry delay in seconds (from RateLimitError)
 * @returns An error envelope
 *
 * @example
 * ```typescript
 * const envelope = createErrorEnvelope("deploy", "validation", "Missing env", [
 *   { description: "Specify env", command: "deploy --env prod" },
 * ]);
 * // envelope.error.retryable === false
 *
 * const rateLimitEnvelope = createErrorEnvelope(
 *   "fetch",
 *   "rate_limit",
 *   "Too many requests",
 *   undefined,
 *   60
 * );
 * // rateLimitEnvelope.error.retryable === true, retry_after === 60
 * ```
 */
export function createErrorEnvelope(
  command: string,
  category: ErrorCategory,
  message: string,
  hints?: CLIHint[],
  retryAfterSeconds?: number
): ErrorEnvelope {
  const meta = errorCategoryMeta(category);

  // Defense-in-depth: only include retry_after for rate_limit errors,
  // even if retryAfterSeconds is somehow provided for other categories
  const includeRetryAfter =
    retryAfterSeconds != null && category === "rate_limit";

  const errorField: ErrorEnvelope["error"] = includeRetryAfter
    ? {
        category,
        message,
        retryable: meta.retryable,
        retry_after: retryAfterSeconds,
      }
    : { category, message, retryable: meta.retryable };

  const envelope: ErrorEnvelope = {
    ok: false,
    command,
    error: errorField,
  };

  // Only add hints if non-empty — absent, not empty array
  if (hints && hints.length > 0) {
    return { ...envelope, hints };
  }

  return envelope;
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Build a CLIHint for executing the current command without --dry-run.
 *
 * Strips the --dry-run flag and its variants (--dry-run=true, --dry-run=false, etc.),
 * producing a hint like: `delete --id abc --force` (without --dry-run).
 *
 * @param argv - Parsed argv to strip --dry-run from. Defaults to `process.argv.slice(2)`.
 */
export function buildDryRunHint(
  argv: readonly string[] = process.argv.slice(2)
): CLIHint | undefined {
  const filteredArgs = argv.filter(
    (arg) => arg !== "--dry-run" && !arg.startsWith("--dry-run=")
  );
  const command = filteredArgs.join(" ");
  if (!command) return undefined;
  return {
    description: "Execute without dry-run",
    command,
  };
}

/**
 * Default error category for errors that aren't OutfitterError.
 */
const DEFAULT_CATEGORY: ErrorCategory = "internal";

/**
 * Default exit code for unknown categories.
 */
const DEFAULT_EXIT_CODE = 1;

/**
 * Extract error category from an error object.
 * Works with OutfitterError instances and duck-typed errors.
 */
export function extractCategory(error: unknown): ErrorCategory {
  if (
    error !== null &&
    typeof error === "object" &&
    "category" in error &&
    typeof (error as Record<string, unknown>)["category"] === "string"
  ) {
    const cat = (error as Record<string, unknown>)["category"] as string;
    if (cat in exitCodeMap) {
      return cat as ErrorCategory;
    }
  }
  return DEFAULT_CATEGORY;
}

/**
 * Extract error message from an error object.
 */
export function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Extract retryAfterSeconds from an error object (if present).
 * Works with RateLimitError instances and duck-typed errors.
 */
export function extractRetryAfterSeconds(error: unknown): number | undefined {
  if (
    error !== null &&
    typeof error === "object" &&
    "retryAfterSeconds" in error &&
    typeof (error as Record<string, unknown>)["retryAfterSeconds"] === "number"
  ) {
    return (error as Record<string, unknown>)["retryAfterSeconds"] as number;
  }
  return undefined;
}

/**
 * Get exit code for an error category.
 */
export function getExitCode(category: ErrorCategory): number {
  return exitCodeMap[category] ?? DEFAULT_EXIT_CODE;
}

/**
 * Format an envelope for human-readable output.
 * Returns stdout and stderr portions separately.
 */
export function formatEnvelopeHuman(envelope: CommandEnvelope): {
  stdout: string;
  stderr: string;
} {
  if (envelope.ok) {
    const parts: string[] = [];

    // Format the result
    const formatted = formatHuman(envelope.result);
    if (formatted) {
      parts.push(formatted);
    }

    // Format hints as suggestions
    if (envelope.hints && envelope.hints.length > 0) {
      parts.push("");
      parts.push("Hints:");
      for (const hint of envelope.hints) {
        parts.push(`  ${hint.description}`);
        if (hint.command) {
          parts.push(`    $ ${hint.command}`);
        }
      }
    }

    return { stdout: parts.join("\n"), stderr: "" };
  }

  // Error path
  const parts: string[] = [];
  parts.push(`Error: ${envelope.error.message}`);

  // Format hints as suggestions
  if (envelope.hints && envelope.hints.length > 0) {
    parts.push("");
    parts.push("Hints:");
    for (const hint of envelope.hints) {
      parts.push(`  ${hint.description}`);
      if (hint.command) {
        parts.push(`    $ ${hint.command}`);
      }
    }
  }

  return { stdout: "", stderr: parts.join("\n") };
}

/**
 * Safely call a hint function, returning undefined if it throws.
 * Hint functions should never cause the command to fail.
 */
export function safeCallHintFn(fn: () => CLIHint[]): CLIHint[] | undefined {
  try {
    const hints = fn();
    return hints.length > 0 ? hints : undefined;
  } catch {
    return undefined;
  }
}
