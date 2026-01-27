/**
 * Type guard utilities for runtime type checking.
 *
 * @module guards
 */

/**
 * Type guard for checking if a value is defined (not null or undefined).
 *
 * @param value - The value to check
 * @returns True if the value is not null or undefined
 *
 * @example
 * ```typescript
 * const items = [1, null, 2, undefined, 3];
 * const defined = items.filter(isDefined); // [1, 2, 3]
 * ```
 */
export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}

/**
 * Type guard for checking if a value is a non-empty string.
 *
 * @param value - The value to check
 * @returns True if the value is a string with length > 0
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/**
 * Type guard for checking if a value is a plain object.
 *
 * @param value - The value to check
 * @returns True if the value is a plain object (not null, array, or other object types)
 */
export function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

/**
 * Type guard for checking if a value has a specific property.
 *
 * @param value - The value to check
 * @param key - The property key to look for
 * @returns True if the value is an object with the specified property
 */
export function hasProperty<K extends string>(
  value: unknown,
  key: K
): value is Record<K, unknown> {
  return isPlainObject(value) && key in value;
}

/**
 * Creates a type guard function for a specific type using a predicate.
 *
 * @param predicate - A function that returns true if the value matches the type
 * @returns A type guard function
 * @throws Error - Not implemented yet
 *
 * @example
 * ```typescript
 * interface User { name: string; age: number; }
 * const isUser = createGuard<User>(
 *   (v) => hasProperty(v, "name") && hasProperty(v, "age")
 * );
 * ```
 */
export function createGuard<T>(
  predicate: (value: unknown) => boolean
): (value: unknown) => value is T {
  return (value: unknown): value is T => predicate(value);
}

/**
 * Asserts that a value matches a type guard, throwing if it doesn't.
 *
 * @param value - The value to assert
 * @param guard - The type guard to use
 * @param message - Optional error message
 * @throws Error - If the value doesn't match the guard
 * @throws Error - Not implemented yet
 */
export function assertType<T>(
  value: unknown,
  guard: (value: unknown) => value is T,
  message?: string
): asserts value is T {
  if (!guard(value)) {
    throw new Error(message ?? "Type assertion failed");
  }
}
