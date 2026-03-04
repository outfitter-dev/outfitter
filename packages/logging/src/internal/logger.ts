import type { Logger as LogtapeLogger } from "@logtape/logtape";

import {
  dispatchRecordToSinks,
  emitViaLogtape,
  ensureLogtapeBackendConfigured,
  getBridgeLogger,
  isBridgeEnabled,
  LOGGER_ID_PROPERTY,
  nextLoggerId,
  registeredSinks,
  registerLoggerSink,
} from "./bridge.js";
import {
  applyPatterns,
  DEFAULT_PATTERNS,
  globalRedactionConfig,
  processMetadata,
} from "./redaction.js";
import type {
  LoggerConfig,
  LoggerInstance,
  LogLevel,
  LogRecord,
  RedactionConfig,
  Sink,
} from "./types.js";
import { shouldLog } from "./types.js";

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Internal logger implementation.
 */
interface InternalLoggerState {
  backendLogger: LogtapeLogger;
  context: Record<string, unknown>;
  level: LogLevel;
  loggerId: string;
  name: string;
  redaction: RedactionConfig | undefined;
  sinks: Sink[];
}

/**
 * Create a logger instance from internal state.
 */
function createLoggerFromState(state: InternalLoggerState): LoggerInstance {
  const log = (
    level: Exclude<LogLevel, "silent">,
    message: string,
    metadata?: Record<string, unknown>
  ): void => {
    if (!shouldLog(level, state.level)) return;

    const processedMetadata = processMetadata(
      { ...state.context, ...metadata },
      state.redaction
    );

    // Process message for redaction if enabled
    let processedMessage = message;
    if (state.redaction?.enabled !== false) {
      // Check if redaction should be applied
      const hasGlobalRules =
        (globalRedactionConfig.patterns?.length ?? 0) > 0 ||
        (globalRedactionConfig.keys?.length ?? 0) > 0;

      if (state.redaction || hasGlobalRules) {
        const allPatterns = [
          ...DEFAULT_PATTERNS,
          ...(state.redaction?.patterns ?? []),
          ...(globalRedactionConfig.patterns ?? []),
        ];
        const replacement = state.redaction?.replacement ?? "[REDACTED]";
        processedMessage = applyPatterns(message, allPatterns, replacement);
      }
    }

    if (isBridgeEnabled()) {
      emitViaLogtape(state.backendLogger, level, processedMessage, {
        ...processedMetadata,
        [LOGGER_ID_PROPERTY]: state.loggerId,
      });
      return;
    }

    const directRecord: LogRecord = {
      timestamp: Date.now(),
      level,
      category: state.name,
      message: processedMessage,
      ...(processedMetadata ? { metadata: processedMetadata } : {}),
    };
    dispatchRecordToSinks(state.sinks, directRecord);
  };

  return {
    trace: ((message: string, metadata?: Record<string, unknown>) =>
      log("trace", message, metadata)) as LoggerInstance["trace"],
    debug: ((message: string, metadata?: Record<string, unknown>) =>
      log("debug", message, metadata)) as LoggerInstance["debug"],
    info: ((message: string, metadata?: Record<string, unknown>) =>
      log("info", message, metadata)) as LoggerInstance["info"],
    warn: ((message: string, metadata?: Record<string, unknown>) =>
      log("warn", message, metadata)) as LoggerInstance["warn"],
    error: ((message: string, metadata?: Record<string, unknown>) =>
      log("error", message, metadata)) as LoggerInstance["error"],
    fatal: ((message: string, metadata?: Record<string, unknown>) =>
      log("fatal", message, metadata)) as LoggerInstance["fatal"],
    getContext: () => ({ ...state.context }),
    setLevel: (level) => {
      state.level = level;
    },
    addSink: (sink) => {
      state.sinks.push(sink);
      registeredSinks.add(sink);
      registerLoggerSink(state.loggerId, sink);
    },
    child: (context) => {
      // Create child logger with merged context (child takes precedence)
      const childState: InternalLoggerState = {
        loggerId: state.loggerId,
        backendLogger: state.backendLogger,
        name: state.name,
        level: state.level,
        context: { ...state.context, ...context },
        sinks: state.sinks, // Share sinks with parent
        redaction: state.redaction,
      };
      return createLoggerFromState(childState);
    },
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Create a configured logger instance.
 *
 * @param config - Logger configuration options
 * @returns Configured LoggerInstance
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   name: "my-service",
 *   level: "debug",
 *   redaction: { enabled: true },
 * });
 *
 * logger.info("Server started", { port: 3000 });
 * ```
 */
export function createLogger(config: LoggerConfig): LoggerInstance {
  ensureLogtapeBackendConfigured();

  const loggerId = nextLoggerId();
  const state: InternalLoggerState = {
    loggerId,
    backendLogger: getBridgeLogger(config.name),
    name: config.name,
    level: config.level ?? "info",
    context: config.context ?? {},
    sinks: [...(config.sinks ?? [])],
    redaction: config.redaction,
  };

  // Register sinks globally for flush()
  for (const sink of state.sinks) {
    registeredSinks.add(sink);
    registerLoggerSink(loggerId, sink);
  }

  return createLoggerFromState(state);
}

/**
 * Create a child logger with merged context from a parent logger.
 *
 * @param parent - Parent logger instance
 * @param context - Additional context to merge with parent context
 * @returns Child LoggerInstance with merged context
 *
 * @example
 * ```typescript
 * const parent = createLogger({ name: "app", context: { service: "api" } });
 * const child = createChildLogger(parent, { handler: "getUser" });
 * // child has context: { service: "api", handler: "getUser" }
 * ```
 */
export function createChildLogger(
  parent: LoggerInstance,
  context: Record<string, unknown>
): LoggerInstance {
  // Access the parent's internal state through its public API
  const parentContext = parent.getContext();

  // Merge parent context with child context
  const mergedContext = { ...parentContext, ...context };

  // Create child logger that delegates to parent but with merged context
  const childLogger: LoggerInstance = {
    trace: ((message: string, metadata?: Record<string, unknown>) =>
      parent.trace(message, {
        ...context,
        ...metadata,
      })) as LoggerInstance["trace"],
    debug: ((message: string, metadata?: Record<string, unknown>) =>
      parent.debug(message, {
        ...context,
        ...metadata,
      })) as LoggerInstance["debug"],
    info: ((message: string, metadata?: Record<string, unknown>) =>
      parent.info(message, {
        ...context,
        ...metadata,
      })) as LoggerInstance["info"],
    warn: ((message: string, metadata?: Record<string, unknown>) =>
      parent.warn(message, {
        ...context,
        ...metadata,
      })) as LoggerInstance["warn"],
    error: ((message: string, metadata?: Record<string, unknown>) =>
      parent.error(message, {
        ...context,
        ...metadata,
      })) as LoggerInstance["error"],
    fatal: ((message: string, metadata?: Record<string, unknown>) =>
      parent.fatal(message, {
        ...context,
        ...metadata,
      })) as LoggerInstance["fatal"],
    getContext: () => mergedContext,
    setLevel: (level) => parent.setLevel(level),
    addSink: (sink) => parent.addSink(sink),
    child: (newContext) => createChildLogger(childLogger, newContext),
  };
  return childLogger;
}
