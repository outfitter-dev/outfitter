/**
 * @outfitter/logging
 *
 * Structured logging via logtape with automatic sensitive data redaction.
 * Provides consistent log formatting across CLI, MCP, and server contexts.
 *
 * @packageDocumentation
 */

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
// Re-exports: Logger
// ============================================================================

export { createChildLogger, createLogger } from "./internal/logger.js";

// ============================================================================
// Re-exports: Environment-Aware Log Level Resolution
// ============================================================================

export { resolveLogLevel, resolveOutfitterLogLevel } from "./internal/env.js";

// ============================================================================
// Re-exports: Factory
// ============================================================================

export type {
  OutfitterLoggerAdapter,
  OutfitterLoggerFactory,
} from "./internal/factory.js";

export {
  createOutfitterLoggerAdapter,
  createOutfitterLoggerFactory,
} from "./internal/factory.js";
