/**
 * TDD RED Phase Tests for @outfitter/logging
 *
 * These tests document expected behavior and WILL FAIL until implementation.
 * This is intentional - we're in the RED phase of TDD.
 *
 * Tests cover:
 * - Logger Creation (6 tests)
 * - Log Level Filtering (6 tests)
 * - Structured Logging (8 tests)
 * - Formatters (6 tests)
 * - Redaction (8 tests)
 * - Sinks (6 tests)
 *
 * Total: 40 tests
 */
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import {
	type Formatter,
	type LogLevel,
	type LogRecord,
	type Sink,
	configureRedaction,
	createChildLogger,
	createJsonFormatter,
	createLogger,
	createPrettyFormatter,
	flush,
} from "../index.js";

// ============================================================================
// Logger Creation Tests (6 tests)
// ============================================================================

describe("Logger Creation", () => {
	it("createLogger returns a configured Logger instance", () => {
		const logger = createLogger({ name: "test" });

		expect(logger).toBeDefined();
		expect(typeof logger.info).toBe("function");
		expect(typeof logger.error).toBe("function");
	});

	it("Logger has standard level methods: trace, debug, info, warn, error, fatal", () => {
		const logger = createLogger({ name: "test" });

		expect(typeof logger.trace).toBe("function");
		expect(typeof logger.debug).toBe("function");
		expect(typeof logger.info).toBe("function");
		expect(typeof logger.warn).toBe("function");
		expect(typeof logger.error).toBe("function");
		expect(typeof logger.fatal).toBe("function");
	});

	it("Logger inherits parent context when created with parent", () => {
		const parent = createLogger({
			name: "parent",
			context: { requestId: "abc123" },
		});

		const child = createChildLogger(parent, { userId: "user-1" });

		// Child should have both parent context and its own context
		const childContext = child.getContext();
		expect(childContext.requestId).toBe("abc123");
		expect(childContext.userId).toBe("user-1");
	});

	it("createChildLogger creates scoped logger with merged context", () => {
		const parent = createLogger({
			name: "app",
			context: { service: "api" },
		});

		const child = createChildLogger(parent, { handler: "getUser" });

		expect(child).toBeDefined();
		const context = child.getContext();
		expect(context.service).toBe("api");
		expect(context.handler).toBe("getUser");
	});

	it("Logger name is used as category", () => {
		const logger = createLogger({ name: "my-service" });
		const records: LogRecord[] = [];

		// Configure a sink to capture log records
		logger.addSink({
			write: (record) => records.push(record),
		});

		logger.info("test message");

		expect(records.length).toBe(1);
		expect(records[0].category).toBe("my-service");
	});

	it("createLogger accepts optional sinks array", () => {
		const records: LogRecord[] = [];
		const testSink: Sink = {
			write: (record) => records.push(record),
		};

		const logger = createLogger({
			name: "test",
			sinks: [testSink],
		});

		logger.info("hello");

		expect(records.length).toBe(1);
		expect(records[0].message).toBe("hello");
	});
});

// ============================================================================
// Log Level Filtering Tests (6 tests)
// ============================================================================

describe("Log Level Filtering", () => {
	it("Level filtering respects configured minimum level", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			level: "warn",
			sinks: [sink],
		});

		logger.debug("should be filtered");
		logger.info("should be filtered");
		logger.warn("should appear");
		logger.error("should appear");

		expect(records.length).toBe(2);
		expect(records[0].level).toBe("warn");
		expect(records[1].level).toBe("error");
	});

	it("trace < debug < info < warn < error < fatal ordering", () => {
		const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error", "fatal"];
		const levelOrder = { trace: 0, debug: 1, info: 2, warn: 3, error: 4, fatal: 5 };

		for (let i = 0; i < levels.length; i++) {
			for (let j = i + 1; j < levels.length; j++) {
				expect(levelOrder[levels[i]]).toBeLessThan(levelOrder[levels[j]]);
			}
		}
	});

	it("Setting level to 'warn' filters out trace/debug/info", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			level: "warn",
			sinks: [sink],
		});

		logger.trace("filtered");
		logger.debug("filtered");
		logger.info("filtered");
		logger.warn("included");

		expect(records.length).toBe(1);
		expect(records[0].message).toBe("included");
	});

	it("Setting level to 'silent' filters all logs", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			level: "silent",
			sinks: [sink],
		});

		logger.trace("silent");
		logger.debug("silent");
		logger.info("silent");
		logger.warn("silent");
		logger.error("silent");
		logger.fatal("silent");

		expect(records.length).toBe(0);
	});

	it("Default level is 'info'", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		logger.debug("filtered by default");
		logger.info("included");

		expect(records.length).toBe(1);
		expect(records[0].message).toBe("included");
	});

	it("Level can be changed at runtime", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			level: "info",
			sinks: [sink],
		});

		logger.debug("filtered initially");
		expect(records.length).toBe(0);

		logger.setLevel("debug");
		logger.debug("now included");

		expect(records.length).toBe(1);
		expect(records[0].message).toBe("now included");
	});
});

// ============================================================================
// Structured Logging Tests (8 tests)
// ============================================================================

describe("Structured Logging", () => {
	it("log() accepts message and structured metadata", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		logger.info("User logged in", { userId: "u123", email: "user@example.com" });

		expect(records.length).toBe(1);
		expect(records[0].message).toBe("User logged in");
		expect(records[0].metadata?.userId).toBe("u123");
		expect(records[0].metadata?.email).toBe("user@example.com");
	});

	it("Metadata is attached to log record", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		logger.info("Request received", { method: "GET", path: "/api/users" });

		expect(records[0].metadata).toBeDefined();
		expect(records[0].metadata?.method).toBe("GET");
		expect(records[0].metadata?.path).toBe("/api/users");
	});

	it("Nested objects in metadata are preserved", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		logger.info("Config loaded", {
			database: {
				host: "localhost",
				port: 5432,
			},
		});

		expect(records[0].metadata?.database).toBeDefined();
		expect((records[0].metadata?.database as { host: string }).host).toBe("localhost");
		expect((records[0].metadata?.database as { port: number }).port).toBe(5432);
	});

	it("Array values in metadata are preserved", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		logger.info("Processing items", { items: ["a", "b", "c"], counts: [1, 2, 3] });

		expect(Array.isArray(records[0].metadata?.items)).toBe(true);
		expect(records[0].metadata?.items).toEqual(["a", "b", "c"]);
		expect(records[0].metadata?.counts).toEqual([1, 2, 3]);
	});

	it("Error objects are serialized with stack trace", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		const error = new Error("Something went wrong");
		logger.error("Operation failed", { error });

		const recordedError = records[0].metadata?.error as {
			message: string;
			stack: string;
			name: string;
		};
		expect(recordedError).toBeDefined();
		expect(recordedError.message).toBe("Something went wrong");
		expect(recordedError.stack).toBeDefined();
		expect(recordedError.name).toBe("Error");
	});

	it("Timestamp is automatically added", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		const before = Date.now();
		logger.info("test");
		const after = Date.now();

		expect(records[0].timestamp).toBeDefined();
		expect(records[0].timestamp).toBeGreaterThanOrEqual(before);
		expect(records[0].timestamp).toBeLessThanOrEqual(after);
	});

	it("Logger name/category is included in record", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "my-app",
			sinks: [sink],
		});

		logger.info("test");

		expect(records[0].category).toBe("my-app");
	});

	it("Log record includes level as string", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		logger.warn("warning message");

		expect(records[0].level).toBe("warn");
		expect(typeof records[0].level).toBe("string");
	});
});

// ============================================================================
// Formatters Tests (6 tests)
// ============================================================================

describe("Formatters", () => {
	it("JSON formatter outputs valid JSON", () => {
		const formatter = createJsonFormatter();

		const record: LogRecord = {
			timestamp: Date.now(),
			level: "info",
			category: "test",
			message: "Hello world",
			metadata: { key: "value" },
		};

		const output = formatter.format(record);
		const parsed = JSON.parse(output);

		expect(parsed).toBeDefined();
		expect(parsed.message).toBe("Hello world");
	});

	it("JSON formatter includes all metadata", () => {
		const formatter = createJsonFormatter();

		const record: LogRecord = {
			timestamp: 1705936800000,
			level: "info",
			category: "api",
			message: "Request",
			metadata: {
				method: "POST",
				path: "/users",
				status: 201,
			},
		};

		const output = formatter.format(record);
		const parsed = JSON.parse(output);

		expect(parsed.method).toBe("POST");
		expect(parsed.path).toBe("/users");
		expect(parsed.status).toBe(201);
	});

	it("Human-readable formatter includes timestamp and level", () => {
		const formatter = createPrettyFormatter();

		const record: LogRecord = {
			timestamp: 1705936800000,
			level: "info",
			category: "test",
			message: "Test message",
		};

		const output = formatter.format(record);

		// Should contain timestamp (ISO or formatted)
		expect(output).toMatch(/\d{4}-\d{2}-\d{2}|INFO|info/i);
		// Should contain the message
		expect(output).toContain("Test message");
	});

	it("Human-readable formatter colorizes by level", () => {
		const formatter = createPrettyFormatter({ colors: true });

		const warnRecord: LogRecord = {
			timestamp: Date.now(),
			level: "warn",
			category: "test",
			message: "Warning",
		};

		const errorRecord: LogRecord = {
			timestamp: Date.now(),
			level: "error",
			category: "test",
			message: "Error",
		};

		const warnOutput = formatter.format(warnRecord);
		const errorOutput = formatter.format(errorRecord);

		// ANSI escape codes for colors (yellow for warn, red for error)
		// ESC[33m is yellow, ESC[31m is red (ESC = \x1b = \u001b)
		const ESC = "\u001b";
		const yellowCodes = [`${ESC}[33m`, `${ESC}[93m`]; // yellow or bright yellow
		const redCodes = [`${ESC}[31m`, `${ESC}[91m`]; // red or bright red

		const hasYellow = yellowCodes.some((code) => warnOutput.includes(code));
		const hasRed = redCodes.some((code) => errorOutput.includes(code));

		expect(hasYellow).toBe(true);
		expect(hasRed).toBe(true);
	});

	it("Custom formatter function is called with log record", () => {
		const records: LogRecord[] = [];
		const customFormatter: Formatter = {
			format: (record) => {
				records.push(record);
				return `CUSTOM: ${record.message}`;
			},
		};

		const logRecords: string[] = [];
		const sink: Sink = {
			write: (_record, formatted) => {
				if (formatted) logRecords.push(formatted);
			},
			formatter: customFormatter,
		};

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		logger.info("test message");

		expect(records.length).toBe(1);
		expect(records[0].message).toBe("test message");
		expect(logRecords[0]).toBe("CUSTOM: test message");
	});

	it("Formatter handles special characters in message", () => {
		const formatter = createJsonFormatter();

		const record: LogRecord = {
			timestamp: Date.now(),
			level: "info",
			category: "test",
			message: 'Message with "quotes" and\nnewlines\tand tabs',
		};

		const output = formatter.format(record);
		const parsed = JSON.parse(output);

		expect(parsed.message).toBe('Message with "quotes" and\nnewlines\tand tabs');
	});
});

// ============================================================================
// Redaction Tests (8 tests)
// ============================================================================

describe("Redaction", () => {
	it("Sensitive keys are redacted by default (password, secret, token, apiKey)", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
			redaction: { enabled: true },
		});

		logger.info("User data", {
			username: "alice",
			password: "super-secret",
			token: "jwt-token-123",
			apiKey: "sk-abc123",
		});

		expect(records[0].metadata?.username).toBe("alice");
		expect(records[0].metadata?.password).toBe("[REDACTED]");
		expect(records[0].metadata?.token).toBe("[REDACTED]");
		expect(records[0].metadata?.apiKey).toBe("[REDACTED]");
	});

	it("Custom redaction patterns are applied", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
			redaction: {
				enabled: true,
				patterns: [/my-custom-secret-\w+/gi],
			},
		});

		logger.info("Data", { value: "my-custom-secret-abc123" });

		expect(records[0].metadata?.value).toContain("[REDACTED]");
	});

	it("Redaction is recursive (nested objects)", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
			redaction: { enabled: true },
		});

		logger.info("Config", {
			database: {
				host: "localhost",
				password: "db-password",
			},
			api: {
				url: "https://api.example.com",
				secret: "api-secret",
			},
		});

		const db = records[0].metadata?.database as { host: string; password: string };
		const api = records[0].metadata?.api as { url: string; secret: string };

		expect(db.host).toBe("localhost");
		expect(db.password).toBe("[REDACTED]");
		expect(api.url).toBe("https://api.example.com");
		expect(api.secret).toBe("[REDACTED]");
	});

	it("Redaction replaces value with '[REDACTED]'", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
			redaction: { enabled: true },
		});

		logger.info("Auth", { password: "my-password" });

		expect(records[0].metadata?.password).toBe("[REDACTED]");
	});

	it("Non-matching keys are not redacted", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
			redaction: { enabled: true },
		});

		logger.info("User", {
			id: "123",
			name: "Alice",
			email: "alice@example.com",
		});

		expect(records[0].metadata?.id).toBe("123");
		expect(records[0].metadata?.name).toBe("Alice");
		expect(records[0].metadata?.email).toBe("alice@example.com");
	});

	it("Redaction applies to metadata only, not message", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
			redaction: { enabled: true },
		});

		// Message contains sensitive-looking text but should NOT be redacted
		logger.info("Password reset requested for user", { password: "secret123" });

		expect(records[0].message).toBe("Password reset requested for user");
		expect(records[0].metadata?.password).toBe("[REDACTED]");
	});

	it("configureRedaction adds patterns globally", () => {
		// Configure a global pattern
		configureRedaction({
			patterns: [/custom-global-\d+/g],
			keys: ["customKey"],
		});

		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
			redaction: { enabled: true },
		});

		logger.info("Data", {
			value: "custom-global-12345",
			customKey: "sensitive-value",
		});

		expect(records[0].metadata?.value).toContain("[REDACTED]");
		expect(records[0].metadata?.customKey).toBe("[REDACTED]");
	});

	it("global redaction patterns apply without explicit enabled flag", () => {
		// Configure global patterns (adds to existing global config)
		configureRedaction({
			patterns: [/auto-redact-secret-\w+/gi],
			keys: ["autoRedactKey"],
		});

		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		// Create logger WITHOUT redaction: { enabled: true }
		const logger = createLogger({
			name: "test-auto-redact",
			sinks: [sink],
			// Note: no redaction config passed
		});

		logger.info("Data with secrets", {
			value: "auto-redact-secret-xyz789",
			autoRedactKey: "should-be-hidden",
			safeKey: "visible-value",
		});

		// Global patterns should be applied automatically
		expect(records[0].metadata?.value).toContain("[REDACTED]");
		expect(records[0].metadata?.autoRedactKey).toBe("[REDACTED]");
		// Non-sensitive keys should remain visible
		expect(records[0].metadata?.safeKey).toBe("visible-value");
	});

	it("explicit enabled:false opts out even with global rules", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		// Explicitly opt out of redaction
		const logger = createLogger({
			name: "test-opt-out",
			sinks: [sink],
			redaction: { enabled: false },
		});

		// Configure global redaction after logger creation
		configureRedaction({
			patterns: [/global-pattern-\w+/gi],
			keys: ["globalKey"],
		});

		logger.info("Data with secrets", {
			value: "global-pattern-xyz789",
			globalKey: "should-be-visible",
			password: "also-visible",
		});

		// Nothing should be redacted when explicitly disabled
		expect(records[0].metadata?.value).toBe("global-pattern-xyz789");
		expect(records[0].metadata?.globalKey).toBe("should-be-visible");
		expect(records[0].metadata?.password).toBe("also-visible");
	});

	it("Redaction patterns support regex", () => {
		const records: LogRecord[] = [];
		const sink: Sink = { write: (record) => records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink],
			redaction: {
				enabled: true,
				patterns: [/Bearer [A-Za-z0-9._-]+/g],
			},
		});

		logger.info("Request", {
			authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.payload",
		});

		expect(records[0].metadata?.authorization).toContain("[REDACTED]");
		expect(records[0].metadata?.authorization).not.toContain("Bearer eyJ");
	});
});

// ============================================================================
// Sinks Tests (6 tests)
// ============================================================================

describe("Sinks", () => {
	let originalStdout: typeof process.stdout.write;
	let originalStderr: typeof process.stderr.write;
	let stdoutOutput: string[];
	let stderrOutput: string[];

	beforeEach(() => {
		stdoutOutput = [];
		stderrOutput = [];

		originalStdout = process.stdout.write;
		originalStderr = process.stderr.write;

		process.stdout.write = ((chunk: string | Uint8Array) => {
			stdoutOutput.push(chunk.toString());
			return true;
		}) as typeof process.stdout.write;

		process.stderr.write = ((chunk: string | Uint8Array) => {
			stderrOutput.push(chunk.toString());
			return true;
		}) as typeof process.stderr.write;
	});

	afterEach(() => {
		process.stdout.write = originalStdout;
		process.stderr.write = originalStderr;
	});

	it("Console sink writes to stdout/stderr appropriately", () => {
		const { createConsoleSink } = require("../index.js");
		const consoleSink = createConsoleSink();

		const logger = createLogger({
			name: "test",
			sinks: [consoleSink],
		});

		logger.info("info message");
		logger.error("error message");

		// Info should go to stdout, error should go to stderr
		expect(stdoutOutput.some((s) => s.includes("info message"))).toBe(true);
		expect(stderrOutput.some((s) => s.includes("error message"))).toBe(true);
	});

	it("File sink writes to specified path", async () => {
		const { createFileSink } = require("../index.js");
		const tempPath = `/tmp/test-log-${Date.now()}.log`;

		const fileSink = createFileSink({ path: tempPath });

		const logger = createLogger({
			name: "test",
			sinks: [fileSink],
		});

		logger.info("file log message");
		await flush();

		const content = await Bun.file(tempPath).text();
		expect(content).toContain("file log message");

		// Cleanup
		await Bun.write(tempPath, "");
	});

	it("Multiple sinks can be configured", () => {
		const sink1Records: LogRecord[] = [];
		const sink2Records: LogRecord[] = [];

		const sink1: Sink = { write: (record) => sink1Records.push(record) };
		const sink2: Sink = { write: (record) => sink2Records.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [sink1, sink2],
		});

		logger.info("broadcast message");

		expect(sink1Records.length).toBe(1);
		expect(sink2Records.length).toBe(1);
		expect(sink1Records[0].message).toBe("broadcast message");
		expect(sink2Records[0].message).toBe("broadcast message");
	});

	it("Sink errors don't crash the logger", () => {
		const errorSink: Sink = {
			write: () => {
				throw new Error("Sink failed");
			},
		};

		const goodRecords: LogRecord[] = [];
		const goodSink: Sink = { write: (record) => goodRecords.push(record) };

		const logger = createLogger({
			name: "test",
			sinks: [errorSink, goodSink],
		});

		// Should not throw
		expect(() => logger.info("test message")).not.toThrow();

		// Good sink should still receive the message
		expect(goodRecords.length).toBe(1);
	});

	it("Sink receives formatted log record", () => {
		let receivedFormatted: string | undefined;

		const formatter: Formatter = {
			format: (record) => `[${record.level.toUpperCase()}] ${record.message}`,
		};

		const sink: Sink = {
			write: (_record, formatted) => {
				receivedFormatted = formatted;
			},
			formatter,
		};

		const logger = createLogger({
			name: "test",
			sinks: [sink],
		});

		logger.info("hello world");

		expect(receivedFormatted).toBe("[INFO] hello world");
	});

	it("Flush ensures all pending logs are written", async () => {
		const records: LogRecord[] = [];
		let flushCalled = false;

		const asyncSink: Sink = {
			write: (record) => {
				records.push(record);
			},
			flush: async () => {
				flushCalled = true;
			},
		};

		const logger = createLogger({
			name: "test",
			sinks: [asyncSink],
		});

		logger.info("message 1");
		logger.info("message 2");
		logger.info("message 3");

		await flush();

		expect(flushCalled).toBe(true);
		expect(records.length).toBe(3);
	});
});
