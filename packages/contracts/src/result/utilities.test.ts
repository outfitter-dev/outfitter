/**
 * Tests for Result utilities
 */
import { describe, expect, it, vi } from "bun:test";
import { Result } from "better-result";
import { combine2, combine3, orElse, unwrapOrElse } from "./utilities.js";

describe("unwrapOrElse", () => {
	it("returns value on Ok", () => {
		const result = Result.ok(42);
		const value = unwrapOrElse(result, () => 0);

		expect(value).toBe(42);
	});

	it("calls defaultFn on Err and returns computed value", () => {
		const result = Result.err("error");
		const defaultFn = vi.fn((error: string) => error.length);
		const value = unwrapOrElse(result, defaultFn);

		expect(value).toBe(5); // "error".length = 5
		expect(defaultFn).toHaveBeenCalledTimes(1);
		expect(defaultFn).toHaveBeenCalledWith("error");
	});

	it("does NOT call defaultFn on Ok (lazy evaluation)", () => {
		const result = Result.ok(42);
		const defaultFn = vi.fn(() => 0);
		unwrapOrElse(result, defaultFn);

		expect(defaultFn).not.toHaveBeenCalled();
	});
});

describe("orElse", () => {
	it("returns first Result on Ok", () => {
		const first = Result.ok<number, string>(42);
		const fallback = Result.ok<number, string>(0);
		const result = orElse(first, fallback);

		expect(result.isOk()).toBe(true);
		expect(result.isOk() && result.value).toBe(42);
	});

	it("returns fallback on Err", () => {
		const first = Result.err<number, string>("first error");
		const fallback = Result.ok<number, string>(99);
		const result = orElse(first, fallback);

		expect(result.isOk()).toBe(true);
		expect(result.isOk() && result.value).toBe(99);
	});

	it("returns fallback error when both are Err", () => {
		const first = Result.err<number, string>("first error");
		const fallback = Result.err<number, string>("fallback error");
		const result = orElse(first, fallback);

		expect(result.isErr()).toBe(true);
		expect(result.isErr() && result.error).toBe("fallback error");
	});
});

describe("combine2", () => {
	it("returns tuple on both Ok", () => {
		const r1 = Result.ok<number, string>(1);
		const r2 = Result.ok<string, string>("hello");
		const result = combine2(r1, r2);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual([1, "hello"]);
		}
	});

	it("returns first error when first is Err", () => {
		const r1 = Result.err<number, string>("first error");
		const r2 = Result.ok<string, string>("hello");
		const result = combine2(r1, r2);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("first error");
		}
	});

	it("returns second error when first is Ok and second is Err", () => {
		const r1 = Result.ok<number, string>(1);
		const r2 = Result.err<string, string>("second error");
		const result = combine2(r1, r2);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("second error");
		}
	});

	it("returns first error when both are Err", () => {
		const r1 = Result.err<number, string>("first error");
		const r2 = Result.err<string, string>("second error");
		const result = combine2(r1, r2);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("first error");
		}
	});
});

describe("combine3", () => {
	it("returns tuple on all Ok", () => {
		const r1 = Result.ok<number, string>(1);
		const r2 = Result.ok<string, string>("hello");
		const r3 = Result.ok<boolean, string>(true);
		const result = combine3(r1, r2, r3);

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value).toEqual([1, "hello", true]);
		}
	});

	it("returns first error when first is Err", () => {
		const r1 = Result.err<number, string>("first error");
		const r2 = Result.ok<string, string>("hello");
		const r3 = Result.ok<boolean, string>(true);
		const result = combine3(r1, r2, r3);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("first error");
		}
	});

	it("returns second error when first is Ok and second is Err", () => {
		const r1 = Result.ok<number, string>(1);
		const r2 = Result.err<string, string>("second error");
		const r3 = Result.ok<boolean, string>(true);
		const result = combine3(r1, r2, r3);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("second error");
		}
	});

	it("returns third error when first two are Ok and third is Err", () => {
		const r1 = Result.ok<number, string>(1);
		const r2 = Result.ok<string, string>("hello");
		const r3 = Result.err<boolean, string>("third error");
		const result = combine3(r1, r2, r3);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("third error");
		}
	});

	it("returns first error when all are Err", () => {
		const r1 = Result.err<number, string>("first error");
		const r2 = Result.err<string, string>("second error");
		const r3 = Result.err<string, string>("third error");
		const result = combine3(r1, r2, r3);

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error).toBe("first error");
		}
	});
});
