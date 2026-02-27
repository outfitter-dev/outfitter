/**
 * Tests for expectOk() and expectErr() test assertion helpers
 */
import { describe, expect, it } from "bun:test";

import { Result } from "better-result";

import { expectErr, expectOk } from "../assert/index.js";
import { ValidationError } from "../errors.js";

describe("expectOk", () => {
  it("returns the unwrapped value for Ok result", () => {
    const result = Result.ok(42);
    const value = expectOk(result);

    expect(value).toBe(42);
  });

  it("returns the unwrapped string value for Ok result", () => {
    const result = Result.ok("hello");
    const value = expectOk(result);

    expect(value).toBe("hello");
  });

  it("returns complex objects for Ok result", () => {
    const data = { name: "Alice", age: 30 };
    const result = Result.ok(data);
    const value = expectOk(result);

    expect(value).toEqual({ name: "Alice", age: 30 });
  });

  it("throws descriptive failure for Err result with string error", () => {
    const result = Result.err("something went wrong");

    expect(() => expectOk(result)).toThrow();
    expect(() => expectOk(result)).toThrow(/something went wrong/);
  });

  it("throws descriptive failure for Err result with Error object", () => {
    const error = new ValidationError({ message: "invalid input" });
    const result = Result.err(error);

    expect(() => expectOk(result)).toThrow();
    expect(() => expectOk(result)).toThrow(/invalid input/);
  });

  it("throws descriptive failure for Err result with object error", () => {
    const result = Result.err({ code: 404, reason: "not found" });

    expect(() => expectOk(result)).toThrow();
  });

  it("includes custom message in thrown error when provided", () => {
    const result = Result.err("connection refused");

    expect(() => expectOk(result, "should connect to database")).toThrow(
      /should connect to database/
    );
  });

  it("narrows type — returned value is T, not T | undefined", () => {
    const result: Result<{ name: string }, string> = Result.ok({
      name: "test",
    });
    const value = expectOk(result);

    // Type narrowing: value should be { name: string }, not { name: string } | undefined
    const name: string = value.name;
    expect(name).toBe("test");
  });

  it("works with falsy Ok values (0, empty string, false)", () => {
    expect(expectOk(Result.ok(0))).toBe(0);
    expect(expectOk(Result.ok(""))).toBe("");
    expect(expectOk(Result.ok(false))).toBe(false);
  });

  it("works with null/undefined Ok values", () => {
    expect(expectOk(Result.ok(null))).toBe(null);
    expect(expectOk(Result.ok(undefined))).toBe(undefined);
  });
});

describe("expectErr", () => {
  it("returns the unwrapped error for Err result", () => {
    const result = Result.err("something went wrong");
    const error = expectErr(result);

    expect(error).toBe("something went wrong");
  });

  it("returns Error object for Err result", () => {
    const validationError = new ValidationError({ message: "invalid input" });
    const result = Result.err(validationError);
    const error = expectErr(result);

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.message).toBe("invalid input");
  });

  it("returns complex error objects for Err result", () => {
    const errData = { code: 404, reason: "not found" };
    const result = Result.err(errData);
    const error = expectErr(result);

    expect(error).toEqual({ code: 404, reason: "not found" });
  });

  it("throws descriptive failure for Ok result with value details", () => {
    const result = Result.ok(42);

    expect(() => expectErr(result)).toThrow();
    expect(() => expectErr(result)).toThrow(/42/);
  });

  it("throws descriptive failure for Ok result with string value", () => {
    const result = Result.ok("success");

    expect(() => expectErr(result)).toThrow();
    expect(() => expectErr(result)).toThrow(/success/);
  });

  it("throws descriptive failure for Ok result with object value", () => {
    const result = Result.ok({ data: "test" });

    expect(() => expectErr(result)).toThrow();
  });

  it("includes custom message in thrown error when provided", () => {
    const result = Result.ok("unexpected success");

    expect(() => expectErr(result, "should have failed validation")).toThrow(
      /should have failed validation/
    );
  });

  it("narrows type — returned value is E, not E | undefined", () => {
    const result: Result<string, { code: number; message: string }> =
      Result.err({ code: 404, message: "not found" });
    const error = expectErr(result);

    // Type narrowing: error should be { code: number; message: string }
    const code: number = error.code;
    expect(code).toBe(404);
  });

  it("works with falsy Err values", () => {
    expect(expectErr(Result.err(0))).toBe(0);
    expect(expectErr(Result.err(""))).toBe("");
    expect(expectErr(Result.err(false))).toBe(false);
  });
});
