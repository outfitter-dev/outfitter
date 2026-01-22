/**
 * Result utilities
 *
 * Extends better-result with additional combinators not provided by the library.
 * These utilities provide lazy evaluation and tuple combinators.
 *
 * @module result/utilities
 */
import { Result } from "better-result";

/**
 * Extract value from Ok, or compute default from error.
 *
 * Unlike `unwrapOr`, the default is computed lazily only on Err.
 * This is useful when the default value is expensive to compute
 * and should only be evaluated when needed.
 *
 * @param result - The Result to unwrap
 * @param defaultFn - Function to compute default value from error
 * @returns The success value or computed default
 *
 * @example
 * ```typescript
 * const result = Result.err("not found");
 * const value = unwrapOrElse(result, (error) => {
 *   console.log("Computing expensive default due to:", error);
 *   return expensiveComputation();
 * });
 * ```
 */
export const unwrapOrElse = <T, E>(result: Result<T, E>, defaultFn: (error: E) => T): T => {
	return result.isOk() ? result.value : defaultFn(result.error);
};

/**
 * Return first Ok, or fallback if first is Err.
 *
 * Useful for trying alternative operations - if the first fails,
 * fall back to an alternative Result.
 *
 * @param result - The primary Result to try
 * @param fallback - The fallback Result if primary is Err
 * @returns First Ok result, or fallback
 *
 * @example
 * ```typescript
 * const primary = parseFromCache(key);
 * const fallback = parseFromNetwork(key);
 * const result = orElse(primary, fallback);
 * ```
 */
export const orElse = <T, E, F>(result: Result<T, E>, fallback: Result<T, F>): Result<T, F> => {
	// If Ok, return as-is (cast needed to change phantom error type)
	// If Err, return the fallback
	return result.isOk() ? (result as unknown as Result<T, F>) : fallback;
};

/**
 * Combine two Results into a tuple Result.
 *
 * Returns first error if either fails, evaluated left-to-right.
 * Useful for combining independent operations that must all succeed.
 *
 * @param r1 - First Result
 * @param r2 - Second Result
 * @returns Result containing tuple of both values, or first error
 *
 * @example
 * ```typescript
 * const user = fetchUser(id);
 * const settings = fetchSettings(id);
 * const combined = combine2(user, settings);
 *
 * if (combined.isOk()) {
 *   const [userData, userSettings] = combined.value;
 * }
 * ```
 */
export const combine2 = <T1, T2, E>(r1: Result<T1, E>, r2: Result<T2, E>): Result<[T1, T2], E> => {
	if (r1.isErr()) return r1 as unknown as Result<[T1, T2], E>;
	if (r2.isErr()) return r2 as unknown as Result<[T1, T2], E>;
	return Result.ok([r1.value, r2.value]);
};

/**
 * Combine three Results into a tuple Result.
 *
 * Returns first error if any fails, evaluated left-to-right.
 * Useful for combining independent operations that must all succeed.
 *
 * @param r1 - First Result
 * @param r2 - Second Result
 * @param r3 - Third Result
 * @returns Result containing tuple of all values, or first error
 *
 * @example
 * ```typescript
 * const user = fetchUser(id);
 * const settings = fetchSettings(id);
 * const permissions = fetchPermissions(id);
 * const combined = combine3(user, settings, permissions);
 *
 * if (combined.isOk()) {
 *   const [userData, userSettings, userPermissions] = combined.value;
 * }
 * ```
 */
export const combine3 = <T1, T2, T3, E>(
	r1: Result<T1, E>,
	r2: Result<T2, E>,
	r3: Result<T3, E>,
): Result<[T1, T2, T3], E> => {
	if (r1.isErr()) return r1 as unknown as Result<[T1, T2, T3], E>;
	if (r2.isErr()) return r2 as unknown as Result<[T1, T2, T3], E>;
	if (r3.isErr()) return r3 as unknown as Result<[T1, T2, T3], E>;
	return Result.ok([r1.value, r2.value, r3.value]);
};
