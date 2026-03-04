/**
 * @outfitter/logging
 *
 * Structured logging via logtape with automatic sensitive data redaction.
 * Provides consistent log formatting across CLI, MCP, and server contexts.
 *
 * @packageDocumentation
 */

import type { Logger as LogtapeLogger } from "@logtape/logtape";
import {
  getEnvironment as _getEnvironment,
  getEnvironmentDefaults as _getEnvironmentDefaults,
} from "@outfitter/config";
import {
  type LoggerAdapter as ContractLoggerAdapter,
  type LoggerFactory as ContractLoggerFactory,
  type LoggerFactoryConfig as ContractLoggerFactoryConfig,
  createLoggerFactory as createContractLoggerFactory,
} from "@outfitter/contracts";

// ============================================================================
// Re-exports: Types
// ============================================================================

export type {
  ConsoleSinkOptions,
  FileSinkOptions,
  Formatter,
  GlobalRedactionConfig,
  LoggerConfig,
  LoggerInstance,
  LogLevel,
  LogRecord,
  OutfitterLoggerBackendOptions,
  OutfitterLoggerDefaults,
  OutfitterLoggerFactoryOptions,
  PrettyFormatterOptions,
  RedactionConfig,
  Sink,
} from "./internal/types.js";

export { LEVEL_PRIORITY, shouldLog } from "./internal/types.js";

// ============================================================================
// Re-exports: Redaction
// ============================================================================

export {
  applyPatterns,
  configureRedaction,
  DEFAULT_PATTERNS,
  globalRedactionConfig,
  mergeRedactionConfig,
  processMetadata,
} from "./internal/redaction.js";

// ============================================================================
// Re-exports: Bridge
// ============================================================================

export { dispatchRecordToSinks, registeredSinks } from "./internal/bridge.js";

// ============================================================================
// Re-exports: Sinks and Formatters
// ============================================================================

export {
  createConsoleSink,
  createFileSink,
  createJsonFormatter,
  createPrettyFormatter,
  flush,
  flushSinks,
} from "./internal/sinks.js";

// ============================================================================
// Internal imports for this module
// ============================================================================

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
} from "./internal/bridge.js";
import {
  applyPatterns,
  DEFAULT_PATTERNS,
  globalRedactionConfig,
  mergeRedactionConfig,
  processMetadata,
} from "./internal/redaction.js";
import { createConsoleSink, flushSinks } from "./internal/sinks.js";
import type {
  LoggerConfig,
  LoggerInstance,
  LogLevel,
  LogRecord,
  OutfitterLoggerBackendOptions,
  OutfitterLoggerFactoryOptions,
  RedactionConfig,
  Sink,
} from "./internal/types.js";
import { shouldLog } from "./internal/types.js";

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

// ============================================================================
// Runtime Safety Helpers
// ============================================================================

/**
 * Safely read an environment variable.
 * Returns undefined in runtimes where `process` is not available (e.g., edge runtimes, V8 isolates).
 */
function safeGetEnv(key: string): string | undefined {
  if (typeof process !== "undefined") {
    // eslint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-aware log level resolution
    return process.env?.[key];
  }
  return undefined;
}

// ============================================================================
// Environment-Aware Log Level Resolution
// ============================================================================

/**
 * Map from OUTFITTER_LOG_LEVEL / environment defaults values to LogLevel.
 *
 * MCP-style levels (warning, emergency, etc.) are mapped to the
 * closest LogLevel equivalent.
 */
const ENV_LEVEL_MAP: Readonly<Record<string, LogLevel>> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  notice: "info",
  warn: "warn",
  warning: "warn",
  error: "error",
  critical: "fatal",
  alert: "fatal",
  emergency: "fatal",
  fatal: "fatal",
  silent: "silent",
};

/**
 * Resolve the log level from environment configuration.
 *
 * Precedence (highest wins):
 * 1. `OUTFITTER_LOG_LEVEL` environment variable
 * 2. Explicit `level` parameter
 * 3. `OUTFITTER_ENV` environment profile defaults
 * 4. `"info"` (default)
 *
 * @param level - Optional explicit log level (overridden by env var)
 * @returns Resolved LogLevel
 *
 * @example
 * ```typescript
 * import { createLogger, resolveLogLevel } from "@outfitter/logging";
 *
 * // Auto-resolve from environment
 * const logger = createLogger({
 *   name: "my-app",
 *   level: resolveLogLevel(),
 * });
 *
 * // With OUTFITTER_ENV=development → "debug"
 * // With OUTFITTER_LOG_LEVEL=error → "error" (overrides everything)
 * // With nothing set → "info"
 * ```
 */
export function resolveLogLevel(level?: LogLevel | string): LogLevel {
  // 1. OUTFITTER_LOG_LEVEL env var (highest precedence)
  const envLogLevel = safeGetEnv("OUTFITTER_LOG_LEVEL");
  if (envLogLevel !== undefined && Object.hasOwn(ENV_LEVEL_MAP, envLogLevel)) {
    // eslint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
    return ENV_LEVEL_MAP[envLogLevel]!;
  }

  // 2. Explicit level parameter (validate strings via ENV_LEVEL_MAP)
  if (level !== undefined && Object.hasOwn(ENV_LEVEL_MAP, level)) {
    // eslint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
    return ENV_LEVEL_MAP[level]!;
  }

  // 3. Environment profile (guarded for edge runtimes without process)
  try {
    const env = _getEnvironment();
    const defaults = _getEnvironmentDefaults(env);
    if (
      defaults.logLevel !== null &&
      Object.hasOwn(ENV_LEVEL_MAP, defaults.logLevel)
    ) {
      // eslint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
      return ENV_LEVEL_MAP[defaults.logLevel]!;
    }
  } catch {
    // process.env unavailable (edge runtime) — fall through to default
  }

  // 4. Default
  return "info";
}

/**
 * Resolve log level using Outfitter runtime defaults.
 *
 * Precedence (highest wins):
 * 1. `OUTFITTER_LOG_LEVEL` environment variable
 * 2. Explicit `level` parameter
 * 3. `OUTFITTER_ENV` profile defaults
 * 4. `"silent"` (when profile default is null)
 */
export function resolveOutfitterLogLevel(level?: LogLevel | string): LogLevel {
  // 1. OUTFITTER_LOG_LEVEL env var (highest precedence)
  const envLogLevel = safeGetEnv("OUTFITTER_LOG_LEVEL");
  if (envLogLevel !== undefined && Object.hasOwn(ENV_LEVEL_MAP, envLogLevel)) {
    // eslint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
    return ENV_LEVEL_MAP[envLogLevel]!;
  }

  // 2. Explicit level parameter (validate strings via ENV_LEVEL_MAP)
  if (level !== undefined && Object.hasOwn(ENV_LEVEL_MAP, level)) {
    // eslint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
    return ENV_LEVEL_MAP[level]!;
  }

  // 3. Environment profile (guarded for edge runtimes without process)
  try {
    const env = _getEnvironment();
    const defaults = _getEnvironmentDefaults(env);
    if (
      defaults.logLevel !== null &&
      Object.hasOwn(ENV_LEVEL_MAP, defaults.logLevel)
    ) {
      // eslint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
      return ENV_LEVEL_MAP[defaults.logLevel]!;
    }
  } catch {
    // process.env unavailable (edge runtime) — fall through to default
  }

  // 4. Default: profile disabled logging
  return "silent";
}

/**
 * Outfitter logger adapter contract type.
 */
export type OutfitterLoggerAdapter =
  ContractLoggerAdapter<OutfitterLoggerBackendOptions>;

/**
 * Outfitter logger factory contract type.
 */
export type OutfitterLoggerFactory =
  ContractLoggerFactory<OutfitterLoggerBackendOptions>;

/**
 * Create an Outfitter logger adapter with environment defaults and redaction.
 *
 * Defaults:
 * - log level resolution via `resolveOutfitterLogLevel()`
 * - redaction enabled by default (`enabled: true`)
 * - console sink when no explicit sinks are provided
 */
export function createOutfitterLoggerAdapter(
  options?: OutfitterLoggerFactoryOptions
): OutfitterLoggerAdapter {
  const factorySinks = new Set<Sink>();

  return {
    createLogger(
      config: ContractLoggerFactoryConfig<OutfitterLoggerBackendOptions>
    ) {
      const backend = config.backend;
      const sinks = backend?.sinks ??
        options?.defaults?.sinks ?? [createConsoleSink()];
      const defaultRedaction = mergeRedactionConfig(
        { enabled: true },
        options?.defaults?.redaction
      );
      const redaction = mergeRedactionConfig(
        defaultRedaction,
        backend?.redaction
      );

      const loggerConfig: LoggerConfig = {
        name: config.name,
        level: resolveOutfitterLogLevel(config.level),
        sinks,
        ...(config.context !== undefined ? { context: config.context } : {}),
        ...(redaction !== undefined ? { redaction } : {}),
      };

      for (const sink of sinks) {
        factorySinks.add(sink);
      }

      const logger = createLogger(loggerConfig);
      const originalAddSink = logger.addSink.bind(logger);
      logger.addSink = (sink) => {
        factorySinks.add(sink);
        originalAddSink(sink);
      };

      return logger;
    },
    async flush() {
      await flushSinks(factorySinks);
    },
  };
}

/**
 * Create an Outfitter logger factory over the contracts logger abstraction.
 */
export function createOutfitterLoggerFactory(
  options?: OutfitterLoggerFactoryOptions
): OutfitterLoggerFactory {
  return createContractLoggerFactory(createOutfitterLoggerAdapter(options));
}
