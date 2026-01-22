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
 *
 * @throws Error - Not implemented in scaffold
 */
export function createContext(_options: CreateContextOptions): HandlerContext {
	throw new Error("Not implemented");
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
 *
 * @throws Error - Not implemented in scaffold
 */
export function generateRequestId(): string {
	throw new Error("Not implemented");
}
