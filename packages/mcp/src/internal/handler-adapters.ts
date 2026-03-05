/**
 * Handler context and error translation adapters for the MCP server.
 *
 * Extracted from `createMcpServer()` to keep the server factory focused on
 * wiring. Both helpers are pure functions that take explicit dependencies
 * instead of capturing closures.
 *
 * @internal
 */

import type { Logger, OutfitterError } from "@outfitter/contracts";

import { createMcpProgressCallback } from "../progress.js";
import { McpError, type McpHandlerContext } from "../types.js";

// ============================================================================
// Handler Context Dependencies
// ============================================================================

/**
 * Minimal dependency surface required by {@link createHandlerContext}.
 *
 * Keeps the extracted function decoupled from the full server internals —
 * callers pass only what is actually used.
 */
export interface HandlerContextDeps {
  /** Logger instance for creating child loggers and warning on notification failures. */
  logger: Logger;
  // oxlint-disable-next-line typescript/no-explicit-any -- SDK Server type from @modelcontextprotocol/sdk
  sdkServer: any;
}

// ============================================================================
// createHandlerContext
// ============================================================================

/**
 * Create a handler context for tool, resource, and prompt invocations.
 *
 * @param label - Human-readable label for the invocation (tool name or resource URI)
 * @param requestId - Unique request identifier
 * @param deps - Logger and SDK server references
 * @param signal - Optional abort signal for cancellation
 * @param progressToken - Optional MCP progress token from the client
 * @param loggerMeta - Optional metadata for the child logger
 * @returns Configured handler context
 */
export function createHandlerContext(
  label: string,
  requestId: string,
  deps: HandlerContextDeps,
  signal?: AbortSignal,
  progressToken?: string | number,
  loggerMeta?: Record<string, string>
): McpHandlerContext {
  const ctx: McpHandlerContext = {
    requestId,
    logger: deps.logger.child(loggerMeta ?? { tool: label, requestId }),
    cwd: process.cwd(),
    // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: pass full env to handler context
    env: process.env as Record<string, string | undefined>,
  };

  // Only add signal if it's defined (exactOptionalPropertyTypes)
  if (signal !== undefined) {
    ctx.signal = signal;
  }

  // Add progress callback when token is present and SDK server is bound.
  // Uses the modular MCP progress adapter (packages/mcp/src/progress.ts)
  // which translates StreamEvent → notifications/progress.
  if (progressToken !== undefined && deps.sdkServer) {
    const sender = (notification: unknown): void => {
      const maybePromise = deps.sdkServer?.notification?.(notification);
      if (
        typeof maybePromise === "object" &&
        maybePromise !== null &&
        "then" in maybePromise
      ) {
        void (maybePromise as Promise<unknown>).catch((error: unknown) => {
          deps.logger.warn("Failed to send MCP progress notification", {
            error: error instanceof Error ? error.message : String(error),
          });
        });
      }
    };
    const streamProgress = createMcpProgressCallback(progressToken, sender);
    const progress = streamProgress as unknown as NonNullable<
      McpHandlerContext["progress"]
    >;
    progress.report = (value: number, total?: number, message?: string) => {
      // Route legacy report() through the same callback so the adapter's
      // internal progress state stays in sync with StreamEvent calls.
      streamProgress({
        type: "progress",
        current: value,
        total: total ?? value,
        ...(message !== undefined ? { message } : {}),
      });
    };
    ctx.progress = progress;
  }

  return ctx;
}

// ============================================================================
// translateError
// ============================================================================

/**
 * Translate an OutfitterError to an McpError with the appropriate JSON-RPC code.
 *
 * @param error - The domain error to translate
 * @returns An McpError with a mapped JSON-RPC error code and original error context
 */
export function translateError(
  error: OutfitterError
): InstanceType<typeof McpError> {
  // Map error categories to JSON-RPC error codes
  const codeMap: Record<string, number> = {
    validation: -32_602, // Invalid params
    not_found: -32_601, // Method not found (closest fit)
    permission: -32_600, // Invalid request
    internal: -32_603, // Internal error
    timeout: -32_603,
    network: -32_603,
    rate_limit: -32_603,
    auth: -32_600,
    conflict: -32_603,
    cancelled: -32_603,
  };

  const code = codeMap[error.category] ?? -32_603;
  const context: Record<string, unknown> = {
    originalTag: error._tag,
    category: error.category,
  };

  if (
    error._tag === "ValidationError" &&
    "field" in error &&
    typeof error.field === "string"
  ) {
    context["field"] = error.field;
  }

  return new McpError({
    message: error.message,
    code,
    context,
  });
}
