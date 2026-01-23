/**
 * Tests for deterministic hash ID generation.
 *
 * @module hash-id.test
 */

import { describe, expect, it } from "bun:test";
import { hashId } from "../hash-id.js";

describe("hashId", () => {
	describe("determinism", () => {
		it("produces the same output for the same input", () => {
			const input = "user-123";
			const result1 = hashId(input);
			const result2 = hashId(input);
			const result3 = hashId(input);

			expect(result1).toBe(result2);
			expect(result2).toBe(result3);
		});

		it("produces consistent output across multiple calls with different inputs", () => {
			const inputs = ["user-123", "session-456", "task-789"];
			const results = inputs.map((input) => hashId(input));

			// Verify each input produces stable output
			for (let i = 0; i < inputs.length; i++) {
				expect(hashId(inputs[i])).toBe(results[i]);
			}
		});
	});

	describe("length", () => {
		it("returns default length of 5 characters", () => {
			const result = hashId("test-input");
			expect(result.length).toBe(5);
		});

		it("respects custom length", () => {
			expect(hashId("test", 3).length).toBe(3);
			expect(hashId("test", 8).length).toBe(8);
			expect(hashId("test", 12).length).toBe(12);
		});

		it("handles length of 1", () => {
			const result = hashId("test", 1);
			expect(result.length).toBe(1);
		});
	});

	describe("URL-safety", () => {
		it("produces only alphanumeric characters", () => {
			// Test with various inputs to ensure consistent URL-safe output
			const inputs = [
				"user-123",
				"session_456",
				"special!@#$%^&*()chars",
				"unicode\u{1F600}emoji",
				"spaces and tabs\t",
				"",
				"a",
			];

			for (const input of inputs) {
				const result = hashId(input);
				expect(result).toMatch(/^[a-zA-Z0-9]+$/);
			}
		});

		it("uses base62 character set", () => {
			// Generate hashes for many inputs to increase confidence
			// that we see a good distribution of characters
			const chars = new Set<string>();
			for (let i = 0; i < 100; i++) {
				const result = hashId(`input-${i}`, 10);
				for (const char of result) {
					chars.add(char);
				}
			}

			// Should have a mix of digits, lowercase, and uppercase
			const hasDigits = [...chars].some((c) => /[0-9]/.test(c));
			const hasLower = [...chars].some((c) => /[a-z]/.test(c));
			const hasUpper = [...chars].some((c) => /[A-Z]/.test(c));

			expect(hasDigits).toBe(true);
			expect(hasLower).toBe(true);
			expect(hasUpper).toBe(true);
		});
	});

	describe("uniqueness", () => {
		it("produces different outputs for different inputs", () => {
			const result1 = hashId("input-a");
			const result2 = hashId("input-b");
			const result3 = hashId("input-c");

			expect(result1).not.toBe(result2);
			expect(result2).not.toBe(result3);
			expect(result1).not.toBe(result3);
		});

		it("produces different outputs for similar inputs", () => {
			const result1 = hashId("user-1");
			const result2 = hashId("user-2");
			const result3 = hashId("user-10");

			expect(result1).not.toBe(result2);
			expect(result2).not.toBe(result3);
			expect(result1).not.toBe(result3);
		});

		it("handles empty string input", () => {
			const result = hashId("");
			expect(result.length).toBe(5);
			expect(result).toMatch(/^[a-zA-Z0-9]+$/);
		});
	});

	describe("edge cases", () => {
		it("handles very long inputs", () => {
			const longInput = "a".repeat(10000);
			const result = hashId(longInput);
			expect(result.length).toBe(5);
			expect(result).toMatch(/^[a-zA-Z0-9]+$/);
		});

		it("handles unicode inputs", () => {
			const unicodeInput = "\u{1F600}\u{1F601}\u{1F602}"; // Emoji
			const result = hashId(unicodeInput);
			expect(result.length).toBe(5);
			expect(result).toMatch(/^[a-zA-Z0-9]+$/);
		});

		it("same input with different lengths produces consistent prefixes", () => {
			// Longer hashes should be extensions of shorter ones
			// (this tests that the algorithm is consistent)
			const input = "consistent-test";
			const short = hashId(input, 3);
			const medium = hashId(input, 6);
			const long = hashId(input, 10);

			// The shorter hash should be a prefix of longer ones
			expect(medium.startsWith(short)).toBe(true);
			expect(long.startsWith(short)).toBe(true);
			expect(long.startsWith(medium)).toBe(true);
		});
	});
});
