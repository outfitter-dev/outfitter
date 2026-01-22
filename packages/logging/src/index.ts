/**
 * @outfitter/logging
 *
 * Structured logging via logtape with automatic sensitive data redaction.
 * Provides consistent log formatting across CLI, MCP, and server contexts.
 *
 * @packageDocumentation
 */

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Log levels supported by the logger, ordered from lowest to highest severity.
 * "silent" is a special level that disables all logging.
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

/**
 * A structured log record containing all information about a log event.
 */
export interface LogRecord {
	/** Unix timestamp in milliseconds when the log was created */
	timestamp: number;

	/** Severity level of the log */
	level: Exclude<LogLevel, "silent">;

	/** Logger category/name (e.g., "my-service", "api") */
	category: string;

	/** Human-readable log message */
	message: string;

	/** Structured metadata attached to the log */
	metadata?: Record<string, unknown>;
}

/**
 * Formatter interface for converting log records to strings.
 */
export interface Formatter {
	/** Format a log record into a string representation */
	format(record: LogRecord): string;
}

/**
 * Sink interface for outputting log records to various destinations.
 */
export interface Sink {
	/** Write a log record (optionally with pre-formatted string) */
	write(record: LogRecord, formatted?: string): void;

	/** Optional formatter specific to this sink */
	formatter?: Formatter;

	/** Optional async flush to ensure all pending writes complete */
	flush?(): Promise<void>;
}

/**
 * Redaction configuration for sensitive data scrubbing.
 */
export interface RedactionConfig {
	/** Enable or disable redaction (default: true) */
	enabled?: boolean;

	/** Additional regex patterns to match and redact */
	patterns?: RegExp[];

	/** Additional key names whose values should be redacted */
	keys?: string[];

	/** Replacement string (default: "[REDACTED]") */
	replacement?: string;
}

/**
 * Configuration options for creating a logger.
 */
export interface LoggerConfig {
	/** Logger name/category */
	name: string;

	/** Minimum log level to output (default: "info") */
	level?: LogLevel;

	/** Initial context metadata to attach to all logs */
	context?: Record<string, unknown>;

	/** Sinks to output logs to */
	sinks?: Sink[];

	/** Redaction configuration */
	redaction?: RedactionConfig;
}

/**
 * Logger instance with methods for each log level.
 */
export interface LoggerInstance {
	/** Log at trace level */
	trace(message: string, metadata?: Record<string, unknown>): void;

	/** Log at debug level */
	debug(message: string, metadata?: Record<string, unknown>): void;

	/** Log at info level */
	info(message: string, metadata?: Record<string, unknown>): void;

	/** Log at warn level */
	warn(message: string, metadata?: Record<string, unknown>): void;

	/** Log at error level */
	error(message: string, metadata?: Record<string, unknown>): void;

	/** Log at fatal level */
	fatal(message: string, metadata?: Record<string, unknown>): void;

	/** Get the current context metadata */
	getContext(): Record<string, unknown>;

	/** Set the minimum log level at runtime */
	setLevel(level: LogLevel): void;

	/** Add a sink at runtime */
	addSink(sink: Sink): void;
}

/**
 * Options for pretty (human-readable) formatter.
 */
export interface PrettyFormatterOptions {
	/** Enable ANSI colors in output (default: true) */
	colors?: boolean;

	/** Include timestamp in output (default: true) */
	timestamp?: boolean;
}

/**
 * Options for file sink.
 */
export interface FileSinkOptions {
	/** Path to the log file */
	path: string;

	/** Append to existing file (default: true) */
	append?: boolean;
}

/**
 * Global redaction configuration options.
 */
export interface GlobalRedactionConfig {
	/** Additional regex patterns to match and redact globally */
	patterns?: RegExp[];

	/** Additional key names whose values should be redacted globally */
	keys?: string[];
}

// ============================================================================
// Stub Implementations - Will throw until properly implemented
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
export function createLogger(_config: LoggerConfig): LoggerInstance {
	throw new Error("Not implemented: createLogger");
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
	_parent: LoggerInstance,
	_context: Record<string, unknown>,
): LoggerInstance {
	throw new Error("Not implemented: createChildLogger");
}

/**
 * Create a JSON formatter for structured log output.
 *
 * @returns Formatter that outputs JSON strings
 *
 * @example
 * ```typescript
 * const formatter = createJsonFormatter();
 * const output = formatter.format(record);
 * // {"timestamp":1705936800000,"level":"info","message":"Hello",...}
 * ```
 */
export function createJsonFormatter(): Formatter {
	throw new Error("Not implemented: createJsonFormatter");
}

/**
 * Create a human-readable formatter with optional colors.
 *
 * @param options - Formatter options
 * @returns Formatter that outputs human-readable strings
 *
 * @example
 * ```typescript
 * const formatter = createPrettyFormatter({ colors: true });
 * const output = formatter.format(record);
 * // 2024-01-22T12:00:00.000Z [INFO] my-service: Hello world
 * ```
 */
export function createPrettyFormatter(_options?: PrettyFormatterOptions): Formatter {
	throw new Error("Not implemented: createPrettyFormatter");
}

/**
 * Create a console sink that writes to stdout/stderr.
 * Info and below go to stdout, warn and above go to stderr.
 *
 * @returns Sink configured for console output
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   name: "app",
 *   sinks: [createConsoleSink()],
 * });
 * ```
 */
export function createConsoleSink(): Sink {
	throw new Error("Not implemented: createConsoleSink");
}

/**
 * Create a file sink that writes to a specified file path.
 *
 * @param options - File sink options
 * @returns Sink configured for file output
 *
 * @example
 * ```typescript
 * const logger = createLogger({
 *   name: "app",
 *   sinks: [createFileSink({ path: "/var/log/app.log" })],
 * });
 * ```
 */
export function createFileSink(_options: FileSinkOptions): Sink {
	throw new Error("Not implemented: createFileSink");
}

/**
 * Configure global redaction patterns and keys that apply to all loggers.
 *
 * @param config - Global redaction configuration
 *
 * @example
 * ```typescript
 * configureRedaction({
 *   patterns: [/custom-secret-\d+/g],
 *   keys: ["myCustomKey"],
 * });
 * ```
 */
export function configureRedaction(_config: GlobalRedactionConfig): void {
	throw new Error("Not implemented: configureRedaction");
}

/**
 * Flush all pending log writes across all sinks.
 * Call this before process exit to ensure all logs are written.
 *
 * @returns Promise that resolves when all sinks have flushed
 *
 * @example
 * ```typescript
 * logger.info("Shutting down");
 * await flush();
 * process.exit(0);
 * ```
 */
export async function flush(): Promise<void> {
	throw new Error("Not implemented: flush");
}
