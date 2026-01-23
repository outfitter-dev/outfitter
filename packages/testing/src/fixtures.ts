/**
 * @outfitter/testing - Fixtures
 *
 * Test fixture utilities for creating test data with defaults,
 * managing temporary directories, and handling environment variables.
 *
 * @packageDocumentation
 */

import { readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";

// ============================================================================
// Types
// ============================================================================

/**
 * Deep partial type that makes all nested properties optional.
 * Used for fixture overrides.
 */
type DeepPartial<T> = T extends object
	? {
			[P in keyof T]?: DeepPartial<T[P]>;
		}
	: T;

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Checks if a value is a plain object (not an array, null, or other type).
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Performs a deep merge of source into target.
 * Arrays are replaced, not merged.
 * Undefined values in source are skipped.
 */
function deepMerge<T extends object>(target: T, source: DeepPartial<T>): T {
	const result = { ...target };

	for (const key of Object.keys(source)) {
		const sourceValue = (source as Record<string, unknown>)[key];
		const targetValue = (target as Record<string, unknown>)[key];

		if (sourceValue === undefined) {
			continue;
		}

		if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
			(result as Record<string, unknown>)[key] = deepMerge(
				targetValue as object,
				sourceValue as DeepPartial<object>,
			);
		} else {
			(result as Record<string, unknown>)[key] = sourceValue;
		}
	}

	return result;
}

/**
 * Creates a deep clone of an object.
 * Handles nested objects and arrays.
 */
function deepClone<T>(obj: T): T {
	if (obj === null || typeof obj !== "object") {
		return obj;
	}

	if (Array.isArray(obj)) {
		return obj.map((item) => deepClone(item)) as unknown as T;
	}

	const cloned = {} as T;
	for (const key of Object.keys(obj) as Array<keyof T>) {
		cloned[key] = deepClone(obj[key]);
	}
	return cloned;
}

// ============================================================================
// Fixture Factory
// ============================================================================

/**
 * Creates a fixture factory for generating test data with defaults.
 *
 * The factory returns a new object each time it's called, preventing
 * test pollution from shared mutable state. Supports deep merging
 * for nested objects.
 *
 * @typeParam T - The shape of the fixture object
 * @param defaults - Default values for the fixture
 * @returns A factory function that creates fixtures with optional overrides
 *
 * @example
 * ```typescript
 * const createUser = createFixture({
 *   id: 1,
 *   name: "John Doe",
 *   email: "john@example.com",
 *   settings: { theme: "dark", notifications: true }
 * });
 *
 * // Use defaults
 * const user1 = createUser();
 *
 * // Override specific fields
 * const user2 = createUser({ name: "Jane Doe", settings: { theme: "light" } });
 * ```
 */
export function createFixture<T extends object>(defaults: T): (overrides?: DeepPartial<T>) => T {
	return (overrides?: DeepPartial<T>): T => {
		const cloned = deepClone(defaults);
		if (overrides === undefined) {
			return cloned;
		}
		return deepMerge(cloned, overrides);
	};
}

// ============================================================================
// Temporary Directory
// ============================================================================

/**
 * Generates a unique temporary directory path.
 */
function generateTempDirPath(): string {
	const timestamp = Date.now();
	const random = Math.random().toString(36).slice(2, 10);
	return join(tmpdir(), `outfitter-test-${timestamp}-${random}`);
}

/**
 * Runs a function with a temporary directory, cleaning up after.
 *
 * Creates a unique temporary directory before invoking the callback,
 * and removes it (including all contents) after the callback completes.
 * Cleanup occurs even if the callback throws an error.
 *
 * @typeParam T - Return type of the callback
 * @param fn - Async function that receives the temp directory path
 * @returns The value returned by the callback
 *
 * @example
 * ```typescript
 * const result = await withTempDir(async (dir) => {
 *   await Bun.write(join(dir, "test.txt"), "content");
 *   return await processFiles(dir);
 * });
 * // Directory is automatically cleaned up
 * ```
 */
export async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
	const dir = generateTempDirPath();

	// Create the directory
	await mkdir(dir, { recursive: true });

	try {
		return await fn(dir);
	} finally {
		// Always clean up, even on error
		await rm(dir, { recursive: true, force: true }).catch(() => {
			// Ignore cleanup errors
		});
	}
}

// ============================================================================
// Environment Variables
// ============================================================================

/**
 * Runs a function with temporary environment variables, restoring after.
 *
 * Sets the specified environment variables before invoking the callback,
 * then restores the original values after the callback completes.
 * Restoration occurs even if the callback throws an error.
 *
 * @typeParam T - Return type of the callback
 * @param vars - Environment variables to set
 * @param fn - Async function to run with the modified environment
 * @returns The value returned by the callback
 *
 * @example
 * ```typescript
 * await withEnv({ API_KEY: "test-key", DEBUG: "true" }, async () => {
 *   // process.env.API_KEY is "test-key"
 *   // process.env.DEBUG is "true"
 *   await runTests();
 * });
 * // Original environment is restored
 * ```
 */
export async function withEnv<T>(vars: Record<string, string>, fn: () => Promise<T>): Promise<T> {
	// Store original values (undefined means the var wasn't set)
	const originalValues = new Map<string, string | undefined>();

	for (const key of Object.keys(vars)) {
		originalValues.set(key, process.env[key]);
	}

	// Set new values
	for (const [key, value] of Object.entries(vars)) {
		process.env[key] = value;
	}

	try {
		return await fn();
	} finally {
		// Restore original values
		for (const [key, originalValue] of originalValues) {
			if (originalValue === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = originalValue;
			}
		}
	}
}

// ============================================================================
// Fixture Loading
// ============================================================================

interface LoadFixtureOptions {
	/**
	 * Base fixtures directory.
	 * Defaults to `${process.cwd()}/__fixtures__`.
	 */
	readonly fixturesDir?: string;
}

/**
 * Load a fixture from the fixtures directory.
 *
 * JSON fixtures are parsed automatically; all other file types are returned as strings.
 *
 * @example
 * ```typescript
 * const note = loadFixture<{ id: string }>("mcp/notes.json");
 * const config = loadFixture("mcp/config.toml");
 * ```
 */
export function loadFixture<T = string>(name: string, options?: LoadFixtureOptions): T {
	const baseDir = options?.fixturesDir ?? join(process.cwd(), "__fixtures__");
	const filePath = join(baseDir, name);
	const content = readFileSync(filePath, "utf-8");

	if (extname(filePath) === ".json") {
		return JSON.parse(content) as T;
	}

	return content as T;
}
