import {
  configureSync,
  getConfig,
  getLogger,
  type Logger as LogtapeLogger,
  type LogRecord as LogtapeLogRecord,
} from "@logtape/logtape";

import type { LogLevel, LogRecord, Sink } from "./types.js";

// ============================================================================
// Constants
// ============================================================================

/** Reserved logtape sink/category names for the internal bridge. */
export const LOGTAPE_BRIDGE_SINK = "__outfitter_bridge_sink";
export const LOGTAPE_BRIDGE_CATEGORY = "__outfitter_bridge";

/**
 * Internal marker property used to route logtape records to logger instances.
 * Removed from user-visible metadata before sinks are invoked.
 */
export const LOGGER_ID_PROPERTY = "__outfitter_internal_logger_id";

// ============================================================================
// Global State
// ============================================================================

/** Global registry of all sinks for flush() */
export const registeredSinks: Set<Sink> = new Set<Sink>();

/** Track configured logger sinks by internal logger id. */
export const loggerSinkRegistry: Map<string, Set<Sink>> = new Map<
  string,
  Set<Sink>
>();

/** Whether the shared logtape backend bridge has been configured. */
let logtapeBackendConfigured = false;
/** Whether log emission should route through logtape bridge or local sinks. */
let logtapeBridgeEnabled = true;

/** Counter-based logger ids to keep routing deterministic and cheap. */
let loggerIdCounter = 0;

// ============================================================================
// Accessor Functions
// ============================================================================

/** Generate the next logger id. */
export function nextLoggerId(): string {
  return `logger-${++loggerIdCounter}`;
}

/** Check if the logtape bridge is currently enabled. */
export function isBridgeEnabled(): boolean {
  return logtapeBridgeEnabled;
}

// ============================================================================
// Bridge Functions
// ============================================================================

/**
 * Convert logtape message parts to a single output string.
 */
function stringifyLogtapeMessage(parts: readonly unknown[]): string {
  return parts.map((part) => String(part)).join("");
}

/**
 * Map logtape levels to the public @outfitter/logging levels.
 */
function fromLogtapeLevel(
  level: LogtapeLogRecord["level"]
): LogRecord["level"] {
  if (level === "warning") {
    return "warn";
  }
  return level;
}

/**
 * Register a sink for a logger id in the bridge registry.
 */
export function registerLoggerSink(loggerId: string, sink: Sink): void {
  const sinks = loggerSinkRegistry.get(loggerId);
  if (sinks) {
    sinks.add(sink);
    return;
  }

  loggerSinkRegistry.set(loggerId, new Set([sink]));
}

/**
 * Dispatch a normalized log record to sinks with per-sink isolation.
 */
export function dispatchRecordToSinks(
  sinks: Iterable<Sink>,
  record: LogRecord
): void {
  for (const sink of sinks) {
    try {
      let formatted: string | undefined;
      if (sink.formatter) {
        formatted = sink.formatter.format(record);
      }
      sink.write(record, formatted);
    } catch {
      // Sink errors should not crash the logger.
    }
  }
}

function isLogtapeBridgeConfigured(
  config: ReturnType<typeof getConfig>
): boolean {
  if (!config) {
    return false;
  }

  if (!(LOGTAPE_BRIDGE_SINK in config.sinks)) {
    return false;
  }

  return config.loggers.some((logger) => {
    const categoryParts = Array.isArray(logger.category)
      ? logger.category
      : [logger.category];
    if (
      categoryParts.length !== 1 ||
      categoryParts[0] !== LOGTAPE_BRIDGE_CATEGORY
    ) {
      return false;
    }

    return (logger.sinks ?? []).includes(LOGTAPE_BRIDGE_SINK);
  });
}

/**
 * Emit a normalized log record through logtape.
 */
export function emitViaLogtape(
  logger: LogtapeLogger,
  level: Exclude<LogLevel, "silent">,
  message: string,
  metadata: Record<string, unknown>
): void {
  const loggerWithMetadata = logger.with(metadata);

  switch (level) {
    case "trace":
      loggerWithMetadata.trace`${message}`;
      return;
    case "debug":
      loggerWithMetadata.debug`${message}`;
      return;
    case "info":
      loggerWithMetadata.info`${message}`;
      return;
    case "warn":
      loggerWithMetadata.warn`${message}`;
      return;
    case "error":
      loggerWithMetadata.error`${message}`;
      return;
    case "fatal":
      loggerWithMetadata.fatal`${message}`;
      return;
    default:
      return;
  }
}

/**
 * Configure the shared logtape bridge once.
 */
export function ensureLogtapeBackendConfigured(): void {
  const currentConfig = getConfig();

  if (logtapeBackendConfigured) {
    logtapeBridgeEnabled = isLogtapeBridgeConfigured(currentConfig);
    return;
  }

  // If the host process configured logtape already, avoid resetting global
  // config and fall back to direct sink dispatch for this logger.
  if (currentConfig !== null) {
    logtapeBridgeEnabled = isLogtapeBridgeConfigured(currentConfig);
    logtapeBackendConfigured = true;
    return;
  }

  try {
    configureSync({
      sinks: {
        [LOGTAPE_BRIDGE_SINK](record) {
          const loggerId = record.properties[LOGGER_ID_PROPERTY];
          if (typeof loggerId !== "string") {
            return;
          }

          const sinks = loggerSinkRegistry.get(loggerId);
          if (!sinks || sinks.size === 0) {
            return;
          }

          const metadata = { ...record.properties };
          delete metadata[LOGGER_ID_PROPERTY];

          const categoryParts =
            record.category[0] === LOGTAPE_BRIDGE_CATEGORY
              ? record.category.slice(1)
              : record.category;

          const converted: LogRecord = {
            timestamp: record.timestamp,
            level: fromLogtapeLevel(record.level),
            category: categoryParts.join("."),
            message: stringifyLogtapeMessage(record.message),
            ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
          };

          dispatchRecordToSinks(sinks, converted);
        },
      },
      loggers: [
        {
          category: [LOGTAPE_BRIDGE_CATEGORY],
          sinks: [LOGTAPE_BRIDGE_SINK],
          lowestLevel: "trace",
        },
        {
          category: ["logtape", "meta"],
          lowestLevel: "error",
        },
      ],
    });
  } catch {
    // If logtape is configured elsewhere, preserve logger functionality by
    // bypassing the bridge and writing directly to local sinks.
    logtapeBridgeEnabled = false;
  }

  logtapeBackendConfigured = true;
}

/**
 * Get a logtape logger for the bridge category.
 */
export function getBridgeLogger(name: string): LogtapeLogger {
  return getLogger([LOGTAPE_BRIDGE_CATEGORY, name]);
}
