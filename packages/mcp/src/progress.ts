/**
 * MCP progress adapter — translates StreamEvent to notifications/progress.
 *
 * When an MCP client provides a `progressToken` in the tool call params,
 * this adapter creates a {@link ProgressCallback} that emits
 * `notifications/progress` via the MCP SDK for each `ctx.progress` call.
 *
 * Without a `progressToken`, no callback is created and `ctx.progress`
 * remains `undefined` — the handler does not stream.
 *
 * This is a separate module for modularity (VAL-STREAM-008), parallel
 * to the CLI NDJSON adapter in `@outfitter/cli/streaming`.
 *
 * @packageDocumentation
 */

import type { ProgressCallback, StreamEvent } from "@outfitter/contracts";

/**
 * Function signature for sending a raw MCP notification.
 *
 * Matches the `sdkServer.notification()` method shape from the MCP SDK.
 */
export type McpNotificationSender = (notification: unknown) => void;

/**
 * MCP progress notification payload matching the MCP specification.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/utilities/progress/
 */
export interface McpProgressNotification {
  method: "notifications/progress";
  params: {
    progressToken: string | number;
    progress: number;
    total?: number;
    message?: string;
  };
}

// =============================================================================
// StreamEvent → MCP Progress Mapping
// =============================================================================

/**
 * Format a human-readable message from a StreamEvent for MCP progress.
 *
 * MCP progress notifications have `progress`, `total?`, and `message?` fields.
 * For `start` and `step` events (which don't have natural numeric progress),
 * we preserve the latest numeric progress to avoid backward progress jumps.
 */
function mapStreamEventToNotification(
  token: string | number,
  event: StreamEvent,
  latestProgress: number
): McpProgressNotification {
  switch (event.type) {
    case "start": {
      return {
        method: "notifications/progress",
        params: {
          progressToken: token,
          progress: latestProgress,
          message: `[start] ${event.command}`,
        },
      };
    }

    case "step": {
      const durationSuffix =
        event.duration_ms !== undefined ? ` (${event.duration_ms}ms)` : "";
      return {
        method: "notifications/progress",
        params: {
          progressToken: token,
          progress: latestProgress,
          message: `[step] ${event.name}: ${event.status}${durationSuffix}`,
        },
      };
    }

    case "progress": {
      const params: McpProgressNotification["params"] = {
        progressToken: token,
        progress: event.current,
        total: event.total,
      };
      if (event.message !== undefined) {
        params.message = event.message;
      }
      return {
        method: "notifications/progress",
        params,
      };
    }
  }
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Create a {@link ProgressCallback} that emits MCP `notifications/progress`.
 *
 * Each call to the returned callback translates a {@link StreamEvent} into
 * an MCP progress notification and sends it via the provided sender function.
 *
 * @param progressToken - The progress token from the MCP client request
 * @param send - Function to send the raw MCP notification (typically `sdkServer.notification`)
 * @returns A `ProgressCallback` compatible with `ctx.progress`
 *
 * @example
 * ```typescript
 * const progress = createMcpProgressCallback(
 *   "tok-123",
 *   (n) => sdkServer.notification(n)
 * );
 *
 * // In handler:
 * ctx.progress?.({ type: "start", command: "deploy", ts: new Date().toISOString() });
 * ctx.progress?.({ type: "progress", current: 5, total: 10 });
 * ```
 */
export function createMcpProgressCallback(
  progressToken: string | number,
  send: McpNotificationSender
): ProgressCallback {
  let latestProgress = 0;

  return (event: StreamEvent): void => {
    if (event.type === "progress") {
      latestProgress = event.current;
    }
    const notification = mapStreamEventToNotification(
      progressToken,
      event,
      latestProgress
    );
    send(notification);
  };
}
