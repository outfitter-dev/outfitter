import type { HandlerContext, Logger, ResolvedConfig } from "./handler.js";

/**
 * Options for creating a handler context.
 */
export interface CreateContextOptions {
  /** Logger instance (uses no-op logger if not provided) */
  logger?: Logger;

  /** Resolved configuration */
  config?: ResolvedConfig;

  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Explicit request ID (generates UUIDv7 if not provided) */
  requestId?: string;

  /** Workspace root path */
  workspaceRoot?: string;

  /** Current working directory (defaults to process.cwd()) */
  cwd?: string;

  /** Environment variables to include */
  env?: Record<string, string | undefined>;
}

/**
 * No-op logger for when no logger is provided.
 * Returns itself for child() to maintain the no-op behavior.
 */
const noopLogger: Logger = {
  trace: () => {
    // silent no-op
  },
  debug: () => {
    // silent no-op
  },
  info: () => {
    // silent no-op
  },
  warn: () => {
    // silent no-op
  },
  error: () => {
    // silent no-op
  },
  fatal: () => {
    // silent no-op
  },
  child: () => noopLogger,
};

/**
 * Create a HandlerContext for a new request.
 *
 * Auto-generates requestId using Bun.randomUUIDv7() if not provided.
 *
 * @param options - Context configuration options
 * @returns Fully populated HandlerContext
 *
 * @example
 * ```typescript
 * const ctx = createContext({
 *   logger: createLogger(),
 *   config: resolvedConfig,
 *   signal: controller.signal,
 * });
 *
 * const result = await handler(input, ctx);
 * ```
 */
export function createContext(options: CreateContextOptions): HandlerContext {
  const ctx: HandlerContext = {
    requestId: options.requestId ?? generateRequestId(),
    logger: options.logger ?? noopLogger,
    cwd: options.cwd ?? process.cwd(),
    env: options.env ?? {},
  };

  // Only add optional properties if they have defined values
  if (options.config !== undefined) {
    ctx.config = options.config;
  }
  if (options.signal !== undefined) {
    ctx.signal = options.signal;
  }
  if (options.workspaceRoot !== undefined) {
    ctx.workspaceRoot = options.workspaceRoot;
  }

  return ctx;
}

/**
 * Generate a sortable request ID (UUIDv7).
 *
 * UUIDv7 is time-ordered, making it ideal for request tracing
 * as IDs sort chronologically.
 *
 * @returns UUIDv7 string
 *
 * @example
 * ```typescript
 * const requestId = generateRequestId();
 * // "018e4f3c-1a2b-7000-8000-000000000001"
 * ```
 */
export function generateRequestId(): string {
  return Bun.randomUUIDv7();
}
