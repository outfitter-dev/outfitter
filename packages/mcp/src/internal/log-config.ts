/**
 * MCP log level resolution and default sink configuration.
 *
 * Resolves the initial client log level from the environment precedence chain
 * and provides a stderr sink for servers that don't supply their own logger.
 *
 * @internal
 */

import { getEnvironment, getEnvironmentDefaults } from "@outfitter/config";
import { createPrettyFormatter, type Sink } from "@outfitter/logging";

import type { McpLogLevel } from "../logging.js";
import type { McpServerOptions } from "../types.js";

/** Valid MCP log levels for env var and option validation. */
export const VALID_MCP_LOG_LEVELS: ReadonlySet<string> = new Set([
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency",
]);

/** Map from EnvironmentDefaults logLevel to McpLogLevel. */
export const DEFAULTS_TO_MCP: Readonly<Record<string, McpLogLevel>> = {
  debug: "debug",
  info: "info",
  warn: "warning",
  error: "error",
};

/** Create a stderr sink with plain-text formatting for fallback logging. */
export function createDefaultMcpSink(): Sink {
  const formatter = createPrettyFormatter({ colors: false });
  return {
    formatter,
    write(record, formatted) {
      const serialized = formatted ?? formatter.format(record);
      const line = serialized.endsWith("\n") ? serialized : `${serialized}\n`;

      if (typeof process !== "undefined" && process.stderr?.write) {
        process.stderr.write(line);
      }
    },
  };
}

/**
 * Resolve the default client log level from the precedence chain.
 *
 * Precedence (highest wins):
 * 1. `OUTFITTER_LOG_LEVEL` environment variable
 * 2. `options.defaultLogLevel` (validated against MCP levels)
 * 3. Environment profile (`OUTFITTER_ENV`)
 * 4. `null` (no forwarding)
 */
export function resolveDefaultLogLevel(
  options: McpServerOptions
): McpLogLevel | null {
  // 1. OUTFITTER_LOG_LEVEL env var (highest precedence)
  // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-based log level override
  const envLogLevel = process.env["OUTFITTER_LOG_LEVEL"];
  if (envLogLevel !== undefined && VALID_MCP_LOG_LEVELS.has(envLogLevel)) {
    return envLogLevel as McpLogLevel;
  }

  // 2. options.defaultLogLevel (validated)
  if (
    options.defaultLogLevel !== undefined &&
    (options.defaultLogLevel === null ||
      VALID_MCP_LOG_LEVELS.has(options.defaultLogLevel))
  ) {
    return options.defaultLogLevel;
  }
  // Invalid defaultLogLevel values fall through to profile

  // 3. Environment profile (map from config convention to MCP convention)
  const env = getEnvironment();
  const defaults = getEnvironmentDefaults(env);
  if (defaults.logLevel !== null) {
    const mapped = DEFAULTS_TO_MCP[defaults.logLevel];
    if (mapped !== undefined) {
      return mapped;
    }
  }

  // 4. Default: no forwarding
  return null;
}
