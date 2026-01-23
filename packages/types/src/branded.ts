/**
 * Branded type utilities for nominal typing in TypeScript.
 *
 * @module branded
 */

import { Result } from "better-result";
import { ValidationError } from "@outfitter/contracts";

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
export function brand<T, Brand extends string>(value: T): Branded<T, Brand> {
	return value as Branded<T, Brand>;
}

/**
 * Removes the brand from a branded type, returning the underlying type.
 *
 * @param value - The branded value
 * @returns The unbranded value
 * @throws Error - Not implemented yet
 */
export function unbrand<T, Brand extends string>(value: Branded<T, Brand>): T {
	return value as T;
}

/**
 * Type helper to extract the underlying type from a branded type.
 */
export type Unbrand<T> = T extends Branded<infer U, string> ? U : T;

/**
 * Type helper to extract the brand string from a branded type.
 */
export type BrandOf<T> = T extends Branded<unknown, infer B> ? B : never;

// ============================================================================
// Common Branded Type Aliases
// ============================================================================

/**
 * A positive integer (value > 0, must be a finite integer).
 */
export type PositiveInt = Branded<number, "PositiveInt">;

/**
 * A non-empty string (trimmed length > 0).
 */
export type NonEmptyString = Branded<string, "NonEmptyString">;

/**
 * An email address (basic format validation: contains @ and . in domain).
 */
export type Email = Branded<string, "Email">;

/**
 * A UUID string (UUID v4 format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx).
 */
export type UUID = Branded<string, "UUID">;

// ============================================================================
// Validation Constructors
// ============================================================================

/**
 * Creates a PositiveInt from a number, validating that it is a positive integer.
 *
 * @param value - The number to validate
 * @returns Result containing PositiveInt on success, ValidationError on failure
 *
 * @example
 * ```typescript
 * const result = positiveInt(42);
 * if (Result.isOk(result)) {
 *   console.log(result.value); // 42 as PositiveInt
 * }
 * ```
 */
export function positiveInt(
	value: number,
): Result<PositiveInt, InstanceType<typeof ValidationError>> {
	if (!Number.isFinite(value)) {
		return Result.err(
			new ValidationError({
				message: "Value must be a finite number",
				field: "value",
			}),
		);
	}

	if (!Number.isInteger(value)) {
		return Result.err(
			new ValidationError({
				message: "Value must be an integer",
				field: "value",
			}),
		);
	}

	if (value <= 0) {
		return Result.err(
			new ValidationError({
				message: "Value must be greater than 0",
				field: "value",
			}),
		);
	}

	return Result.ok(brand<number, "PositiveInt">(value));
}

/**
 * Creates a NonEmptyString from a string, validating that it has content after trimming.
 *
 * @param value - The string to validate
 * @returns Result containing NonEmptyString on success, ValidationError on failure
 *
 * @example
 * ```typescript
 * const result = nonEmptyString("hello");
 * if (Result.isOk(result)) {
 *   console.log(result.value); // "hello" as NonEmptyString
 * }
 * ```
 */
export function nonEmptyString(
	value: string,
): Result<NonEmptyString, InstanceType<typeof ValidationError>> {
	if (value.trim().length === 0) {
		return Result.err(
			new ValidationError({
				message: "String must not be empty or whitespace-only",
				field: "value",
			}),
		);
	}

	return Result.ok(brand<string, "NonEmptyString">(value));
}

/**
 * Basic email format regex: something@something.something
 * This is intentionally simple - for more rigorous validation, use a dedicated library.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates an Email from a string, validating basic email format.
 *
 * @param value - The string to validate
 * @returns Result containing Email on success, ValidationError on failure
 *
 * @example
 * ```typescript
 * const result = email("user@example.com");
 * if (Result.isOk(result)) {
 *   console.log(result.value); // "user@example.com" as Email
 * }
 * ```
 */
export function email(value: string): Result<Email, InstanceType<typeof ValidationError>> {
	if (!EMAIL_REGEX.test(value)) {
		return Result.err(
			new ValidationError({
				message: "Invalid email format",
				field: "value",
			}),
		);
	}

	return Result.ok(brand<string, "Email">(value));
}

/**
 * UUID v4 format regex: 8-4-4-4-12 hexadecimal characters with v4 constraints.
 * - Version nibble (position 15) must be '4'
 * - Variant bits (position 20) must be one of [89ab]
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Creates a UUID from a string, validating UUID v4 format.
 *
 * @param value - The string to validate
 * @returns Result containing UUID on success, ValidationError on failure
 *
 * @example
 * ```typescript
 * const result = uuid("550e8400-e29b-41d4-a716-446655440000");
 * if (Result.isOk(result)) {
 *   console.log(result.value); // UUID branded string
 * }
 * ```
 */
export function uuid(value: string): Result<UUID, InstanceType<typeof ValidationError>> {
	if (!UUID_REGEX.test(value)) {
		return Result.err(
			new ValidationError({
				message: "Invalid UUID v4 format",
				field: "value",
			}),
		);
	}

	return Result.ok(brand<string, "UUID">(value));
}
