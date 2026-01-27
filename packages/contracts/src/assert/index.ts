/**
 * Assertion utilities
 *
 * Provides type-safe assertions that return Result types instead of throwing.
 * Enables explicit error handling for invariant checks and validations.
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
