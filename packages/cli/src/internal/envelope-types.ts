/**
 * Envelope type definitions and RunHandler options.
 *
 * @internal
 */

import type {
  CLIHint,
  ErrorCategory,
  OutfitterError,
} from "@outfitter/contracts";
import type { Result } from "better-result";

import type { OutputMode } from "../types.js";

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
 * The `retryable` field indicates whether the error is transient and safe to retry.
 * The `retry_after` field is only present for rate_limit errors with a known delay.
 */
export interface ErrorEnvelope {
  readonly ok: false;
  readonly command: string;
  readonly error: {
    readonly category: ErrorCategory;
    readonly message: string;
    readonly retryable: boolean;
    readonly retry_after?: number;
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
   * Enable NDJSON streaming mode.
   *
   * When `true`, the handler receives a `progress` callback via context
   * and the CLI writes progress events as NDJSON lines to stdout.
   * The final line is the standard command envelope (success or error).
   * The CLI owns the initial `start` event, so handlers should emit only
   * `step` and `progress` events through `ctx.progress`.
   *
   * `--stream` is orthogonal to output mode — it controls delivery, not serialization.
   */
  readonly stream?: boolean;

  /**
   * Indicate that this is a dry-run invocation of a destructive command.
   *
   * When `true`, the success envelope includes a CLIHint with the command
   * to execute without `--dry-run` (preview-then-commit pattern).
   *
   * The handler is responsible for checking the dry-run flag and performing
   * preview-only logic. This option only controls hint generation in the envelope.
   */
  readonly dryRun?: boolean;

  /**
   * Parsed argv to use for dry-run hint generation.
   *
   * Defaults to `process.argv.slice(2)`. Pass explicit argv when using
   * `cli.parse(customArgv)` to ensure the dry-run hint reconstructs the
   * correct command.
   */
  readonly argv?: readonly string[];
}
