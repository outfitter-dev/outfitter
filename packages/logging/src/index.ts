/**
 * @outfitter/logging
 *
 * Structured logging via logtape with automatic sensitive data redaction.
 * Provides consistent log formatting across CLI, MCP, and server contexts.
 *
 * @packageDocumentation
 */

import { writeFileSync } from "node:fs";

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
// Internal State and Constants
// ============================================================================

/** Level priority ordering (lower = less severe) */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
	trace: 0,
	debug: 1,
	info: 2,
	warn: 3,
	error: 4,
	fatal: 5,
	silent: 6,
};

/** Default sensitive keys that should always be redacted (case-insensitive) */
const DEFAULT_SENSITIVE_KEYS = ["password", "secret", "token", "apikey"];

/** Global redaction configuration */
const globalRedactionConfig: GlobalRedactionConfig = {
	patterns: [],
	keys: [],
};

/** Global registry of all sinks for flush() */
const registeredSinks = new Set<Sink>();

// ============================================================================
// Internal Helper Functions
// ============================================================================

/**
 * Check if a level passes the minimum level filter.
 */
function shouldLog(level: LogLevel, minLevel: LogLevel): boolean {
	if (minLevel === "silent") return false;
	return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[minLevel];
}

/**
 * Check if a key should be redacted (case-insensitive).
 */
function isRedactedKey(key: string, additionalKeys: string[]): boolean {
	const lowerKey = key.toLowerCase();
	const allKeys = [...DEFAULT_SENSITIVE_KEYS, ...additionalKeys];
	return allKeys.some((k) => lowerKey === k.toLowerCase());
}

/**
 * Apply regex patterns to redact values in strings.
 */
function applyPatterns(value: string, patterns: RegExp[], replacement: string): string {
	let result = value;
	for (const pattern of patterns) {
		// Reset lastIndex for global patterns
		pattern.lastIndex = 0;
		result = result.replace(pattern, replacement);
	}
	return result;
}

/**
 * Recursively redact sensitive data from an object.
 */
function redactValue(
	value: unknown,
	keys: string[],
	patterns: RegExp[],
	replacement: string,
	currentKey?: string,
): unknown {
	// Check if this key should be fully redacted
	if (currentKey !== undefined && isRedactedKey(currentKey, keys)) {
		return replacement;
	}

	// Handle string values - apply patterns
	if (typeof value === "string") {
		return applyPatterns(value, patterns, replacement);
	}

	// Handle arrays - recurse into each element
	if (Array.isArray(value)) {
		return value.map((item) => redactValue(item, keys, patterns, replacement));
	}

	// Handle Error objects - serialize them
	if (value instanceof Error) {
		return {
			name: value.name,
			message: value.message,
			stack: value.stack,
		};
	}

	// Handle plain objects - recurse into properties
	if (value !== null && typeof value === "object") {
		const result: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(value)) {
			result[k] = redactValue(v, keys, patterns, replacement, k);
		}
		return result;
	}

	// Return primitives as-is
	return value;
}

/**
 * Process metadata: apply redaction and serialize errors.
 */
function processMetadata(
	metadata: Record<string, unknown> | undefined,
	redactionConfig: RedactionConfig | undefined,
): Record<string, unknown> | undefined {
	if (!metadata) return undefined;

	// Serialize errors even without redaction
	const processed: Record<string, unknown> = {};

	for (const [key, value] of Object.entries(metadata)) {
		if (value instanceof Error) {
			processed[key] = {
				name: value.name,
				message: value.message,
				stack: value.stack,
			};
		} else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
			// Recursively process nested objects to handle nested errors
			processed[key] = processNestedForErrors(value);
		} else {
			processed[key] = value;
		}
	}

	// Apply redaction if enabled (enabled defaults to true when redactionConfig is provided)
	if (redactionConfig && redactionConfig.enabled !== false) {
		const allPatterns = [
			...(redactionConfig.patterns ?? []),
			...(globalRedactionConfig.patterns ?? []),
		];
		const allKeys = [...(redactionConfig.keys ?? []), ...(globalRedactionConfig.keys ?? [])];
		const replacement = redactionConfig.replacement ?? "[REDACTED]";

		return redactValue(processed, allKeys, allPatterns, replacement) as Record<string, unknown>;
	}

	return processed;
}

/**
 * Recursively process nested objects to serialize errors.
 */
function processNestedForErrors(obj: object): unknown {
	if (obj instanceof Error) {
		return {
			name: obj.name,
			message: obj.message,
			stack: obj.stack,
		};
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => {
			if (item !== null && typeof item === "object") {
				return processNestedForErrors(item);
			}
			return item;
		});
	}

	const result: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value instanceof Error) {
			result[key] = {
				name: value.name,
				message: value.message,
				stack: value.stack,
			};
		} else if (value !== null && typeof value === "object") {
			result[key] = processNestedForErrors(value);
		} else {
			result[key] = value;
		}
	}
	return result;
}

// ============================================================================
// Logger Implementation
// ============================================================================

/**
 * Internal logger implementation.
 */
interface InternalLoggerState {
	name: string;
	level: LogLevel;
	context: Record<string, unknown>;
	sinks: Sink[];
	redaction: RedactionConfig | undefined;
}

/**
 * Create a logger instance from internal state.
 */
function createLoggerFromState(state: InternalLoggerState): LoggerInstance {
	const log = (
		level: Exclude<LogLevel, "silent">,
		message: string,
		metadata?: Record<string, unknown>,
	): void => {
		if (!shouldLog(level, state.level)) return;

		const processedMetadata = processMetadata({ ...state.context, ...metadata }, state.redaction);
		const record: LogRecord = {
			timestamp: Date.now(),
			level,
			category: state.name,
			message,
			...(processedMetadata !== undefined ? { metadata: processedMetadata } : {}),
		};

		// Write to all sinks
		for (const sink of state.sinks) {
			try {
				let formatted: string | undefined;
				if (sink.formatter) {
					formatted = sink.formatter.format(record);
				}
				sink.write(record, formatted);
			} catch {
				// Sink errors should not crash the logger
			}
		}
	};

	return {
		trace: (message, metadata) => log("trace", message, metadata),
		debug: (message, metadata) => log("debug", message, metadata),
		info: (message, metadata) => log("info", message, metadata),
		warn: (message, metadata) => log("warn", message, metadata),
		error: (message, metadata) => log("error", message, metadata),
		fatal: (message, metadata) => log("fatal", message, metadata),
		getContext: () => ({ ...state.context }),
		setLevel: (level) => {
			state.level = level;
		},
		addSink: (sink) => {
			state.sinks.push(sink);
			registeredSinks.add(sink);
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
	const state: InternalLoggerState = {
		name: config.name,
		level: config.level ?? "info",
		context: config.context ?? {},
		sinks: [...(config.sinks ?? [])],
		redaction: config.redaction,
	};

	// Register sinks globally for flush()
	for (const sink of state.sinks) {
		registeredSinks.add(sink);
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
	context: Record<string, unknown>,
): LoggerInstance {
	// Access the parent's internal state through its public API
	const parentContext = parent.getContext();

	// Merge parent context with child context
	const mergedContext = { ...parentContext, ...context };

	// Create child logger that delegates to parent but with merged context
	return {
		trace: (message, metadata) => parent.trace(message, { ...context, ...metadata }),
		debug: (message, metadata) => parent.debug(message, { ...context, ...metadata }),
		info: (message, metadata) => parent.info(message, { ...context, ...metadata }),
		warn: (message, metadata) => parent.warn(message, { ...context, ...metadata }),
		error: (message, metadata) => parent.error(message, { ...context, ...metadata }),
		fatal: (message, metadata) => parent.fatal(message, { ...context, ...metadata }),
		getContext: () => mergedContext,
		setLevel: (level) => parent.setLevel(level),
		addSink: (sink) => parent.addSink(sink),
	};
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
	return {
		format(record: LogRecord): string {
			const { timestamp, level, category, message, metadata } = record;
			const output: Record<string, unknown> = {
				timestamp,
				level,
				category,
				message,
				...metadata,
			};
			return JSON.stringify(output);
		},
	};
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
export function createPrettyFormatter(options?: PrettyFormatterOptions): Formatter {
	const useColors = options?.colors ?? false;
	const showTimestamp = options?.timestamp ?? true;

	const ANSI = {
		reset: "\u001b[0m",
		dim: "\u001b[2m",
		yellow: "\u001b[33m",
		red: "\u001b[31m",
		cyan: "\u001b[36m",
		green: "\u001b[32m",
		magenta: "\u001b[35m",
	};

	const levelColors: Record<Exclude<LogLevel, "silent">, string> = {
		trace: ANSI.dim,
		debug: ANSI.cyan,
		info: ANSI.green,
		warn: ANSI.yellow,
		error: ANSI.red,
		fatal: ANSI.magenta,
	};

	return {
		format(record: LogRecord): string {
			const { timestamp, level, category, message, metadata } = record;
			const isoTime = new Date(timestamp).toISOString();
			const levelUpper = level.toUpperCase();

			let output = "";

			if (showTimestamp) {
				output += `${isoTime} `;
			}

			if (useColors) {
				const color = levelColors[level];
				output += `${color}[${levelUpper}]${ANSI.reset} `;
			} else {
				output += `[${levelUpper}] `;
			}

			output += `${category}: ${message}`;

			if (metadata && Object.keys(metadata).length > 0) {
				output += ` ${JSON.stringify(metadata)}`;
			}

			return output;
		},
	};
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
	const formatter = createPrettyFormatter({ colors: true });

	const sink: Sink = {
		formatter,
		write(record: LogRecord, formatted?: string): void {
			const output = formatted ?? formatter.format(record);
			const outputWithNewline = output.endsWith("\n") ? output : `${output}\n`;

			// info and below go to stdout, warn and above go to stderr
			if (LEVEL_PRIORITY[record.level] >= LEVEL_PRIORITY.warn) {
				process.stderr.write(outputWithNewline);
			} else {
				process.stdout.write(outputWithNewline);
			}
		},
	};

	registeredSinks.add(sink);
	return sink;
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
export function createFileSink(options: FileSinkOptions): Sink {
	const formatter = createJsonFormatter();
	const buffer: string[] = [];
	const { path } = options;
	// append defaults to true
	const append = options.append ?? true;

	// Clear file synchronously if not appending to prevent race with flush()
	if (!append) {
		writeFileSync(path, "");
	}

	const sink: Sink = {
		formatter,
		write(record: LogRecord, formatted?: string): void {
			const output = formatted ?? formatter.format(record);
			const outputWithNewline = output.endsWith("\n") ? output : `${output}\n`;
			buffer.push(outputWithNewline);
		},
		async flush(): Promise<void> {
			if (buffer.length > 0) {
				const content = buffer.join("");
				buffer.length = 0;

				// Append to file
				const file = Bun.file(path);
				const existing = (await file.exists()) ? await file.text() : "";
				await Bun.write(path, existing + content);
			}
		},
	};

	registeredSinks.add(sink);
	return sink;
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
export function configureRedaction(config: GlobalRedactionConfig): void {
	if (config.patterns) {
		globalRedactionConfig.patterns = [
			...(globalRedactionConfig.patterns ?? []),
			...config.patterns,
		];
	}
	if (config.keys) {
		globalRedactionConfig.keys = [...(globalRedactionConfig.keys ?? []), ...config.keys];
	}
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
	const flushPromises: Promise<void>[] = [];

	for (const sink of registeredSinks) {
		if (sink.flush) {
			flushPromises.push(sink.flush());
		}
	}

	await Promise.all(flushPromises);
}
