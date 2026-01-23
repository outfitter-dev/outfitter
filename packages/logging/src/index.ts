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
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal" | "silent";

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
	/** Unix timestamp in milliseconds when the log was created */
	timestamp: number;

	/** Severity level of the log (excludes "silent" which is only for filtering) */
	level: Exclude<LogLevel, "silent">;

	/** Logger category/name identifying the source (e.g., "my-service", "api") */
	category: string;

	/** Human-readable log message describing the event */
	message: string;

	/** Optional structured metadata attached to the log for additional context */
	metadata?: Record<string, unknown>;
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
	 * Write a log record to the sink's destination.
	 *
	 * @param record - The log record to write
	 * @param formatted - Optional pre-formatted string from the sink's formatter
	 */
	write(record: LogRecord, formatted?: string): void;

	/** Optional formatter specific to this sink for converting records to strings */
	formatter?: Formatter;

	/**
	 * Optional async flush to ensure all pending/buffered writes complete.
	 * Called by the global `flush()` function before process exit.
	 *
	 * @returns Promise that resolves when all pending writes are complete
	 */
	flush?(): Promise<void>;
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

	/** Additional regex patterns to match and redact within string values */
	patterns?: RegExp[];

	/** Additional key names whose values should be fully redacted (case-insensitive) */
	keys?: string[];

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
	/** Logger name used as the category in log records */
	name: string;

	/**
	 * Minimum log level to output. Messages below this level are filtered.
	 * @defaultValue "info"
	 */
	level?: LogLevel;

	/** Initial context metadata attached to all log records from this logger */
	context?: Record<string, unknown>;

	/** Array of sinks to output log records to */
	sinks?: Sink[];

	/** Redaction configuration for sensitive data scrubbing */
	redaction?: RedactionConfig;
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
export interface LoggerInstance {
	/**
	 * Log at trace level (most verbose, for detailed debugging).
	 * @param message - Human-readable log message
	 * @param metadata - Optional structured metadata
	 */
	trace(message: string, metadata?: Record<string, unknown>): void;

	/**
	 * Log at debug level (development debugging).
	 * @param message - Human-readable log message
	 * @param metadata - Optional structured metadata
	 */
	debug(message: string, metadata?: Record<string, unknown>): void;

	/**
	 * Log at info level (normal operations).
	 * @param message - Human-readable log message
	 * @param metadata - Optional structured metadata
	 */
	info(message: string, metadata?: Record<string, unknown>): void;

	/**
	 * Log at warn level (unexpected but handled situations).
	 * @param message - Human-readable log message
	 * @param metadata - Optional structured metadata
	 */
	warn(message: string, metadata?: Record<string, unknown>): void;

	/**
	 * Log at error level (failures requiring attention).
	 * @param message - Human-readable log message
	 * @param metadata - Optional structured metadata
	 */
	error(message: string, metadata?: Record<string, unknown>): void;

	/**
	 * Log at fatal level (unrecoverable failures).
	 * @param message - Human-readable log message
	 * @param metadata - Optional structured metadata
	 */
	fatal(message: string, metadata?: Record<string, unknown>): void;

	/**
	 * Get the current context metadata attached to this logger.
	 * @returns Copy of the logger's context object
	 */
	getContext(): Record<string, unknown>;

	/**
	 * Set the minimum log level at runtime.
	 * @param level - New minimum level (messages below this are filtered)
	 */
	setLevel(level: LogLevel): void;

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
	/** Absolute path to the log file */
	path: string;

	/**
	 * Append to existing file or truncate on start.
	 * @defaultValue true
	 */
	append?: boolean;
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
	/** Regex patterns to match and redact within string values (applied globally) */
	patterns?: RegExp[];

	/** Key names whose values should be fully redacted (case-insensitive, applied globally) */
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

/**
 * Default patterns for redacting secrets from log messages.
 * Applied to message strings and stringified metadata values.
 *
 * Patterns include:
 * - Bearer tokens (Authorization headers)
 * - API key patterns (api_key=xxx, apikey: xxx)
 * - GitHub Personal Access Tokens (ghp_xxx)
 * - GitHub OAuth tokens (gho_xxx)
 * - GitHub App tokens (ghs_xxx)
 * - GitHub refresh tokens (ghr_xxx)
 * - PEM-encoded private keys
 *
 * @example
 * ```typescript
 * import { DEFAULT_PATTERNS } from "@outfitter/logging";
 *
 * // Use with custom logger configuration
 * const logger = createLogger({
 *   name: "app",
 *   redaction: {
 *     enabled: true,
 *     patterns: [...DEFAULT_PATTERNS, /my-custom-secret-\w+/gi],
 *   },
 * });
 * ```
 */
export const DEFAULT_PATTERNS: RegExp[] = [
	/Bearer\s+[A-Za-z0-9\-_.~+/]+=*/gi, // Bearer tokens
	/(?:api[_-]?key|apikey)[=:]\s*["']?[A-Za-z0-9\-_.]+["']?/gi, // API keys
	/ghp_[A-Za-z0-9]{36}/g, // GitHub PATs
	/gho_[A-Za-z0-9]{36}/g, // GitHub OAuth tokens
	/ghs_[A-Za-z0-9]{36}/g, // GitHub App tokens
	/ghr_[A-Za-z0-9]{36}/g, // GitHub refresh tokens
	/-----BEGIN[\s\S]*?PRIVATE\s*KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE\s*KEY-----/gi, // PEM keys
];

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

	// Honor explicit opt-out even with global rules
	if (redactionConfig?.enabled === false) {
		return processed;
	}

	// Check if global redaction rules exist
	const hasGlobalRules =
		(globalRedactionConfig.patterns?.length ?? 0) > 0 ||
		(globalRedactionConfig.keys?.length ?? 0) > 0;

	// Apply redaction if:
	// 1. redactionConfig is provided and enabled !== false, OR
	// 2. Global redaction rules exist (patterns or keys)
	if (redactionConfig || hasGlobalRules) {
		const allPatterns = [
			...DEFAULT_PATTERNS,
			...(redactionConfig?.patterns ?? []),
			...(globalRedactionConfig.patterns ?? []),
		];
		const allKeys = [...(redactionConfig?.keys ?? []), ...(globalRedactionConfig.keys ?? [])];
		const replacement = redactionConfig?.replacement ?? "[REDACTED]";

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

		const record: LogRecord = {
			timestamp: Date.now(),
			level,
			category: state.name,
			message: processedMessage,
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
		child: (context) => {
			// Create child logger with merged context (child takes precedence)
			const childState: InternalLoggerState = {
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
	const childLogger: LoggerInstance = {
		trace: (message, metadata) => parent.trace(message, { ...context, ...metadata }),
		debug: (message, metadata) => parent.debug(message, { ...context, ...metadata }),
		info: (message, metadata) => parent.info(message, { ...context, ...metadata }),
		warn: (message, metadata) => parent.warn(message, { ...context, ...metadata }),
		error: (message, metadata) => parent.error(message, { ...context, ...metadata }),
		fatal: (message, metadata) => parent.fatal(message, { ...context, ...metadata }),
		getContext: () => mergedContext,
		setLevel: (level) => parent.setLevel(level),
		addSink: (sink) => parent.addSink(sink),
		child: (newContext) => createChildLogger(childLogger, newContext),
	};
	return childLogger;
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
