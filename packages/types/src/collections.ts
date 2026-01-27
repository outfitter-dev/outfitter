/**
 * Collection type utilities.
 *
 * @module collections
 */

/**
 * A non-empty array type that guarantees at least one element.
 */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Type guard for checking if an array is non-empty.
 *
 * @param array - The array to check
 * @returns True if the array has at least one element
 *
 * @example
 * ```typescript
 * const items: string[] = getItems();
 * if (isNonEmptyArray(items)) {
 *   const first = items[0]; // Type is string, not string | undefined
 * }
 * ```
 */
export function isNonEmptyArray<T>(array: T[]): array is NonEmptyArray<T> {
  return array.length > 0;
}

/**
 * Creates a non-empty array, throwing if the input is empty.
 *
 * @param array - The array to convert
 * @returns A non-empty array
 * @throws Error - If the array is empty
 * @throws Error - Not implemented yet
 */
export function toNonEmptyArray<T>(array: T[]): NonEmptyArray<T> {
  if (array.length === 0) {
    throw new Error("Array is empty");
  }
  return array as NonEmptyArray<T>;
}

/**
 * Gets the first element of a non-empty array.
 *
 * @param array - A non-empty array
 * @returns The first element (guaranteed to exist)
 */
export function first<T>(array: NonEmptyArray<T>): T {
  return array[0];
}

/**
 * Gets the last element of a non-empty array.
 *
 * @param array - A non-empty array
 * @returns The last element (guaranteed to exist)
 */
export function last<T>(array: NonEmptyArray<T>): T {
  return array.at(-1) as T;
}

/**
 * Groups array elements by a key function.
 *
 * @param items - The items to group
 * @param keyFn - Function to extract the grouping key
 * @returns A map of keys to arrays of items
 * @throws Error - Not implemented yet
 *
 * @example
 * ```typescript
 * const users = [{ name: "Alice", role: "admin" }, { name: "Bob", role: "user" }];
 * const byRole = groupBy(users, (u) => u.role);
 * // Map { "admin" => [{ name: "Alice", ... }], "user" => [{ name: "Bob", ... }] }
 * ```
 */
export function groupBy<T, K extends string | number | symbol>(
  items: T[],
  keyFn: (item: T) => K
): Map<K, NonEmptyArray<T>> {
  const result = new Map<K, NonEmptyArray<T>>();

  for (const item of items) {
    const key = keyFn(item);
    const existing = result.get(key);
    if (existing) {
      existing.push(item);
    } else {
      result.set(key, [item]);
    }
  }

  return result;
}
