/**
 * Deep path type utilities for type-safe dot-notation access.
 *
 * These utilities enable type-safe access to nested object properties using
 * dot-notation string paths, commonly used in configuration systems and
 * state management.
 *
 * @module deep
 */

/**
 * Recursively extracts all valid dot-notation paths from an object type.
 *
 * This type generates a union of all possible paths through an object,
 * including intermediate object paths and final leaf paths.
 *
 * Arrays are treated as leaf nodes - the type does not recurse into array
 * indices (e.g., "items.0" is not generated for `{ items: string[] }`).
 *
 * @typeParam T - The object type to extract paths from
 *
 * @example
 * ```ts
 * type Config = { database: { host: string; port: number }; debug: boolean };
 * type Keys = DeepKeys<Config>;
 * // "database" | "database.host" | "database.port" | "debug"
 * ```
 *
 * @example
 * ```ts
 * // Arrays are leaf nodes
 * type WithArray = { items: string[]; nested: { list: number[] } };
 * type Keys = DeepKeys<WithArray>;
 * // "items" | "nested" | "nested.list"
 * ```
 */
export type DeepKeys<T> = T extends object
  ? T extends readonly unknown[]
    ? never // Arrays are leaf nodes - don't recurse
    : {
        [K in keyof T & string]: NonNullable<T[K]> extends object
          ? NonNullable<T[K]> extends readonly unknown[]
            ? K // Arrays are leaf nodes
            : K | `${K}.${DeepKeys<NonNullable<T[K]>>}`
          : K;
      }[keyof T & string]
  : never;

/**
 * Gets the type at a specific dot-notation path.
 *
 * Given an object type and a path string, this type resolves to the
 * type of the value at that path. Returns `never` for invalid paths.
 *
 * @typeParam T - The object type to access
 * @typeParam P - The dot-notation path string
 *
 * @example
 * ```ts
 * type Config = { database: { host: string; port: number } };
 * type Host = DeepGet<Config, "database.host">; // string
 * type Port = DeepGet<Config, "database.port">; // number
 * type DB = DeepGet<Config, "database">;        // { host: string; port: number }
 * ```
 *
 * @example
 * ```ts
 * type Config = { database: { host: string } };
 * type Invalid = DeepGet<Config, "database.invalid">; // never
 * ```
 */
export type DeepGet<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? DeepGet<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

/**
 * Creates a new type with the value at path P replaced with V.
 *
 * This type is useful for typing immutable update functions that modify
 * values at specific paths while preserving the rest of the object structure.
 *
 * Returns `never` if the path is invalid.
 *
 * @typeParam T - The original object type
 * @typeParam P - The dot-notation path to the value to replace
 * @typeParam V - The new type for the value at the path
 *
 * @example
 * ```ts
 * type Config = { database: { host: string; port: number } };
 *
 * // Replace port type from number to string
 * type Updated = DeepSet<Config, "database.port", string>;
 * // { database: { host: string; port: string } }
 * ```
 *
 * @example
 * ```ts
 * type State = { user: { name: string; age: number } };
 *
 * // Replace entire nested object
 * type Updated = DeepSet<State, "user", { id: number }>;
 * // { user: { id: number } }
 * ```
 */
export type DeepSet<
  T,
  P extends string,
  V,
> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? { [Key in keyof T]: Key extends K ? DeepSet<T[Key], Rest, V> : T[Key] }
    : never
  : P extends keyof T
    ? { [Key in keyof T]: Key extends P ? V : T[Key] }
    : never;
