/**
 * Transport-agnostic streaming types for handler progress reporting.
 *
 * {@link StreamEvent} is a discriminated union of events that handlers emit
 * via {@link ProgressCallback} to report progress. Transport adapters (CLI NDJSON,
 * MCP notifications) consume these events without the handler knowing the transport.
 *
 * - {@link StreamStartEvent} — Emitted once at the beginning of a streaming operation
 * - {@link StreamStepEvent} — Emitted when a named phase completes
 * - {@link StreamProgressEvent} — Emitted for incremental progress updates
 *
 * @packageDocumentation
 */

/**
 * Emitted once at the beginning of a streaming operation.
 *
 * @example
 * ```typescript
 * ctx.progress?.({
 *   type: "start",
 *   command: "check tsdoc",
 *   ts: new Date().toISOString(),
 * });
 * ```
 */
export interface StreamStartEvent {
  /** Discriminator — always `"start"`. */
  type: "start";

  /** The command or operation being executed. */
  command: string;

  /** ISO-8601 timestamp of when the operation started. */
  ts: string;
}

/**
 * Emitted when a named phase or step completes.
 *
 * @example
 * ```typescript
 * ctx.progress?.({
 *   type: "step",
 *   name: "scanning files",
 *   status: "complete",
 *   duration_ms: 42,
 * });
 * ```
 */
export interface StreamStepEvent {
  /** Discriminator — always `"step"`. */
  type: "step";

  /** Name of the phase or step. */
  name: string;

  /** Status of the step (e.g., `"running"`, `"complete"`, `"failed"`). */
  status: string;

  /** Optional duration of the step in milliseconds. */
  duration_ms?: number;
}

/**
 * Emitted for incremental progress updates (e.g., processing N of M items).
 *
 * @example
 * ```typescript
 * ctx.progress?.({
 *   type: "progress",
 *   current: 5,
 *   total: 10,
 *   message: "Processing file 5 of 10",
 * });
 * ```
 */
export interface StreamProgressEvent {
  /** Discriminator — always `"progress"`. */
  type: "progress";

  /** Current progress count. */
  current: number;

  /** Total expected count. */
  total: number;

  /** Optional human-readable progress message. */
  message?: string;
}

/**
 * Discriminated union of all stream event types.
 *
 * Handlers emit these events via `ctx.progress?.()` to report progress
 * without coupling to any specific transport. The `type` field serves
 * as the discriminator for narrowing.
 *
 * @example
 * ```typescript
 * function handleEvent(event: StreamEvent) {
 *   switch (event.type) {
 *     case "start":
 *       console.log(`Starting: ${event.command}`);
 *       break;
 *     case "step":
 *       console.log(`Step: ${event.name} — ${event.status}`);
 *       break;
 *     case "progress":
 *       console.log(`${event.current}/${event.total}`);
 *       break;
 *   }
 * }
 * ```
 */
export type StreamEvent =
  | StreamStartEvent
  | StreamStepEvent
  | StreamProgressEvent;

/**
 * Callback type for reporting streaming progress events.
 *
 * Transport adapters provide this callback to handlers via `ctx.progress`.
 * When `progress` is `undefined` on {@link HandlerContext}, the handler
 * does not stream — it simply returns its final result.
 *
 * @example
 * ```typescript
 * const progress: ProgressCallback = (event) => {
 *   process.stdout.write(JSON.stringify(event) + "\n");
 * };
 * ```
 */
export type ProgressCallback = (event: StreamEvent) => void;
