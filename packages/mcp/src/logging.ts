/**
 * @outfitter/mcp - Logging Bridge
 *
 * Maps Outfitter log levels to MCP log levels for
 * server-to-client log message notifications.
 *
 * @packageDocumentation
 */

/**
 * MCP log levels as defined in the MCP specification.
 * Ordered from least to most severe.
 */
export type McpLogLevel =
  | "debug"
  | "info"
  | "notice"
  | "warning"
  | "error"
  | "critical"
  | "alert"
  | "emergency";

/**
 * Outfitter log levels.
 */
type OutfitterLogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal";

/**
 * Ordered MCP log levels for severity comparison.
 */
const MCP_LEVEL_ORDER: McpLogLevel[] = [
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency",
];

/**
 * Map an Outfitter log level to the corresponding MCP log level.
 */
export function mapLogLevelToMcp(level: OutfitterLogLevel): McpLogLevel {
  switch (level) {
    case "trace":
    case "debug":
      return "debug";
    case "info":
      return "info";
    case "warn":
      return "warning";
    case "error":
      return "error";
    case "fatal":
      return "emergency";
    default: {
      const _exhaustiveCheck: never = level;
      return _exhaustiveCheck;
    }
  }
}

/**
 * Check whether a message at the given level should be emitted
 * based on the client-requested threshold.
 */
export function shouldEmitLog(
  messageLevel: McpLogLevel,
  threshold: McpLogLevel
): boolean {
  return (
    MCP_LEVEL_ORDER.indexOf(messageLevel) >= MCP_LEVEL_ORDER.indexOf(threshold)
  );
}
