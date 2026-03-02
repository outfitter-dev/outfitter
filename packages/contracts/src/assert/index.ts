/**
 * Assertion utilities
 *
 * Provides type-safe assertions that return Result types instead of throwing.
 * Enables explicit error handling for invariant checks and validations.
 *
 * Also provides test assertion helpers (`expectOk`, `expectErr`) that assert
 * and narrow Result types, throwing descriptive failures for use with test runners.
 *
 * @module assert
 */

import { Result } from "better-result";

import { AssertionError } from "../errors.js";

/**
 * Array type guaranteed to have at least one element.
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Type guard for NonEmptyArray.
 */
export const isNonEmptyArray = <T>(
  arr: readonly T[]
): arr is NonEmptyArray<T> => {
  return arr.length > 0;
};

/**
 * Assert a value is defined (not null or undefined).
 * Returns Result instead of throwing.
 */
export const assertDefined = <T>(
  value: T | null | undefined,
  message?: string
): Result<T, InstanceType<typeof AssertionError>> => {
  if (value === null || value === undefined) {
    return Result.err(
      new AssertionError({ message: message ?? "Value is null or undefined" })
    );
  }
  return Result.ok(value);
};

/**
 * Assert array has at least one element.
 * Returns NonEmptyArray on success.
 */
export const assertNonEmpty = <T>(
  arr: readonly T[],
  message?: string
): Result<NonEmptyArray<T>, InstanceType<typeof AssertionError>> => {
  if (arr.length === 0) {
    return Result.err(
      new AssertionError({ message: message ?? "Array is empty" })
    );
  }
  return Result.ok(arr as NonEmptyArray<T>);
};

/**
 * Assert value matches a predicate.
 * Supports type guard predicates for narrowing.
 */
export function assertMatches<T, U extends T>(
  value: T,
  predicate: (v: T) => v is U,
  message?: string
): Result<U, InstanceType<typeof AssertionError>>;
export function assertMatches<T>(
  value: T,
  predicate: (v: T) => boolean,
  message?: string
): Result<T, InstanceType<typeof AssertionError>>;
export function assertMatches<T>(
  value: T,
  predicate: (v: T) => boolean,
  message?: string
): Result<T, InstanceType<typeof AssertionError>> {
  if (!predicate(value)) {
    return Result.err(
      new AssertionError({
        message: message ?? "Value does not match predicate",
      })
    );
  }
  return Result.ok(value);
}

/**
 * Format a value for display in error messages.
 * Handles Error objects, strings, and general values with JSON serialization fallback.
 */
const formatValue = (value: unknown): string => {
  if (value instanceof Error) {
    return value.message;
  }
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

/**
 * Assert a Result is Ok and return the narrowed value.
 *
 * Throws a descriptive error if the Result is Err, making it ideal for
 * test assertions with Bun's test runner.
 *
 * @param result - The Result to assert
 * @param message - Optional context message prepended to the error
 * @returns The unwrapped Ok value with type narrowing to `T`
 * @throws Error with descriptive message if Result is Err
 *
 * @example
 * ```typescript
 * import { expectOk } from "@outfitter/contracts";
 *
 * const result = await fetchUser(id);
 * const user = expectOk(result); // throws if Err, returns User if Ok
 * expect(user.name).toBe("Alice");
 * ```
 */
export const expectOk = <T, E>(result: Result<T, E>, message?: string): T => {
  if (result.isOk()) {
    return result.value;
  }
  const errorDetail = formatValue(result.error);
  const prefix = message ? `${message}: ` : "";
  throw new Error(`${prefix}Expected Ok, got Err: ${errorDetail}`);
};

/**
 * Assert a Result is Err and return the narrowed error.
 *
 * Throws a descriptive error if the Result is Ok, making it ideal for
 * test assertions with Bun's test runner.
 *
 * @param result - The Result to assert
 * @param message - Optional context message prepended to the error
 * @returns The unwrapped Err value with type narrowing to `E`
 * @throws Error with descriptive message if Result is Ok
 *
 * @example
 * ```typescript
 * import { expectErr } from "@outfitter/contracts";
 *
 * const result = validateInput(invalidData);
 * const error = expectErr(result); // throws if Ok, returns error if Err
 * expect(error.category).toBe("validation");
 * ```
 */
export const expectErr = <T, E>(result: Result<T, E>, message?: string): E => {
  if (result.isErr()) {
    return result.error;
  }
  const valueDetail = formatValue(result.value);
  const prefix = message ? `${message}: ` : "";
  throw new Error(`${prefix}Expected Err, got Ok: ${valueDetail}`);
};
