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

/**
 * Sorts an array by multiple criteria.
 *
 * @param items - The array to sort
 * @param criteria - Array of sorting criteria with key and optional order
 * @returns A new sorted array (does not mutate original)
 *
 * @example
 * ```typescript
 * const users = [
 *   { name: "Bob", age: 30 },
 *   { name: "Alice", age: 25 },
 *   { name: "Alice", age: 30 },
 * ];
 * sortBy(users, [{ key: "name" }, { key: "age", order: "desc" }])
 * // [{ name: "Alice", age: 30 }, { name: "Alice", age: 25 }, { name: "Bob", age: 30 }]
 * ```
 */
export function sortBy<T>(
  items: T[],
  criteria: Array<{ key: keyof T; order?: "asc" | "desc" }>
): T[] {
  if (items.length === 0 || criteria.length === 0) {
    return [...items];
  }

  return [...items].sort((a, b) => {
    for (const { key, order = "asc" } of criteria) {
      const aVal = a[key];
      const bVal = b[key];

      let comparison = 0;

      if (aVal < bVal) {
        comparison = -1;
      } else if (aVal > bVal) {
        comparison = 1;
      }

      if (comparison !== 0) {
        return order === "desc" ? -comparison : comparison;
      }
    }
    return 0;
  });
}

/**
 * Removes duplicates from an array based on a key function.
 * Preserves the first occurrence of each unique key.
 *
 * @param items - The array to deduplicate
 * @param keyFn - Function to extract the key for uniqueness comparison
 * @returns A new array with duplicates removed
 *
 * @example
 * ```typescript
 * const users = [
 *   { id: 1, email: "alice@example.com" },
 *   { id: 2, email: "bob@example.com" },
 *   { id: 3, email: "alice@example.com" }, // duplicate email
 * ];
 * dedupe(users, (u) => u.email)
 * // [{ id: 1, email: "alice@example.com" }, { id: 2, email: "bob@example.com" }]
 * ```
 */
export function dedupe<T, K>(items: T[], keyFn: (item: T) => K): T[] {
  const seen = new Set<K>();
  const result: T[] = [];

  for (const item of items) {
    const key = keyFn(item);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(item);
    }
  }

  return result;
}

/**
 * Splits an array into chunks of a specified size.
 *
 * @param items - The array to split
 * @param size - The maximum size of each chunk (must be >= 1)
 * @returns An array of chunks
 * @throws Error - If size is less than 1
 *
 * @example
 * ```typescript
 * chunk([1, 2, 3, 4, 5], 2)
 * // [[1, 2], [3, 4], [5]]
 *
 * chunk([1, 2, 3], 5)
 * // [[1, 2, 3]]
 * ```
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size < 1) {
    throw new Error("Chunk size must be at least 1");
  }

  if (items.length === 0) {
    return [];
  }

  const result: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }

  return result;
}
