/**
 * @outfitter/testing - Mock Factories
 *
 * Helpers for creating test contexts, loggers, and configs.
 *
 * @packageDocumentation
 */

import {
	generateRequestId,
	type HandlerContext,
	type Logger,
	type ResolvedConfig,
} from "@outfitter/contracts";
import type { z } from "zod";

// ============================================================================
// Types
// ============================================================================

export interface LogEntry {
	level: "trace" | "debug" | "info" | "warn" | "error" | "fatal";
	message: string;
	data?: Record<string, unknown>;
}

export interface TestLogger extends Logger {
	/** Captured log entries for assertions */
	logs: LogEntry[];
	/** Clear captured logs */
	clear(): void;
}

// ============================================================================
// Logger Factory
// ============================================================================

export function createTestLogger(context: Record<string, unknown> = {}): TestLogger {
	return createTestLoggerWithContext(context, []);
}

function createTestLoggerWithContext(
	context: Record<string, unknown>,
	logs: LogEntry[],
): TestLogger {
	const write = (level: LogEntry["level"], message: string, data?: Record<string, unknown>) => {
		const merged = { ...context, ...(data ?? {}) };
		const entry: LogEntry = {
			level,
			message,
		};

		if (Object.keys(merged).length > 0) {
			entry.data = merged;
		}

		logs.push(entry);
	};

	return {
		logs,
		clear() {
			logs.length = 0;
		},
		trace(message, metadata) {
			write("trace", message, metadata);
		},
		debug(message, metadata) {
			write("debug", message, metadata);
		},
		info(message, metadata) {
			write("info", message, metadata);
		},
		warn(message, metadata) {
			write("warn", message, metadata);
		},
		error(message, metadata) {
			write("error", message, metadata);
		},
		fatal(message, metadata) {
			write("fatal", message, metadata);
		},
		child(childContext) {
			return createTestLoggerWithContext({ ...context, ...childContext }, logs);
		},
	};
}

// ============================================================================
// Config Factory
// ============================================================================

export function createTestConfig<T>(schema: z.ZodType<T>, values: Partial<T>): ResolvedConfig {
	const parsed = schema.safeParse(values);
	let data: T;
	if (parsed.success) {
		data = parsed.data;
	} else {
		const maybePartial = (schema as unknown as { partial?: () => z.ZodType<Partial<T>> }).partial;
		if (typeof maybePartial !== "function") {
			throw parsed.error;
		}

		const partialSchema = maybePartial.call(schema);
		const partialParsed = partialSchema.safeParse(values);
		if (!partialParsed.success) {
			throw partialParsed.error;
		}

		data = partialParsed.data as T;
	}

	return {
		get<TValue>(key: string): TValue | undefined {
			return getPath<TValue>(data as Record<string, unknown>, key);
		},
		getRequired<TValue>(key: string): TValue {
			const value = getPath<TValue>(data as Record<string, unknown>, key);
			if (value === undefined) {
				throw new Error(`Missing required config value: ${key}`);
			}
			return value;
		},
	};
}

// ============================================================================
// Context Factory
// ============================================================================

export function createTestContext(overrides: Partial<HandlerContext> = {}): HandlerContext {
	const logger = overrides.logger ?? createTestLogger();
	const requestId = overrides.requestId ?? generateRequestId();

	const context: HandlerContext = {
		requestId,
		logger,
		cwd: overrides.cwd ?? process.cwd(),
		env: overrides.env ?? { ...process.env },
	};

	if (overrides.config !== undefined) {
		context.config = overrides.config;
	}
	if (overrides.signal !== undefined) {
		context.signal = overrides.signal;
	}
	if (overrides.workspaceRoot !== undefined) {
		context.workspaceRoot = overrides.workspaceRoot;
	}

	return context;
}

// ============================================================================
// Helpers
// ============================================================================

function getPath<TValue>(obj: Record<string, unknown>, key: string): TValue | undefined {
	const parts = key.split(".").filter((part) => part.length > 0);
	let current: unknown = obj;
	for (const part of parts) {
		if (current === null || typeof current !== "object") {
			return undefined;
		}
		current = (current as Record<string, unknown>)[part];
	}
	return current as TValue | undefined;
}
