/**
 * @outfitter/testing - Mock Factories Test Suite
 */

import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { createTestConfig, createTestContext, createTestLogger } from "../mock-factories.js";

describe("createTestLogger()", () => {
	it("captures log entries and merges context", () => {
		const logger = createTestLogger({ requestId: "req-1" });
		logger.info("hello", { user: "alice" });

		expect(logger.logs).toHaveLength(1);
		expect(logger.logs[0]).toEqual({
			level: "info",
			message: "hello",
			data: { requestId: "req-1", user: "alice" },
		});
	});

	it("shares logs across child loggers", () => {
		const logger = createTestLogger({ requestId: "req-1" });
		const child = logger.child({ operation: "test" });
		child.debug("child log");

		expect(logger.logs).toHaveLength(1);
		expect(logger.logs[0]?.data).toEqual({ requestId: "req-1", operation: "test" });
	});
});

describe("createTestConfig()", () => {
	it("validates schema and provides accessors", () => {
		const Schema = z.object({
			database: z.object({
				path: z.string().default(":memory:"),
			}),
			mode: z.string().default("dev"),
		});

		const config = createTestConfig(Schema, { database: { path: ":memory:" } });

		expect(config.get<string>("database.path")).toBe(":memory:");
		expect(config.get<string>("mode")).toBe("dev");
		expect(() => config.getRequired("missing")).toThrow();
	});
});

describe("createTestContext()", () => {
	it("creates a handler context with defaults", () => {
		const ctx = createTestContext();
		expect(ctx.requestId).toBeDefined();
		expect(ctx.logger).toBeDefined();
		expect(ctx.cwd).toBe(process.cwd());
		expect(ctx.env).toBeDefined();
	});

	it("respects overrides", () => {
		const ctx = createTestContext({ requestId: "req-123" });
		expect(ctx.requestId).toBe("req-123");
	});
});
