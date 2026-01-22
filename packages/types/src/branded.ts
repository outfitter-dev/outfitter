/**
 * Branded type utilities for nominal typing in TypeScript.
 *
 * @module branded
 */

/**
 * Creates a branded type by adding a unique brand to a base type.
 * This enables nominal typing for primitive types.
 *
 * @example
 * ```typescript
 * type UserId = Branded<string, "UserId">;
 * type PostId = Branded<string, "PostId">;
 *
 * // These are now incompatible at compile time
 * const userId: UserId = brand<string, "UserId">("user_123");
 * const postId: PostId = brand<string, "PostId">("post_456");
 * ```
 */
export type Branded<T, Brand extends string> = T & { readonly __brand: Brand };

/**
 * Brands a value with a nominal type marker.
 *
 * @param value - The value to brand
 * @returns The branded value
 * @throws Error - Not implemented yet
 */
export function brand<T, Brand extends string>(_value: T): Branded<T, Brand> {
	throw new Error("Not implemented");
}

/**
 * Removes the brand from a branded type, returning the underlying type.
 *
 * @param value - The branded value
 * @returns The unbranded value
 * @throws Error - Not implemented yet
 */
export function unbrand<T, Brand extends string>(_value: Branded<T, Brand>): T {
	throw new Error("Not implemented");
}

/**
 * Type helper to extract the underlying type from a branded type.
 */
export type Unbrand<T> = T extends Branded<infer U, string> ? U : T;

/**
 * Type helper to extract the brand string from a branded type.
 */
export type BrandOf<T> = T extends Branded<unknown, infer B> ? B : never;
