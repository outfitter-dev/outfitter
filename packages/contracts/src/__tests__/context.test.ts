/**
 * Tests for @outfitter/contracts/context
 *
 * Tests cover:
 * - createContext() (4 tests)
 * - generateRequestId() (2 tests)
 *
 * Total: 6 tests
 */
import { describe, expect, it } from "bun:test";
import { createContext, generateRequestId } from "../context.js";
import type { Logger } from "../handler.js";

// ============================================================================
// createContext() Tests (4 tests)
// ============================================================================

describe("createContext()", () => {
	it("generates requestId if not provided", () => {
		const ctx = createContext({});

		expect(ctx.requestId).toBeDefined();
		expect(typeof ctx.requestId).toBe("string");
		expect(ctx.requestId.length).toBeGreaterThan(0);
	});

	it("uses provided requestId", () => {
		const customRequestId = "custom-request-id-12345";

		const ctx = createContext({ requestId: customRequestId });

		expect(ctx.requestId).toBe(customRequestId);
	});

	it("includes logger when provided", () => {
		const mockLogger: Logger = {
			debug: () => {},
			info: () => {},
			warn: () => {},
			error: () => {},
		};

		const ctx = createContext({ logger: mockLogger });

		expect(ctx.logger).toBe(mockLogger);
	});

	it("includes signal when provided", () => {
		const controller = new AbortController();

		const ctx = createContext({ signal: controller.signal });

		expect(ctx.signal).toBe(controller.signal);
	});
});

// ============================================================================
// generateRequestId() Tests (2 tests)
// ============================================================================

describe("generateRequestId()", () => {
	it("returns UUIDv7 format", () => {
		const id = generateRequestId();

		// UUIDv7 format: xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx
		// where x is hex digit and y is 8, 9, a, or b
		const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

		expect(uuidRegex.test(id)).toBe(true);
	});

	it("returns sortable IDs (lexicographic order = temporal order)", () => {
		// Generate multiple IDs with small delays
		const ids: string[] = [];

		// Generate first ID
		ids.push(generateRequestId());

		// Small delay to ensure timestamp difference
		// In practice, UUIDv7 uses millisecond precision
		const start = Date.now();
		while (Date.now() - start < 2) {
			// busy wait for ~2ms
		}

		// Generate second ID
		ids.push(generateRequestId());

		// Small delay again
		const start2 = Date.now();
		while (Date.now() - start2 < 2) {
			// busy wait for ~2ms
		}

		// Generate third ID
		ids.push(generateRequestId());

		// IDs should be in ascending order when sorted lexicographically
		const sorted = [...ids].sort();
		expect(sorted).toEqual(ids);

		// Additionally, first ID should be "less than" second, etc.
		expect(ids[0] < ids[1]).toBe(true);
		expect(ids[1] < ids[2]).toBe(true);
	});
});
