/**
 * Deterministic hash ID generation using Bun.hash().
 *
 * @module hash-id
 */

/** Base62 character set for URL-safe output */
const BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

/**
 * Converts a BigInt to a base62 string.
 *
 * @param num - The BigInt to convert
 * @returns Base62 encoded string
 */
function toBase62(num: bigint): string {
	if (num === 0n) return "0";

	const base = BigInt(BASE62.length);
	let result = "";
	let value = num;

	while (value > 0n) {
		const remainder = Number(value % base);
		result = BASE62[remainder] + result;
		value = value / base;
	}

	return result;
}

/**
 * Generates a deterministic short ID from input using Bun.hash().
 * Unlike shortId() which generates random IDs, hashId() always produces
 * the same output for the same input.
 *
 * @param input - String to hash
 * @param length - Output length (default: 5)
 * @returns URL-safe alphanumeric hash (base62)
 *
 * @example
 * ```typescript
 * hashId("user-123")        // "a7b2c" (always same for same input)
 * hashId("user-123", 8)     // "a7b2c3d1"
 * ```
 */
export function hashId(input: string, length = 5): string {
	// Use Bun.hash() which returns a 64-bit number
	const hash = Bun.hash(input);

	// Convert to base62 for URL-safe alphanumeric output
	const base62 = toBase62(BigInt(hash));

	// Pad with leading zeros if needed, then truncate to requested length
	const padded = base62.padStart(length, "0");
	return padded.slice(0, length);
}
