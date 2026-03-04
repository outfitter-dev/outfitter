import type { Logger as ContractLogger } from "@outfitter/contracts";

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Log levels supported by the logger, ordered from lowest to highest severity.
 *
 * Level priority (lowest to highest): trace (0) < debug (1) < info (2) < warn (3) < error (4) < fatal (5)
 *
 * The special level "silent" (6) disables all logging when set as the minimum level.
 *
 * @example
 * ```typescript
 * const level: LogLevel = "info";
 *
 * // Set minimum level to filter logs
 * const logger = createLogger({ name: "app", level: "warn" });
 * logger.debug("Filtered out"); // Not logged
 * logger.warn("Logged");        // Logged
 * ```
 */
export type LogLevel =
  | "trace"
  | "debug"
  | "info"
  | "warn"
  | "error"
  | "fatal"
  | "silent";

/**
 * A structured log record containing all information about a log event.
 *
 * Log records are passed to formatters and sinks for processing. They contain
 * the timestamp, level, category (logger name), message, and optional metadata.
 *
 * @example
 * ```typescript
 * const record: LogRecord = {
 *   timestamp: Date.now(),
 *   level: "info",
 *   category: "my-service",
 *   message: "Request processed",
 *   metadata: { duration: 150, status: 200 },
 * };
 * ```
 */
export interface LogRecord {
  /** Logger category/name identifying the source (e.g., "my-service", "api") */
  category: string;

  /** Severity level of the log (excludes "silent" which is only for filtering) */
  level: Exclude<LogLevel, "silent">;

  /** Human-readable log message describing the event */
  message: string;

  /** Optional structured metadata attached to the log for additional context */
  metadata?: Record<string, unknown>;
  /** Unix timestamp in milliseconds when the log was created */
  timestamp: number;
}

/**
 * Formatter interface for converting log records to strings.
 *
 * Formatters are responsible for serializing log records into output strings.
 * Built-in formatters include JSON (for machine parsing) and pretty (for humans).
 *
 * @example
 * ```typescript
 * const customFormatter: Formatter = {
 *   format(record: LogRecord): string {
 *     return `[${record.level.toUpperCase()}] ${record.category}: ${record.message}`;
 *   },
 * };
 *
 * const sink: Sink = {
 *   formatter: customFormatter,
 *   write(record, formatted) {
 *     console.log(formatted); // "[INFO] app: Hello world"
 *   },
 * };
 * ```
 */
export interface Formatter {
  /**
   * Format a log record into a string representation.
   *
   * @param record - The log record to format
   * @returns Formatted string representation of the log record
   */
  format(record: LogRecord): string;
}

/**
 * Sink interface for outputting log records to various destinations.
 *
 * Sinks receive log records and write them to their destination (console, file,
 * remote service, etc.). They can optionally have a formatter to convert records
 * to strings, and a flush method for buffered writes.
 *
 * @example
 * ```typescript
 * const customSink: Sink = {
 *   formatter: createJsonFormatter(),
 *   write(record: LogRecord, formatted?: string): void {
 *     const output = formatted ?? JSON.stringify(record);
 *     sendToRemoteService(output);
 *   },
 *   async flush(): Promise<void> {
 *     await flushPendingRequests();
 *   },
 * };
 * ```
 */
export interface Sink {
  /**
   * Optional async flush to ensure all pending/buffered writes complete.
   * Called by the global `flush()` function before process exit.
   *
   * @returns Promise that resolves when all pending writes are complete
   */
  flush?(): Promise<void>;

  /** Optional formatter specific to this sink for converting records to strings */
  formatter?: Formatter;
  /**
   * Write a log record to the sink's destination.
   *
   * @param record - The log record to write
   * @param formatted - Optional pre-formatted string from the sink's formatter
   */
  write(record: LogRecord, formatted?: string): void;
}

/**
 * Redaction configuration for sensitive data scrubbing.
 *
 * Redaction automatically replaces sensitive values in log metadata to prevent
 * accidental exposure of secrets, tokens, and credentials. Default sensitive keys
 * (password, secret, token, apikey) are always redacted when enabled.
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   name: "auth",
 *   redaction: {
 *     enabled: true,
 *     patterns: [/Bearer [a-zA-Z0-9._-]+/g], // Redact Bearer tokens in strings
 *     keys: ["privateKey", "credentials"],   // Additional keys to redact
 *     replacement: "***",                    // Custom replacement text
 *   },
 * });
 * ```
 */
export interface RedactionConfig {
  /**
   * Enable or disable redaction for this logger.
   * @defaultValue true (when RedactionConfig is provided)
   */
  enabled?: boolean;

  /** Additional key names whose values should be fully redacted (case-insensitive) */
  keys?: string[];

  /** Additional regex patterns to match and redact within string values */
  patterns?: RegExp[];

  /**
   * Replacement string for redacted values.
   * @defaultValue "[REDACTED]"
   */
  replacement?: string;
}

/**
 * Configuration options for creating a logger.
 *
 * Defines the logger's name, minimum level, context, sinks, and redaction settings.
 *
 * @example
 * ```typescript
 * const config: LoggerConfig = {
 *   name: "my-service",
 *   level: "debug",
 *   context: { service: "api", version: "1.0.0" },
 *   sinks: [createConsoleSink(), createFileSink({ path: "/var/log/app.log" })],
 *   redaction: { enabled: true },
 * };
 *
 * const logger = createLogger(config);
 * ```
 */
export interface LoggerConfig {
  /** Initial context metadata attached to all log records from this logger */
  context?: Record<string, unknown>;

  /**
   * Minimum log level to output. Messages below this level are filtered.
   * @defaultValue "info"
   */
  level?: LogLevel;
  /** Logger name used as the category in log records */
  name: string;

  /** Redaction configuration for sensitive data scrubbing */
  redaction?: RedactionConfig;

  /** Array of sinks to output log records to */
  sinks?: Sink[];
}

/**
 * Backend options accepted by the Outfitter logger factory.
 *
 * These options are passed via `LoggerFactoryConfig.backend`.
 */
export interface OutfitterLoggerBackendOptions {
  /** Redaction overrides for this specific logger instance */
  redaction?: RedactionConfig;
  /** Sinks for this specific logger instance */
  sinks?: Sink[];
}

/**
 * Default options applied by the Outfitter logger factory.
 */
export interface OutfitterLoggerDefaults {
  /** Default redaction policy merged with logger-specific redaction */
  redaction?: RedactionConfig;
  /** Default sinks used when a logger does not provide backend sinks */
  sinks?: Sink[];
}

/**
 * Options for creating the Outfitter logger factory.
 */
export interface OutfitterLoggerFactoryOptions {
  defaults?: OutfitterLoggerDefaults;
}

/**
 * Logger instance with methods for each log level.
 *
 * Provides methods for logging at each severity level, plus utilities for
 * runtime configuration changes and context inspection.
 *
 * @example
 * ```typescript
 * const logger = createLogger({ name: "app", sinks: [createConsoleSink()] });
 *
 * logger.info("Server started", { port: 3000 });
 * logger.error("Failed to connect", { error: new Error("timeout") });
 *
 * logger.setLevel("debug"); // Enable debug logging at runtime
 * logger.debug("Debug info", { details: "..." });
 * ```
 */
export interface LoggerInstance extends ContractLogger {
  /**
   * Add a sink at runtime.
   * @param sink - Sink to add to this logger's output destinations
   */
  addSink(sink: Sink): void;

  /**
   * Creates a child logger with additional context.
   *
   * Context from the child is merged with the parent's context,
   * with child context taking precedence for duplicate keys.
   * Child loggers are composable (can create nested children).
   *
   * @param context - Additional context to include in all log messages
   * @returns A new LoggerInstance with the merged context
   *
   * @example
   * ```typescript
   * const requestLogger = logger.child({ requestId: "abc123" });
   * requestLogger.info("Processing request"); // includes requestId
   *
   * const opLogger = requestLogger.child({ operation: "create" });
   * opLogger.debug("Starting"); // includes requestId + operation
   * ```
   */
  child(context: Record<string, unknown>): LoggerInstance;

  /**
   * Log at debug level (development debugging).
   * @param message - Human-readable log message
   * @param metadata - Optional structured metadata
   */
  debug(message: string, metadata?: Record<string, unknown>): void;
  debug(metadata: Record<string, unknown>, message: string): never;

  /**
   * Log at error level (failures requiring attention).
   * @param message - Human-readable log message
   * @param metadata - Optional structured metadata
   */
  error(message: string, metadata?: Record<string, unknown>): void;
  error(metadata: Record<string, unknown>, message: string): never;

  /**
   * Log at fatal level (unrecoverable failures).
   * @param message - Human-readable log message
   * @param metadata - Optional structured metadata
   */
  fatal(message: string, metadata?: Record<string, unknown>): void;
  fatal(metadata: Record<string, unknown>, message: string): never;

  /**
   * Get the current context metadata attached to this logger.
   * @returns Copy of the logger's context object
   */
  getContext(): Record<string, unknown>;

  /**
   * Log at info level (normal operations).
   * @param message - Human-readable log message
   * @param metadata - Optional structured metadata
   */
  info(message: string, metadata?: Record<string, unknown>): void;
  info(metadata: Record<string, unknown>, message: string): never;

  /**
   * Set the minimum log level at runtime.
   * @param level - New minimum level (messages below this are filtered)
   */
  setLevel(level: LogLevel): void;
  /**
   * Log at trace level (most verbose, for detailed debugging).
   * @param message - Human-readable log message
   * @param metadata - Optional structured metadata
   */
  trace(message: string, metadata?: Record<string, unknown>): void;
  trace(metadata: Record<string, unknown>, message: string): never;

  /**
   * Log at warn level (unexpected but handled situations).
   * @param message - Human-readable log message
   * @param metadata - Optional structured metadata
   */
  warn(message: string, metadata?: Record<string, unknown>): void;
  warn(metadata: Record<string, unknown>, message: string): never;
}

/**
 * Options for the pretty (human-readable) formatter.
 *
 * Controls ANSI color output and timestamp inclusion for terminal display.
 *
 * @example
 * ```typescript
 * // Colorized with timestamps (default)
 * const formatter = createPrettyFormatter({ colors: true, timestamp: true });
 *
 * // Plain text without timestamps (for piping)
 * const plainFormatter = createPrettyFormatter({ colors: false, timestamp: false });
 * ```
 */
export interface PrettyFormatterOptions {
  /**
   * Enable ANSI colors in output. Colors are applied per log level:
   * trace (dim), debug (cyan), info (green), warn (yellow), error (red), fatal (magenta).
   * @defaultValue false
   */
  colors?: boolean;

  /**
   * Include ISO 8601 timestamp in output.
   * @defaultValue true
   */
  timestamp?: boolean;
}

/**
 * Options for the console sink.
 *
 * Controls ANSI color output for terminal display. By default, colors are
 * auto-detected based on whether stdout is a TTY.
 *
 * @example
 * ```typescript
 * // Auto-detect TTY (default)
 * const sink = createConsoleSink();
 *
 * // Force colors off (for piped output, CI)
 * const plainSink = createConsoleSink({ colors: false });
 *
 * // Force colors on (even in non-TTY)
 * const colorSink = createConsoleSink({ colors: true });
 * ```
 */
export interface ConsoleSinkOptions {
  /**
   * Enable ANSI colors in output.
   * - `undefined` (default): Auto-detect based on stdout TTY status
   * - `true`: Always use colors
   * - `false`: Never use colors
   */
  colors?: boolean;

  /**
   * Custom formatter for log output.
   * When provided, overrides the default pretty formatter.
   * Use `createJsonFormatter()` for structured output.
   *
   * @example
   * ```typescript
   * const sink = createConsoleSink({ formatter: createJsonFormatter() });
   * ```
   */
  formatter?: Formatter;
}

/**
 * Options for the file sink.
 *
 * Configures the file path and append behavior for file-based logging.
 * File sink uses buffered writes - call `flush()` before exit to ensure
 * all logs are written.
 *
 * @example
 * ```typescript
 * const sink = createFileSink({
 *   path: "/var/log/app.log",
 *   append: true, // Append to existing file (default)
 * });
 *
 * // For fresh logs on each run:
 * const freshSink = createFileSink({
 *   path: "/tmp/session.log",
 *   append: false, // Truncate file on start
 * });
 * ```
 */
export interface FileSinkOptions {
  /**
   * Append to existing file or truncate before the first write.
   * @defaultValue true
   */
  append?: boolean;
  /** Absolute path to the log file */
  path: string;
}

/**
 * Global redaction configuration options.
 *
 * Patterns and keys configured globally apply to all loggers that have
 * redaction enabled. Use `configureRedaction()` to add global patterns.
 *
 * @example
 * ```typescript
 * // Configure global patterns that apply to all loggers
 * configureRedaction({
 *   patterns: [
 *     /ghp_[a-zA-Z0-9]{36}/g,  // GitHub PATs
 *     /sk-[a-zA-Z0-9]{20,}/g,   // OpenAI keys
 *   ],
 *   keys: ["privateKey", "credentials"],
 * });
 * ```
 */
export interface GlobalRedactionConfig {
  /** Key names whose values should be fully redacted (case-insensitive, applied globally) */
  keys?: string[];
  /** Regex patterns to match and redact within string values (applied globally) */
  patterns?: RegExp[];
}

// ============================================================================
// Constants and Helpers
// ============================================================================

/** Level priority ordering (lower = less severe) */
export const LEVEL_PRIORITY: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
  silent: 6,
};

/**
 * Check if a level passes the minimum level filter.
 */
export function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
  if (minLevel === "silent") return false;
  return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}
