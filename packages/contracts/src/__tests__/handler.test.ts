/**
 * Tests for @outfitter/contracts/handler
 *
 * Tests cover:
 * - Handler type (compile-time)
 * - HandlerContext interface (4 tests)
 * - Logger interface (6 tests)
 *
 * Total: 10 tests
 */
import { describe, expect, it } from "bun:test";
import { Result } from "better-result";
import type { Handler, SyncHandler, HandlerContext, Logger, ResolvedConfig } from "../handler.js";
import { NotFoundError, ValidationError } from "../errors.js";

// ============================================================================
// Handler Type Tests (compile-time verification)
// ============================================================================

describe("Handler type", () => {
	it("enforces Result return type (compile-time)", () => {
		// This test verifies that Handler type compiles correctly
		// A handler MUST return Promise<Result<T, E>>
		const handler: Handler<{ id: string }, { name: string }, NotFoundError> = async (
			input,
			_ctx,
		) => {
			if (input.id === "missing") {
				return Result.err(
					new NotFoundError({
						message: "Resource not found",
						resourceType: "resource",
						resourceId: input.id,
					}),
				);
			}
			return Result.ok({ name: "Found" });
		};

		// Type assertion: handler should be callable
		expect(typeof handler).toBe("function");
	});

	it("SyncHandler enforces Result return without Promise", () => {
		const syncHandler: SyncHandler<{ value: number }, string, ValidationError> = (input, _ctx) => {
			if (input.value < 0) {
				return Result.err(
					new ValidationError({
						message: "Value must be positive",
						field: "value",
					}),
				);
			}
			return Result.ok(`Value: ${input.value}`);
		};

		expect(typeof syncHandler).toBe("function");
	});
});

// ============================================================================
// HandlerContext Tests (4 tests)
// ============================================================================

describe("HandlerContext", () => {
	it("requires requestId property", () => {
		// Create a minimal valid context
		const ctx: HandlerContext = {
			requestId: "test-request-id",
			logger: createMockLogger(),
			cwd: "/test",
			env: {},
		};

		expect(ctx.requestId).toBe("test-request-id");
	});

	it("accepts optional signal property", () => {
		const controller = new AbortController();
		const ctx: HandlerContext = {
			requestId: "test-id",
			signal: controller.signal,
			logger: createMockLogger(),
			cwd: "/test",
			env: {},
		};

		expect(ctx.signal).toBe(controller.signal);
	});

	it("accepts optional logger property", () => {
		const logger = createMockLogger();
		const ctx: HandlerContext = {
			requestId: "test-id",
			logger,
			cwd: "/test",
			env: {},
		};

		expect(ctx.logger).toBe(logger);
	});

	it("accepts optional config property", () => {
		const config: ResolvedConfig = {
			get: <T>(_key: string) => undefined as T | undefined,
			getRequired: <T>(_key: string): T => {
				throw new Error(`Config key not found: ${_key}`);
			},
		};

		const ctx: HandlerContext = {
			requestId: "test-id",
			config,
			logger: createMockLogger(),
			cwd: "/test",
			env: {},
		};

		expect(ctx.config).toBe(config);
	});
});

// ============================================================================
// Logger Interface Tests (4 tests)
// ============================================================================

describe("Logger interface", () => {
	it("has debug method", () => {
		const logger = createMockLogger();
		expect(typeof logger.debug).toBe("function");

		// Should accept message and optional context
		logger.debug("Test message");
		logger.debug("Test with context", { key: "value" });
	});

	it("has info method", () => {
		const logger = createMockLogger();
		expect(typeof logger.info).toBe("function");

		logger.info("Test message");
		logger.info("Test with context", { key: "value" });
	});

	it("has warn method", () => {
		const logger = createMockLogger();
		expect(typeof logger.warn).toBe("function");

		logger.warn("Test message");
		logger.warn("Test with context", { key: "value" });
	});

	it("has error method", () => {
		const logger = createMockLogger();
		expect(typeof logger.error).toBe("function");

		logger.error("Test message");
		logger.error("Test with context", { key: "value" });
	});

	it("has child method that creates derived logger with context", () => {
		const logger = createMockLogger();
		expect(typeof logger.child).toBe("function");

		// Should accept context and return a Logger
		const childLogger = logger.child({ requestId: "abc123" });
		expect(typeof childLogger.debug).toBe("function");
		expect(typeof childLogger.info).toBe("function");
		expect(typeof childLogger.warn).toBe("function");
		expect(typeof childLogger.error).toBe("function");
		expect(typeof childLogger.child).toBe("function");
	});

	it("child logger is composable (can create nested children)", () => {
		const logger = createMockLogger();
		const child1 = logger.child({ service: "auth" });
		const child2 = child1.child({ operation: "login" });

		// Verify child loggers have correct interface
		expect(typeof child2.debug).toBe("function");
		expect(typeof child2.child).toBe("function");
	});
});

// ============================================================================
// Helper Functions
// ============================================================================

function createMockLogger(): Logger {
	const createLogger = (): Logger => ({
		trace: (_message: string, _metadata?: Record<string, unknown>) => {},
		debug: (_message: string, _context?: Record<string, unknown>) => {},
		info: (_message: string, _context?: Record<string, unknown>) => {},
		warn: (_message: string, _context?: Record<string, unknown>) => {},
		error: (_message: string, _context?: Record<string, unknown>) => {},
		fatal: (_message: string, _metadata?: Record<string, unknown>) => {},
		child: (_context: Record<string, unknown>): Logger => createLogger(),
	});
	return createLogger();
}
