import type { Result } from "better-result";
import type { OutfitterError } from "./errors.js";
import type { Logger } from "./logging.js";

/**
 * Re-export logger contract so existing imports from handler remain valid.
 */
export type { Logger } from "./logging.js";

/**
 * Resolved configuration interface.
 * Implementations provided by @outfitter/config.
 */
export interface ResolvedConfig {
  get<T>(key: string): T | undefined;
  getRequired<T>(key: string): T;
}

/**
 * Handler context - provides cross-cutting concerns without polluting handler signatures.
 *
 * @example
 * ```typescript
 * const handler: Handler<Input, Output, NotFoundError> = async (input, ctx) => {
 *   ctx.logger.debug("Processing request", { requestId: ctx.requestId });
 *   // ... handler logic
 * };
 * ```
 */
export interface HandlerContext {
  /** Abort signal for cancellation propagation */
  signal?: AbortSignal;

  /** Unique request identifier for tracing (UUIDv7) */
  requestId: string;

  /** Structured logger with automatic redaction */
  logger: Logger;

  /** Resolved configuration values */
  config?: ResolvedConfig;

  /** Workspace root path, if detected */
  workspaceRoot?: string;

  /** Current working directory */
  cwd: string;

  /** Environment variables (filtered, redacted) */
  env: Record<string, string | undefined>;
}

/**
 * Handler - transport-agnostic domain logic unit.
 *
 * Handlers receive typed input, return Results, and know nothing about
 * transport or output format. CLI and MCP are thin adapters over handlers.
 *
 * @typeParam TInput - Validated input parameters
 * @typeParam TOutput - Success return type
 * @typeParam TError - Error type (must extend OutfitterError)
 *
 * @example
 * ```typescript
 * const getNote: Handler<{ id: string }, Note, NotFoundError> = async (input, ctx) => {
 *   const note = await ctx.db.notes.find(input.id);
 *   if (!note) return Result.err(new NotFoundError("note", input.id));
 *   return Result.ok(note);
 * };
 * ```
 */
export type Handler<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
> = (input: TInput, ctx: HandlerContext) => Promise<Result<TOutput, TError>>;

/**
 * Synchronous handler variant for operations that don't need async.
 */
export type SyncHandler<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
> = (input: TInput, ctx: HandlerContext) => Result<TOutput, TError>;
