/**
 * Short ID generation utilities.
 *
 * @module short-id
 */

import type { Branded } from "./branded";

/**
 * A short identifier string, typically 7-12 characters.
 * Used for human-readable references (e.g., commit SHAs, session IDs).
 */
export type ShortId = Branded<string, "ShortId">;

/**
 * Options for short ID generation.
 */
export interface ShortIdOptions {
	/** Length of the generated ID. Default: 8 */
	length?: number;
	/** Character set to use. Default: alphanumeric */
	charset?: "alphanumeric" | "hex" | "base62";
	/** Optional prefix to prepend */
	prefix?: string;
}

/**
 * Generates a cryptographically random short ID.
 *
 * @param options - Configuration options for ID generation
 * @returns A branded ShortId
 * @throws Error - Not implemented yet
 *
 * @example
 * ```typescript
 * const id = shortId(); // "a1b2c3d4"
 * const hexId = shortId({ charset: "hex", length: 12 }); // "a1b2c3d4e5f6"
 * const prefixed = shortId({ prefix: "usr_" }); // "usr_a1b2c3d4"
 * ```
 */
export function shortId(_options?: ShortIdOptions): ShortId {
	throw new Error("Not implemented");
}

/**
 * Validates that a string matches the short ID format.
 *
 * @param value - The string to validate
 * @param options - Validation options (must match generation options)
 * @returns True if the string is a valid short ID
 * @throws Error - Not implemented yet
 */
export function isShortId(_value: string, _options?: ShortIdOptions): _value is ShortId {
	throw new Error("Not implemented");
}
