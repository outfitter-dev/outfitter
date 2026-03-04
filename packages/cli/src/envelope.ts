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

import type { OutfitterError } from "@outfitter/contracts";
import { safeStringify } from "@outfitter/contracts";
import type {
  ProgressCallback,
  StreamEvent,
  StreamStartEvent,
} from "@outfitter/contracts/stream";
import type { Result } from "better-result";

import {
  buildDryRunHint,
  createErrorEnvelope,
  createSuccessEnvelope,
  extractCategory,
  extractMessage,
  extractRetryAfterSeconds,
  formatEnvelopeHuman,
  getExitCode,
  safeCallHintFn,
} from "./internal/envelope-helpers.js";
import type { RunHandlerOptions } from "./internal/envelope-types.js";
import { detectMode, output } from "./output.js";
import {
  createNdjsonProgress,
  writeNdjsonLine,
  writeStreamEnvelope,
} from "./streaming.js";

// Re-export types from internal modules
export type {
  CommandEnvelope,
  ErrorEnvelope,
  RunHandlerOptions,
  SuccessEnvelope,
} from "./internal/envelope-types.js";

// Re-export envelope construction functions
export {
  createErrorEnvelope,
  createSuccessEnvelope,
} from "./internal/envelope-helpers.js";

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
    stream: isStreaming = false,
    dryRun: isDryRun = false,
  } = options;

  const inputValue = input as TInput;

  // Resolve output mode: explicit format > env vars > default (human).
  // When format is omitted, check OUTFITTER_JSON/OUTFITTER_JSONL env vars
  // consistent with output.ts detectMode() conventions.
  const resolvedFormat = format ?? detectMode();
  const isJsonMode = resolvedFormat === "json" || resolvedFormat === "jsonl";

  // Stream mode: emit start event as the first NDJSON line
  let progressCallback: ProgressCallback | undefined;
  if (isStreaming) {
    const startEvent: StreamStartEvent = {
      type: "start",
      command: commandName,
      ts: new Date().toISOString(),
    };
    writeNdjsonLine(startEvent);
    const writeProgress = createNdjsonProgress(commandName);
    progressCallback = (event: StreamEvent): void => {
      // The adapter emits the first start event; ignore duplicate handler starts.
      if (event.type === "start") {
        return;
      }
      writeProgress(event);
    };
  }

  // 1. Context factory (if provided)
  let context: TContext;
  if (contextFactory) {
    try {
      const rawContext = await contextFactory(inputValue);
      // Inject progress callback into context when streaming is active
      if (isStreaming && rawContext && typeof rawContext === "object") {
        context = Object.assign(
          Object.create(Object.getPrototypeOf(rawContext)),
          rawContext,
          { progress: progressCallback }
        ) as TContext;
      } else {
        context = rawContext;
      }
    } catch (err) {
      // Context factory failure → error envelope → exit
      const error = err instanceof Error ? err : new Error(String(err));
      const category = extractCategory(error);
      const message = extractMessage(error);
      const retryAfter = extractRetryAfterSeconds(error);

      const errorHints = onErrorFn
        ? safeCallHintFn(() => onErrorFn(error, inputValue))
        : undefined;

      const envelope = createErrorEnvelope(
        commandName,
        category,
        message,
        errorHints,
        retryAfter
      );

      if (isStreaming) {
        // In stream mode, write error envelope to stdout as NDJSON and exit
        writeStreamEnvelope(envelope);
        const exitCode = getExitCode(category);
        // eslint-disable-next-line outfitter/no-process-exit-in-packages -- terminal adapter intentionally exits after serializing errors
        process.exit(exitCode);
      }

      outputErrorEnvelope(envelope, isJsonMode);
      return; // unreachable — outputErrorEnvelope calls process.exit
    }
  } else if (isStreaming) {
    // No context factory, but streaming is active — create a minimal context with progress
    context = { progress: progressCallback } as TContext;
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
    const retryAfter = extractRetryAfterSeconds(error);

    const errorHints = onErrorFn
      ? safeCallHintFn(() => onErrorFn(error, inputValue))
      : undefined;

    const envelope = createErrorEnvelope(
      commandName,
      category,
      message,
      errorHints,
      retryAfter
    );

    if (isStreaming) {
      writeStreamEnvelope(envelope);
      const exitCode = getExitCode(category);
      // eslint-disable-next-line outfitter/no-process-exit-in-packages -- terminal adapter intentionally exits after serializing errors
      process.exit(exitCode);
    }

    outputErrorEnvelope(envelope, isJsonMode);
    return; // unreachable
  }

  // 3. Result unwrap → envelope construction
  if (result.isOk()) {
    // Success path
    let successHints = hintsFn
      ? safeCallHintFn(() => hintsFn(result.value, inputValue))
      : undefined;

    // Append dry-run hint when in dry-run mode (preview-then-commit pattern)
    if (isDryRun) {
      const dryRunHint = buildDryRunHint(options.argv);
      if (dryRunHint) {
        successHints = successHints
          ? [...successHints, dryRunHint]
          : [dryRunHint];
      }
    }

    const envelope = createSuccessEnvelope(
      commandName,
      result.value,
      successHints
    );

    if (isStreaming) {
      // Stream mode: write terminal envelope as the last NDJSON line
      writeStreamEnvelope(envelope);
      return;
    }

    // 4. Output formatting (non-stream path)
    if (isJsonMode) {
      await output(envelope, resolvedFormat);
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
    const retryAfter = extractRetryAfterSeconds(error);

    const errorHints = onErrorFn
      ? safeCallHintFn(() => onErrorFn(error, inputValue))
      : undefined;

    const envelope = createErrorEnvelope(
      commandName,
      category,
      message,
      errorHints,
      retryAfter
    );

    if (isStreaming) {
      writeStreamEnvelope(envelope);
      const exitCode = getExitCode(category);
      // eslint-disable-next-line outfitter/no-process-exit-in-packages -- terminal adapter intentionally exits after serializing errors
      process.exit(exitCode);
    }

    outputErrorEnvelope(envelope, isJsonMode);
  }
}

// =============================================================================
// Internal (file-scoped)
// =============================================================================

/**
 * Output an error envelope and exit with mapped exit code.
 */
function outputErrorEnvelope(
  envelope: import("./internal/envelope-types.js").ErrorEnvelope,
  isJsonMode: boolean
): never {
  const exitCode = getExitCode(envelope.error.category);

  if (isJsonMode) {
    process.stderr.write(`${safeStringify(envelope)}\n`);
  } else {
    const formatted = formatEnvelopeHuman(envelope);
    if (formatted.stderr) {
      process.stderr.write(`${formatted.stderr}\n`);
    }
  }

  // eslint-disable-next-line outfitter/no-process-exit-in-packages -- terminal adapter intentionally exits after serializing errors
  process.exit(exitCode);
}
