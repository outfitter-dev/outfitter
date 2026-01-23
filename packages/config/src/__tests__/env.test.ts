/**
 * Tests for @outfitter/config/env
 *
 * Tests cover:
 * - portSchema (3 tests)
 * - booleanSchema (5 tests)
 * - optionalBooleanSchema (4 tests)
 * - parseEnv (3 tests)
 * - env export (2 tests)
 *
 * Total: 17 tests
 */
import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { booleanSchema, env, optionalBooleanSchema, parseEnv, portSchema } from "../env.js";

// ============================================================================
// portSchema Tests
// ============================================================================

describe("portSchema", () => {
	it("transforms valid port strings to numbers", () => {
		const schema = z.object({ PORT: portSchema });

		expect(schema.parse({ PORT: "3000" })).toEqual({ PORT: 3000 });
		expect(schema.parse({ PORT: "8080" })).toEqual({ PORT: 8080 });
		expect(schema.parse({ PORT: "1" })).toEqual({ PORT: 1 });
		expect(schema.parse({ PORT: "65535" })).toEqual({ PORT: 65535 });
	});

	it("rejects invalid port strings", () => {
		const schema = z.object({ PORT: portSchema });

		expect(() => schema.parse({ PORT: "abc" })).toThrow();
		expect(() => schema.parse({ PORT: "3000a" })).toThrow();
		expect(() => schema.parse({ PORT: "-3000" })).toThrow();
		expect(() => schema.parse({ PORT: "" })).toThrow();
		expect(() => schema.parse({ PORT: "3.14" })).toThrow();
	});

	it("rejects out-of-range ports", () => {
		const schema = z.object({ PORT: portSchema });

		expect(() => schema.parse({ PORT: "0" })).toThrow();
		expect(() => schema.parse({ PORT: "65536" })).toThrow();
		expect(() => schema.parse({ PORT: "99999" })).toThrow();
	});
});

// ============================================================================
// booleanSchema Tests
// ============================================================================

describe("booleanSchema", () => {
	it("transforms 'true' to true", () => {
		const schema = z.object({ FLAG: booleanSchema });
		expect(schema.parse({ FLAG: "true" })).toEqual({ FLAG: true });
	});

	it("transforms '1' to true", () => {
		const schema = z.object({ FLAG: booleanSchema });
		expect(schema.parse({ FLAG: "1" })).toEqual({ FLAG: true });
	});

	it("transforms 'false' to false", () => {
		const schema = z.object({ FLAG: booleanSchema });
		expect(schema.parse({ FLAG: "false" })).toEqual({ FLAG: false });
	});

	it("transforms '0' to false", () => {
		const schema = z.object({ FLAG: booleanSchema });
		expect(schema.parse({ FLAG: "0" })).toEqual({ FLAG: false });
	});

	it("transforms empty string to false", () => {
		const schema = z.object({ FLAG: booleanSchema });
		expect(schema.parse({ FLAG: "" })).toEqual({ FLAG: false });
	});
});

// ============================================================================
// optionalBooleanSchema Tests
// ============================================================================

describe("optionalBooleanSchema", () => {
	it("transforms 'true' and '1' to true", () => {
		const schema = z.object({ FLAG: optionalBooleanSchema });

		expect(schema.parse({ FLAG: "true" })).toEqual({ FLAG: true });
		expect(schema.parse({ FLAG: "1" })).toEqual({ FLAG: true });
	});

	it("transforms 'false' and '0' to false", () => {
		const schema = z.object({ FLAG: optionalBooleanSchema });

		expect(schema.parse({ FLAG: "false" })).toEqual({ FLAG: false });
		expect(schema.parse({ FLAG: "0" })).toEqual({ FLAG: false });
	});

	it("returns undefined for empty string", () => {
		const schema = z.object({ FLAG: optionalBooleanSchema });
		expect(schema.parse({ FLAG: "" })).toEqual({ FLAG: undefined });
	});

	it("returns undefined when value is undefined", () => {
		const schema = z.object({ FLAG: optionalBooleanSchema });
		expect(schema.parse({ FLAG: undefined })).toEqual({ FLAG: undefined });
		expect(schema.parse({})).toEqual({ FLAG: undefined });
	});
});

// ============================================================================
// parseEnv Tests
// ============================================================================

describe("parseEnv()", () => {
	it("parses environment variables against a custom schema", () => {
		const testSchema = z.object({
			API_KEY: z.string(),
			TIMEOUT: z.string().transform(Number),
		});

		const testEnv = {
			API_KEY: "secret-key",
			TIMEOUT: "5000",
		};

		const result = parseEnv(testSchema, testEnv);

		expect(result.API_KEY).toBe("secret-key");
		expect(result.TIMEOUT).toBe(5000);
	});

	it("applies default values from schema", () => {
		const testSchema = z.object({
			MODE: z.string().default("development"),
			PORT: z.string().optional(),
		});

		const result = parseEnv(testSchema, {});

		expect(result.MODE).toBe("development");
		expect(result.PORT).toBeUndefined();
	});

	it("throws ZodError for invalid environment values", () => {
		const testSchema = z.object({
			REQUIRED_KEY: z.string().min(1),
		});

		expect(() => parseEnv(testSchema, {})).toThrow();
		expect(() => parseEnv(testSchema, { REQUIRED_KEY: "" })).toThrow();
	});
});

// ============================================================================
// env Export Tests
// ============================================================================

describe("env export", () => {
	it("provides typed access to NODE_ENV", () => {
		// NODE_ENV should be one of the allowed values or default
		expect(["development", "test", "production"]).toContain(env.NODE_ENV);
	});

	it("provides typed access to terminal detection variables", () => {
		// These should be boolean | undefined, not string
		expect(env.NO_COLOR === undefined || typeof env.NO_COLOR === "boolean").toBe(true);
		expect(env.FORCE_COLOR === undefined || typeof env.FORCE_COLOR === "boolean").toBe(true);
		expect(env.CI === undefined || typeof env.CI === "boolean").toBe(true);
	});
});
