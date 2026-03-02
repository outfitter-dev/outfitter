/**
 * NDJSON streaming adapter for CLI commands.
 *
 * Writes streaming progress events as newline-delimited JSON (NDJSON) to stdout.
 * Each line is a self-contained JSON object with a `type` discriminator.
 *
 * Event ordering:
 * 1. `start` event (emitted automatically by the adapter)
 * 2. `step` / `progress` events (emitted by the handler via `ctx.progress`)
 * 3. Terminal envelope (success or error) — always the last line
 *
 * The adapter is a separate module for modularity (VAL-STREAM-008) and
 * integrates with `runHandler()` in `envelope.ts` when `--stream` is active.
 *
 * @packageDocumentation
 */

import type { ProgressCallback, StreamEvent } from "@outfitter/contracts";

import type { CommandEnvelope } from "./envelope.js";
import { cliStringify } from "./output.js";

// =============================================================================
// Types
// =============================================================================

/**
 * A single line of NDJSON stream output.
 *
 * Can be a stream event (start, step, progress) or a terminal envelope.
 */
export type StreamLine = StreamEvent | CommandEnvelope;

// =============================================================================
// Low-level Writers
// =============================================================================

/**
 * Write a single NDJSON line to stdout.
 *
 * The data is serialized as compact JSON followed by a newline character.
 * Writes synchronously to stdout to maintain event ordering.
 *
 * @param data - Any JSON-serializable value to write as a single NDJSON line
 */
export function writeNdjsonLine(data: unknown): void {
  process.stdout.write(`${cliStringify(data)}\n`);
}

/**
 * Write a terminal envelope as the final NDJSON line to stdout.
 *
 * In stream mode, both success and error envelopes are written to stdout
 * (not stderr) so the entire NDJSON stream is on a single file descriptor.
 *
 * @param envelope - The terminal command envelope (success or error)
 */
export function writeStreamEnvelope(envelope: CommandEnvelope): void {
  writeNdjsonLine(envelope);
}

// =============================================================================
// Progress Callback Factory
// =============================================================================

/**
 * Create a `ProgressCallback` that writes NDJSON lines to stdout.
 *
 * The callback is provided to handlers via `ctx.progress` when streaming
 * is active. Each call to the returned function writes one NDJSON line.
 *
 * @param _commandName - Command name (reserved for future use in adapter context)
 * @returns A `ProgressCallback` that writes stream events as NDJSON
 *
 * @example
 * ```typescript
 * const progress = createNdjsonProgress("deploy");
 * progress({ type: "start", command: "deploy", ts: new Date().toISOString() });
 * progress({ type: "progress", current: 1, total: 10 });
 * ```
 */
export function createNdjsonProgress(_commandName: string): ProgressCallback {
  return (event: StreamEvent): void => {
    writeNdjsonLine(event);
  };
}
