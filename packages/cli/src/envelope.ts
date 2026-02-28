/**
 * Response envelope and handler lifecycle bridge for CLI commands.
 *
 * The envelope wraps command results in a structured format suitable for
 * both human and machine consumption:
 *
 * ```json
 * {
 *   "ok": true,
 *   "command": "deploy",
 *   "result": { "status": "deployed" },
 *   "hints": [{ "description": "Check status", "command": "deploy status" }]
 * }
 * ```
 *
 * The `runHandler()` function bridges the full command lifecycle:
 * context factory → handler invocation → Result unwrap → envelope
 * construction → output formatting → exit code mapping.
 *
 * @packageDocumentation
 */

import type {
  CLIHint,
  ErrorCategory,
  OutfitterError,
} from "@outfitter/contracts";
import { exitCodeMap } from "@outfitter/contracts";
import type { Result } from "better-result";

import { output } from "./output.js";
import type { OutputMode } from "./types.js";

// =============================================================================
// Envelope Types
// =============================================================================

/**
 * Structured success envelope wrapping a command result.
 *
 * The `hints` field is absent (not an empty array) when there are no hints.
 * This avoids Clippy-style noise in terminal output.
 */
export interface SuccessEnvelope<T = unknown> {
  readonly ok: true;
  readonly command: string;
  readonly result: T;
  readonly hints?: CLIHint[];
}

/**
 * Structured error envelope wrapping a command failure.
 *
 * The `hints` field is absent (not an empty array) when there are no hints.
 */
export interface ErrorEnvelope {
  readonly ok: false;
  readonly command: string;
  readonly error: {
    readonly category: ErrorCategory;
    readonly message: string;
  };
  readonly hints?: CLIHint[];
}

/**
 * Discriminated union of success and error envelopes.
 *
 * Use `envelope.ok` to narrow:
 * ```typescript
 * if (envelope.ok) {
 *   // SuccessEnvelope — envelope.result is available
 * } else {
 *   // ErrorEnvelope — envelope.error is available
 * }
 * ```
 */
export type CommandEnvelope<T = unknown> = SuccessEnvelope<T> | ErrorEnvelope;

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
 *
 * @param command - Command name
 * @param category - Error category from the taxonomy
 * @param message - Human-readable error message
 * @param hints - Optional CLI hints for error recovery
 * @returns An error envelope
 *
 * @example
 * ```typescript
 * const envelope = createErrorEnvelope("deploy", "validation", "Missing env", [
 *   { description: "Specify env", command: "deploy --env prod" },
 * ]);
 * ```
 */
export function createErrorEnvelope(
  command: string,
  category: ErrorCategory,
  message: string,
  hints?: CLIHint[]
): ErrorEnvelope {
  const envelope: ErrorEnvelope = {
    ok: false,
    command,
    error: { category, message },
  };

  // Only add hints if non-empty — absent, not empty array
  if (hints && hints.length > 0) {
    return { ...envelope, hints };
  }

  return envelope;
}

// =============================================================================
// RunHandler Types
// =============================================================================

/**
 * Options for the runHandler lifecycle bridge.
 *
 * @typeParam TInput - Type of validated input
 * @typeParam TOutput - Type of handler result
 * @typeParam TContext - Type of context object
 */
export interface RunHandlerOptions<
  TInput = unknown,
  TOutput = unknown,
  TContext = unknown,
> {
  /** Command name for the envelope */
  readonly command: string;

  /**
   * Handler function returning a Result.
   *
   * When a context factory is provided, receives (input, context).
   * When no context factory, receives (input, undefined).
   */
  readonly handler: (
    input: TInput,
    context: TContext
  ) => Promise<Result<TOutput, OutfitterError>>;

  /** Validated input to pass to context factory and handler */
  readonly input?: TInput;

  /** Output format (json, jsonl, human) */
  readonly format?: OutputMode;

  /**
   * Async factory for constructing handler context.
   * Called before the handler with the validated input.
   */
  readonly contextFactory?: (input: TInput) => Promise<TContext> | TContext;

  /** Success hint function — called with (result, input) */
  readonly hints?: (result: unknown, input: TInput) => CLIHint[];

  /** Error hint function — called with (error, input) */
  readonly onError?: (error: unknown, input: TInput) => CLIHint[];

  /**
   * Parsed argv to use for dry-run hint generation.
   *
   * Defaults to `process.argv.slice(2)`. Pass explicit argv when using
   * `cli.parse(customArgv)` to ensure the dry-run hint reconstructs the
   * correct command.
   */
  readonly argv?: readonly string[];
}

// =============================================================================
// Internal Helpers
// =============================================================================

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
function extractCategory(error: unknown): ErrorCategory {
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
function extractMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Get exit code for an error category.
 */
function getExitCode(category: ErrorCategory): number {
  return exitCodeMap[category] ?? DEFAULT_EXIT_CODE;
}

/**
 * Format an envelope for human-readable output.
 * Returns stdout and stderr portions separately.
 */
function formatEnvelopeHuman(envelope: CommandEnvelope): {
  stdout: string;
  stderr: string;
} {
  if (envelope.ok) {
    const parts: string[] = [];

    // Format the result
    const result = envelope.result;
    if (result !== null && result !== undefined) {
      if (typeof result === "string") {
        parts.push(result);
      } else if (typeof result === "number" || typeof result === "boolean") {
        parts.push(String(result));
      } else if (Array.isArray(result)) {
        parts.push(
          result
            .map((item) =>
              typeof item === "object" && item !== null
                ? formatObject(item as Record<string, unknown>)
                : String(item)
            )
            .join("\n")
        );
      } else if (typeof result === "object") {
        parts.push(formatObject(result as Record<string, unknown>));
      }
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
 * Simple key: value formatting for objects (matches output.ts formatHuman).
 */
function formatObject(obj: Record<string, unknown>): string {
  const lines: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      lines.push(`${key}: ${formatObject(value as Record<string, unknown>)}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: ${value.join(", ")}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  return lines.join("\n");
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Bridge the full CommandBuilder lifecycle: context factory → handler
 * invocation → Result unwrap → envelope construction → output
 * formatting → exit code mapping.
 *
 * On success:
 * - Builds a `{ ok: true, command, result, hints? }` envelope
 * - Outputs to stdout (JSON or human-readable)
 * - Returns normally (exit code 0)
 *
 * On error:
 * - Builds a `{ ok: false, command, error: { category, message }, hints? }` envelope
 * - Outputs to stderr (JSON or human-readable)
 * - Exits with mapped exit code from error taxonomy
 *
 * @example
 * ```typescript
 * command("deploy")
 *   .input(z.object({ env: z.string() }))
 *   .action(async ({ input }) => {
 *     await runHandler({
 *       command: "deploy",
 *       handler: async (input) => deployService(input),
 *       input,
 *       format: outputMode,
 *       hints: (result, input) => [
 *         { description: "Check status", command: `deploy status --env ${input.env}` },
 *       ],
 *     });
 *   });
 * ```
 */
export async function runHandler<
  TInput = unknown,
  TOutput = unknown,
  TContext = unknown,
>(options: RunHandlerOptions<TInput, TOutput, TContext>): Promise<void> {
  const {
    command: commandName,
    handler,
    input,
    format,
    contextFactory,
    hints: hintsFn,
    onError: onErrorFn,
    argv,
  } = options;

  const inputValue = input as TInput;
  const isJsonMode = format === "json" || format === "jsonl";

  // 1. Context factory (if provided)
  let context: TContext;
  if (contextFactory) {
    try {
      context = await contextFactory(inputValue);
    } catch (err) {
      // Context factory failure → error envelope → exit
      const error = err instanceof Error ? err : new Error(String(err));
      const category = extractCategory(error);
      const message = extractMessage(error);

      const errorHints = onErrorFn
        ? safeCallHintFn(() => onErrorFn(error, inputValue))
        : undefined;

      const envelope = createErrorEnvelope(
        commandName,
        category,
        message,
        errorHints
      );
      outputErrorEnvelope(envelope, isJsonMode);
      return; // unreachable — outputErrorEnvelope calls process.exit
    }
  } else {
    context = undefined as TContext;
  }

  // 2. Handler invocation
  let result: Result<TOutput, OutfitterError>;
  try {
    result = await handler(inputValue, context);
  } catch (err) {
    // Unexpected handler throw (handlers should return Result, not throw)
    const error = err instanceof Error ? err : new Error(String(err));
    const category = extractCategory(error);
    const message = extractMessage(error);

    const errorHints = onErrorFn
      ? safeCallHintFn(() => onErrorFn(error, inputValue))
      : undefined;

    const envelope = createErrorEnvelope(
      commandName,
      category,
      message,
      errorHints
    );
    outputErrorEnvelope(envelope, isJsonMode);
    return; // unreachable
  }

  // 3. Result unwrap → envelope construction
  if (result.isOk()) {
    // Success path
    const successHints = hintsFn
      ? safeCallHintFn(() => hintsFn(result.value, inputValue))
      : undefined;

    const envelope = createSuccessEnvelope(
      commandName,
      result.value,
      successHints
    );

    // 4. Output formatting
    if (isJsonMode) {
      await output(envelope, format);
    } else {
      const formatted = formatEnvelopeHuman(envelope);
      if (formatted.stdout) {
        process.stdout.write(`${formatted.stdout}\n`);
      }
    }
  } else {
    // Error path
    const error = result.error;
    const category = extractCategory(error);
    const message = extractMessage(error);

    const errorHints = onErrorFn
      ? safeCallHintFn(() => onErrorFn(error, inputValue))
      : undefined;

    const envelope = createErrorEnvelope(
      commandName,
      category,
      message,
      errorHints
    );
    outputErrorEnvelope(envelope, isJsonMode);
  }
}

/**
 * Output an error envelope and exit with mapped exit code.
 */
function outputErrorEnvelope(
  envelope: ErrorEnvelope,
  isJsonMode: boolean
): never {
  const exitCode = getExitCode(envelope.error.category);

  if (isJsonMode) {
    process.stderr.write(`${JSON.stringify(envelope)}\n`);
  } else {
    const formatted = formatEnvelopeHuman(envelope);
    if (formatted.stderr) {
      process.stderr.write(`${formatted.stderr}\n`);
    }
  }

  // eslint-disable-next-line outfitter/no-process-exit-in-packages -- terminal adapter intentionally exits after serializing errors
  process.exit(exitCode);
}

/**
 * Safely call a hint function, returning undefined if it throws.
 * Hint functions should never cause the command to fail.
 */
function safeCallHintFn(fn: () => CLIHint[]): CLIHint[] | undefined {
  try {
    const hints = fn();
    return hints.length > 0 ? hints : undefined;
  } catch {
    return undefined;
  }
}
