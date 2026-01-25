/**
 * Centralized environment variable access with Zod validation.
 *
 * This module provides a single point of access for process.env,
 * eliminating the need for biome-ignore comments throughout the codebase
 * (TypeScript's `noPropertyAccessFromIndexSignature` conflicts with
 * Biome's `useLiteralKeys` rule).
 *
 * @example
 * ```typescript
 * import { env, parseEnv, portSchema } from "@outfitter/config";
 *
 * // Use pre-parsed app env
 * if (env.CI) {
 *   console.log("Running in CI");
 * }
 *
 * // Parse custom env schema
 * const myEnv = parseEnv(z.object({
 *   API_KEY: z.string(),
 *   PORT: portSchema,
 * }));
 * ```
 *
 * @module
 */
import { z } from "zod";

// ============================================================================
// Reusable Schema Helpers
// ============================================================================

/**
 * Port number schema (1-65535) with string-to-number coercion.
 *
 * Validates that a string contains only digits, then transforms
 * to a number and validates the port range.
 *
 * @example
 * ```typescript
 * const schema = z.object({ PORT: portSchema });
 * schema.parse({ PORT: "3000" }); // { PORT: 3000 }
 * schema.parse({ PORT: "invalid" }); // throws
 * schema.parse({ PORT: "99999" }); // throws (out of range)
 * ```
 */
export const portSchema: z.ZodType<number, string> = z
	.string()
	.regex(/^\d+$/)
	.transform(Number)
	.pipe(z.number().int().positive().max(65535));

/**
 * Boolean schema with proper string coercion.
 *
 * Accepts: "true", "false", "1", "0", ""
 * - "true" or "1" -> true
 * - "false", "0", or "" -> false
 *
 * @example
 * ```typescript
 * const schema = z.object({ DEBUG: booleanSchema });
 * schema.parse({ DEBUG: "true" }); // { DEBUG: true }
 * schema.parse({ DEBUG: "1" }); // { DEBUG: true }
 * schema.parse({ DEBUG: "false" }); // { DEBUG: false }
 * schema.parse({ DEBUG: "" }); // { DEBUG: false }
 * ```
 */
export const booleanSchema: z.ZodType<boolean, string> = z
	.enum(["true", "false", "1", "0", ""])
	.transform((val) => val === "true" || val === "1");

/**
 * Optional boolean schema - returns undefined if not set.
 *
 * Unlike `booleanSchema`, this returns `undefined` for missing
 * or empty values, allowing callers to distinguish between
 * "explicitly set to false" and "not set".
 *
 * @example
 * ```typescript
 * const schema = z.object({ NO_COLOR: optionalBooleanSchema });
 * schema.parse({ NO_COLOR: "true" }); // { NO_COLOR: true }
 * schema.parse({ NO_COLOR: "" }); // { NO_COLOR: undefined }
 * schema.parse({ NO_COLOR: undefined }); // { NO_COLOR: undefined }
 * ```
 */
export const optionalBooleanSchema: z.ZodType<boolean | undefined, string | undefined> = z
	.string()
	.optional()
	.transform((val) => {
		if (val === undefined || val === "") return undefined;
		return val === "true" || val === "1";
	});

// ============================================================================
// Parse Function
// ============================================================================

/**
 * Parse and validate environment variables against a Zod schema.
 *
 * By default reads from `process.env`, but accepts a custom env
 * object for testing.
 *
 * @typeParam T - The Zod schema shape
 * @param schema - Zod object schema to validate against
 * @param envObj - Environment object (defaults to process.env)
 * @returns Validated and transformed environment object
 * @throws {z.ZodError} When validation fails
 *
 * @example
 * ```typescript
 * const AppEnv = z.object({
 *   PORT: portSchema,
 *   DEBUG: booleanSchema,
 * });
 *
 * const env = parseEnv(AppEnv);
 * console.log(env.PORT); // number
 * console.log(env.DEBUG); // boolean
 * ```
 */
export function parseEnv<T extends z.ZodRawShape>(
	schema: z.ZodObject<T>,
	envObj: Record<string, string | undefined> = process.env,
): z.infer<z.ZodObject<T>> {
	return schema.parse(envObj);
}

// ============================================================================
// App-Level Environment
// ============================================================================

type AppEnvShape = {
	NODE_ENV: z.ZodDefault<
		z.ZodEnum<{
			development: "development";
			test: "test";
			production: "production";
		}>
	>;
	NO_COLOR: typeof optionalBooleanSchema;
	FORCE_COLOR: typeof optionalBooleanSchema;
	CI: typeof optionalBooleanSchema;
	TERM: z.ZodOptional<z.ZodString>;
	XDG_CONFIG_HOME: z.ZodOptional<z.ZodString>;
	XDG_DATA_HOME: z.ZodOptional<z.ZodString>;
	XDG_STATE_HOME: z.ZodOptional<z.ZodString>;
	XDG_CACHE_HOME: z.ZodOptional<z.ZodString>;
	HOME: z.ZodOptional<z.ZodString>;
};

/**
 * Schema for common application environment variables.
 */
const appEnvSchema: z.ZodObject<AppEnvShape> = z.object({
	NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

	// Terminal detection
	NO_COLOR: optionalBooleanSchema,
	FORCE_COLOR: optionalBooleanSchema,
	CI: optionalBooleanSchema,
	TERM: z.string().optional(),

	// XDG paths
	XDG_CONFIG_HOME: z.string().optional(),
	XDG_DATA_HOME: z.string().optional(),
	XDG_STATE_HOME: z.string().optional(),
	XDG_CACHE_HOME: z.string().optional(),
	HOME: z.string().optional(),
});

/**
 * Type for the pre-parsed application environment.
 */
export type Env = z.infer<typeof appEnvSchema>;

/**
 * Pre-parsed application environment.
 *
 * Access common environment variables with proper typing:
 * - `env.NODE_ENV`: "development" | "test" | "production"
 * - `env.NO_COLOR`: boolean | undefined
 * - `env.FORCE_COLOR`: boolean | undefined
 * - `env.CI`: boolean | undefined
 * - `env.TERM`: string | undefined
 * - `env.XDG_*`: string | undefined
 * - `env.HOME`: string | undefined
 *
 * @example
 * ```typescript
 * import { env } from "@outfitter/config";
 *
 * if (env.CI) {
 *   console.log("Running in CI environment");
 * }
 *
 * if (env.NO_COLOR) {
 *   // Disable color output
 * }
 * ```
 */
export const env: Env = parseEnv(appEnvSchema);

// ============================================================================
// Dynamic Environment Access
// ============================================================================

/**
 * Reads an optional boolean from process.env at call time.
 *
 * Unlike `env.NO_COLOR` (which is static), this reads dynamically
 * for use cases where env vars may change at runtime (e.g., tests).
 *
 * @param key - The environment variable name to read
 * @returns `true` if "true"/"1", `false` if "false"/"0", `undefined` otherwise
 *
 * @example
 * ```typescript
 * // For terminal detection that needs dynamic behavior
 * if (getEnvBoolean("NO_COLOR")) {
 *   // colors disabled
 * }
 * ```
 */
export function getEnvBoolean(key: "NO_COLOR" | "FORCE_COLOR" | "CI"): boolean | undefined {
	const value = process.env[key];
	if (value === undefined || value === "") return undefined;
	return value === "true" || value === "1";
}
