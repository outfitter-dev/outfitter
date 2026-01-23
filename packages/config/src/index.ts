/**
 * @outfitter/config
 *
 * XDG-compliant configuration loading with schema validation.
 * Provides a unified interface for loading, validating, and merging
 * configuration from multiple sources (files, environment, defaults).
 *
 * @example
 * ```typescript
 * import { loadConfig, resolveConfig, getConfigDir } from "@outfitter/config";
 * import { z } from "zod";
 *
 * // Define schema
 * const AppConfigSchema = z.object({
 *   apiKey: z.string(),
 *   timeout: z.number().default(5000),
 * });
 *
 * // Load from XDG paths
 * const result = await loadConfig("myapp", AppConfigSchema);
 * if (result.isOk()) {
 *   console.log("Config loaded:", result.value);
 * }
 * ```
 *
 * @packageDocumentation
 */

// ============================================================================
// Environment Variable Access
// ============================================================================

export {
	env,
	parseEnv,
	portSchema,
	booleanSchema,
	optionalBooleanSchema,
	getEnvBoolean,
} from "./env.js";
export type { Env } from "./env.js";

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { TaggedErrorClass } from "@outfitter/contracts";
import { NotFoundError, Result, TaggedError, ValidationError } from "@outfitter/contracts";
import JSON5 from "json5";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import type { ZodSchema } from "zod";

// ============================================================================
// Error Types
// ============================================================================

type ParseErrorFields = {
	/** Human-readable error message describing the parse failure */
	message: string;
	/** Name of the file that failed to parse */
	filename: string;
	/** Line number where the error occurred (if available) */
	line?: number;
	/** Column number where the error occurred (if available) */
	column?: number;
};

const ParseErrorBase: TaggedErrorClass<"ParseError", ParseErrorFields> =
	TaggedError("ParseError")<ParseErrorFields>();

/**
 * Error thrown when a configuration file cannot be parsed.
 *
 * Contains details about the parse failure including the filename
 * and optionally the line/column where the error occurred.
 *
 * @example
 * ```typescript
 * const result = parseConfigFile("invalid toml [", "config.toml");
 * if (result.isErr() && result.error._tag === "ParseError") {
 *   console.error(`Parse error in ${result.error.filename}: ${result.error.message}`);
 * }
 * ```
 */
export class ParseError extends ParseErrorBase {
	readonly category = "validation" as const;
}

// ============================================================================
// XDG Path Functions
// ============================================================================

/**
 * Get the XDG config directory for an application.
 *
 * Uses `XDG_CONFIG_HOME` if set, otherwise defaults to `~/.config`.
 * This follows the XDG Base Directory Specification for storing
 * user-specific configuration files.
 *
 * @param appName - Application name used as subdirectory
 * @returns Absolute path to the application's config directory
 *
 * @example
 * ```typescript
 * // With XDG_CONFIG_HOME="/custom/config"
 * getConfigDir("myapp"); // "/custom/config/myapp"
 *
 * // Without XDG_CONFIG_HOME (uses default)
 * getConfigDir("myapp"); // "/home/user/.config/myapp"
 * ```
 */
export function getConfigDir(appName: string): string {
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const xdgConfigHome = process.env["XDG_CONFIG_HOME"];
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const home = process.env["HOME"] ?? "";

	const baseDir = xdgConfigHome ?? join(home, ".config");
	return join(baseDir, appName);
}

/**
 * Get the XDG data directory for an application.
 *
 * Uses `XDG_DATA_HOME` if set, otherwise defaults to `~/.local/share`.
 * This follows the XDG Base Directory Specification for storing
 * user-specific data files (databases, generated content, etc.).
 *
 * @param appName - Application name used as subdirectory
 * @returns Absolute path to the application's data directory
 *
 * @example
 * ```typescript
 * // With XDG_DATA_HOME="/custom/data"
 * getDataDir("myapp"); // "/custom/data/myapp"
 *
 * // Without XDG_DATA_HOME (uses default)
 * getDataDir("myapp"); // "/home/user/.local/share/myapp"
 * ```
 */
export function getDataDir(appName: string): string {
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const xdgDataHome = process.env["XDG_DATA_HOME"];
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const home = process.env["HOME"] ?? "";

	const baseDir = xdgDataHome ?? join(home, ".local", "share");
	return join(baseDir, appName);
}

/**
 * Get the XDG cache directory for an application.
 *
 * Uses `XDG_CACHE_HOME` if set, otherwise defaults to `~/.cache`.
 * This follows the XDG Base Directory Specification for storing
 * non-essential cached data that can be regenerated.
 *
 * @param appName - Application name used as subdirectory
 * @returns Absolute path to the application's cache directory
 *
 * @example
 * ```typescript
 * // With XDG_CACHE_HOME="/custom/cache"
 * getCacheDir("myapp"); // "/custom/cache/myapp"
 *
 * // Without XDG_CACHE_HOME (uses default)
 * getCacheDir("myapp"); // "/home/user/.cache/myapp"
 * ```
 */
export function getCacheDir(appName: string): string {
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const xdgCacheHome = process.env["XDG_CACHE_HOME"];
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const home = process.env["HOME"] ?? "";

	const baseDir = xdgCacheHome ?? join(home, ".cache");
	return join(baseDir, appName);
}

/**
 * Get the XDG state directory for an application.
 *
 * Uses `XDG_STATE_HOME` if set, otherwise defaults to `~/.local/state`.
 * This follows the XDG Base Directory Specification for storing
 * state data that should persist between restarts (logs, history, etc.).
 *
 * @param appName - Application name used as subdirectory
 * @returns Absolute path to the application's state directory
 *
 * @example
 * ```typescript
 * // With XDG_STATE_HOME="/custom/state"
 * getStateDir("myapp"); // "/custom/state/myapp"
 *
 * // Without XDG_STATE_HOME (uses default)
 * getStateDir("myapp"); // "/home/user/.local/state/myapp"
 * ```
 */
export function getStateDir(appName: string): string {
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const xdgStateHome = process.env["XDG_STATE_HOME"];
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const home = process.env["HOME"] ?? "";

	const baseDir = xdgStateHome ?? join(home, ".local", "state");
	return join(baseDir, appName);
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Check if a value is a plain object (not array, null, etc.)
 * @internal
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== "object") {
		return false;
	}
	// Arrays are not plain objects
	if (Array.isArray(value)) {
		return false;
	}
	return true;
}

/**
 * Deep merge two objects with configurable merge semantics.
 *
 * Merge behavior:
 * - Recursively merges nested plain objects
 * - Arrays are replaced (not concatenated)
 * - `null` explicitly replaces the target value
 * - `undefined` is skipped (does not override)
 *
 * @typeParam T - The type of the target object
 * @param target - Base object to merge into (not mutated)
 * @param source - Object with values to merge
 * @returns New object with merged values
 *
 * @example
 * ```typescript
 * const defaults = { server: { port: 3000, host: "localhost" } };
 * const overrides = { server: { port: 8080 } };
 *
 * const merged = deepMerge(defaults, overrides);
 * // { server: { port: 8080, host: "localhost" } }
 * ```
 *
 * @example
 * ```typescript
 * // Arrays replace, not merge
 * const target = { tags: ["a", "b"] };
 * const source = { tags: ["c"] };
 * deepMerge(target, source); // { tags: ["c"] }
 *
 * // undefined is skipped
 * const base = { a: 1, b: 2 };
 * deepMerge(base, { a: undefined, b: 3 }); // { a: 1, b: 3 }
 *
 * // null explicitly replaces
 * deepMerge(base, { a: null }); // { a: null, b: 2 }
 * ```
 */
export function deepMerge<T extends object>(target: T, source: Partial<T>): T {
	// Create a new object to avoid mutating the original
	const result = { ...target } as Record<string, unknown>;

	for (const key of Object.keys(source)) {
		const sourceValue = (source as Record<string, unknown>)[key];
		const targetValue = result[key];

		// undefined doesn't override
		if (sourceValue === undefined) {
			continue;
		}

		// null explicitly replaces
		if (sourceValue === null) {
			result[key] = null;
			continue;
		}

		// Arrays replace (not merge)
		if (Array.isArray(sourceValue)) {
			result[key] = sourceValue;
			continue;
		}

		// Recursively merge plain objects
		if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
			result[key] = deepMerge(
				targetValue as Record<string, unknown>,
				sourceValue as Partial<Record<string, unknown>>,
			);
			continue;
		}

		// Otherwise, source replaces target
		result[key] = sourceValue;
	}

	return result as T;
}

// ============================================================================
// Config File Parsing
// ============================================================================

/**
 * Get the file extension from a filename (lowercase, without dot).
 * @internal
 */
function getExtension(filename: string): string {
	const lastDot = filename.lastIndexOf(".");
	if (lastDot === -1) {
		return "";
	}
	return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Parse configuration file content based on filename extension.
 *
 * Supports multiple formats:
 * - `.toml` - Parsed with smol-toml (preferred for config)
 * - `.yaml`, `.yml` - Parsed with yaml (merge key support enabled)
 * - `.json` - Parsed with strict JSON.parse
 * - `.json5` - Parsed with json5 (comments and trailing commas allowed)
 *
 * @param content - Raw file content to parse
 * @param filename - Filename used to determine format (by extension)
 * @returns Result containing parsed object or ParseError
 *
 * @example
 * ```typescript
 * const toml = `
 * [server]
 * port = 3000
 * host = "localhost"
 * `;
 *
 * const result = parseConfigFile(toml, "config.toml");
 * if (result.isOk()) {
 *   console.log(result.value.server.port); // 3000
 * }
 * ```
 *
 * @example
 * ```typescript
 * // YAML with anchors/aliases
 * const yaml = `
 * defaults: &defaults
 *   timeout: 5000
 * server:
 *   <<: *defaults
 *   port: 3000
 * `;
 *
 * const result = parseConfigFile(yaml, "config.yaml");
 * if (result.isOk()) {
 *   console.log(result.value.server.timeout); // 5000
 * }
 * ```
 */
export function parseConfigFile(
	content: string,
	filename: string,
): Result<Record<string, unknown>, InstanceType<typeof ParseError>> {
	const ext = getExtension(filename);

	try {
		switch (ext) {
			case "toml": {
				const parsed = parseToml(content);
				return Result.ok(parsed as Record<string, unknown>);
			}

			case "yaml":
			case "yml": {
				// Enable merge key support for YAML anchors/aliases
				const parsed = parseYaml(content, { merge: true });
				if (parsed === null || typeof parsed !== "object") {
					return Result.ok({});
				}
				return Result.ok(parsed as Record<string, unknown>);
			}

			case "json": {
				// Use strict JSON parsing for .json files
				const parsed = JSON.parse(content);
				return Result.ok(parsed as Record<string, unknown>);
			}

			case "json5": {
				const parsed = JSON5.parse(content);
				return Result.ok(parsed as Record<string, unknown>);
			}

			default: {
				return Result.err(
					new ParseError({
						message: `Unsupported config file extension: .${ext}`,
						filename,
					}),
				);
			}
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown parse error";
		return Result.err(
			new ParseError({
				message: `Failed to parse ${filename}: ${message}`,
				filename,
			}),
		);
	}
}

// ============================================================================
// Config Resolution
// ============================================================================

/**
 * Configuration sources for multi-layer resolution.
 *
 * Sources are merged in precedence order (lowest to highest):
 * `defaults` < `file` < `env` < `flags`
 *
 * @typeParam T - The configuration type
 *
 * @example
 * ```typescript
 * const sources: ConfigSources<AppConfig> = {
 *   defaults: { timeout: 5000, debug: false },
 *   file: loadedFromDisk,
 *   env: { timeout: parseInt(process.env.TIMEOUT!) },
 *   flags: { debug: cliArgs.debug },
 * };
 * ```
 */
export interface ConfigSources<T> {
	/** Default values (lowest precedence) */
	defaults?: Partial<T>;
	/** Values loaded from config file */
	file?: Partial<T>;
	/** Values from environment variables */
	env?: Partial<T>;
	/** CLI flag values (highest precedence) */
	flags?: Partial<T>;
}

/**
 * Resolve configuration from multiple sources with precedence.
 *
 * Merges sources in order: `defaults` < `file` < `env` < `flags`.
 * Higher precedence sources override lower ones. Nested objects
 * are deep-merged; arrays are replaced.
 *
 * The merged result is validated against the provided Zod schema.
 *
 * @typeParam T - The configuration type (inferred from schema)
 * @param schema - Zod schema for validation
 * @param sources - Configuration sources to merge
 * @returns Result containing validated config or ValidationError/ParseError
 *
 * @example
 * ```typescript
 * const AppSchema = z.object({
 *   port: z.number().min(1).max(65535),
 *   host: z.string(),
 *   debug: z.boolean().default(false),
 * });
 *
 * const result = resolveConfig(AppSchema, {
 *   defaults: { port: 3000, host: "localhost" },
 *   file: { port: 8080 },
 *   env: { debug: true },
 *   flags: { port: 9000 },
 * });
 *
 * if (result.isOk()) {
 *   // { port: 9000, host: "localhost", debug: true }
 *   console.log(result.value);
 * }
 * ```
 */
export function resolveConfig<T>(
	schema: ZodSchema<T>,
	sources: ConfigSources<T>,
): Result<T, InstanceType<typeof ValidationError> | InstanceType<typeof ParseError>> {
	// Start with empty object and merge in precedence order
	let merged: Record<string, unknown> = {};

	if (sources.defaults) {
		merged = deepMerge(merged, sources.defaults as Record<string, unknown>);
	}

	if (sources.file) {
		merged = deepMerge(merged, sources.file as Record<string, unknown>);
	}

	if (sources.env) {
		merged = deepMerge(merged, sources.env as Record<string, unknown>);
	}

	if (sources.flags) {
		merged = deepMerge(merged, sources.flags as Record<string, unknown>);
	}

	// Validate against schema
	const parseResult = schema.safeParse(merged);

	if (!parseResult.success) {
		const issues = parseResult.error.issues;
		const firstIssue = issues[0];
		const path = firstIssue?.path?.join(".") ?? "";
		const message = firstIssue?.message ?? "Validation failed";
		const fullMessage = path ? `${path}: ${message}` : message;

		return Result.err(
			new ValidationError({
				message: fullMessage,
				...(path ? { field: path } : {}),
			}),
		);
	}

	return Result.ok(parseResult.data);
}

// ============================================================================
// Config Loading
// ============================================================================

/** Supported config file extensions in preference order */
const CONFIG_EXTENSIONS = ["toml", "yaml", "yml", "json", "json5"];

/**
 * Options for the {@link loadConfig} function.
 *
 * @example
 * ```typescript
 * const options: LoadConfigOptions = {
 *   searchPaths: ["/etc/myapp", "/opt/myapp/config"],
 * };
 * ```
 */
export interface LoadConfigOptions {
	/**
	 * Custom search paths to check for config files.
	 * When provided, overrides the default XDG-based search paths.
	 * Paths are searched in order; first match wins.
	 */
	searchPaths?: string[];
}

/**
 * Find the first existing config file in the given directory.
 * Searches for config.{toml,yaml,yml,json,json5} in preference order.
 * @internal
 */
function findConfigFile(dir: string): string | undefined {
	for (const ext of CONFIG_EXTENSIONS) {
		const filePath = join(dir, `config.${ext}`);
		if (existsSync(filePath)) {
			return filePath;
		}
	}
	return undefined;
}

/**
 * Get default search paths for an application.
 * When XDG_CONFIG_HOME is set, includes both the XDG path and ~/.config fallback.
 * @internal
 */
function getDefaultSearchPaths(appName: string): string[] {
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const xdgConfigHome = process.env["XDG_CONFIG_HOME"];
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const home = process.env["HOME"] ?? "";
	const defaultConfigPath = join(home, ".config", appName);

	// If XDG_CONFIG_HOME is set, search both the XDG path and ~/.config fallback
	if (xdgConfigHome) {
		const xdgPath = join(xdgConfigHome, appName);
		// Only include both if they're different paths
		if (xdgPath !== defaultConfigPath) {
			return [xdgPath, defaultConfigPath];
		}
	}

	return [defaultConfigPath];
}

/**
 * Load configuration for an application from XDG-compliant paths.
 *
 * Search order (first found wins):
 * 1. Custom `searchPaths` if provided in options
 * 2. `$XDG_CONFIG_HOME/{appName}/config.{ext}`
 * 3. `~/.config/{appName}/config.{ext}`
 *
 * File format preference: `.toml` > `.yaml` > `.yml` > `.json` > `.json5`
 *
 * @typeParam T - The configuration type (inferred from schema)
 * @param appName - Application name for XDG directory lookup
 * @param schema - Zod schema for validation
 * @param options - Optional configuration (custom search paths)
 * @returns Result containing validated config or NotFoundError/ValidationError/ParseError
 *
 * @example
 * ```typescript
 * import { loadConfig } from "@outfitter/config";
 * import { z } from "zod";
 *
 * const AppConfigSchema = z.object({
 *   apiKey: z.string(),
 *   timeout: z.number().default(5000),
 *   features: z.object({
 *     darkMode: z.boolean().default(false),
 *   }),
 * });
 *
 * // Searches ~/.config/myapp/config.{toml,yaml,json,...}
 * const result = await loadConfig("myapp", AppConfigSchema);
 *
 * if (result.isOk()) {
 *   console.log("API Key:", result.value.apiKey);
 *   console.log("Timeout:", result.value.timeout);
 * } else {
 *   console.error("Failed to load config:", result.error.message);
 * }
 * ```
 *
 * @example
 * ```typescript
 * // With custom search paths
 * const result = await loadConfig("myapp", AppConfigSchema, {
 *   searchPaths: ["/etc/myapp", "/opt/myapp/config"],
 * });
 * ```
 */
export async function loadConfig<T>(
	appName: string,
	schema: ZodSchema<T>,
	options?: LoadConfigOptions,
): Promise<
	Result<
		T,
		| InstanceType<typeof NotFoundError>
		| InstanceType<typeof ValidationError>
		| InstanceType<typeof ParseError>
	>
> {
	// Determine search paths
	const searchPaths = options?.searchPaths
		? options.searchPaths.map((p) => join(p, appName))
		: getDefaultSearchPaths(appName);

	// Find first existing config file
	let configFilePath: string | undefined;

	for (const searchPath of searchPaths) {
		const found = findConfigFile(searchPath);
		if (found) {
			configFilePath = found;
			break;
		}
	}

	if (!configFilePath) {
		return Result.err(
			new NotFoundError({
				message: `Configuration file not found for ${appName}`,
				resourceType: "config",
				resourceId: appName,
			}),
		);
	}

	// Read and parse the config file
	let content: string;
	try {
		content = readFileSync(configFilePath, "utf-8");
	} catch {
		return Result.err(
			new NotFoundError({
				message: `Failed to read config file: ${configFilePath}`,
				resourceType: "config",
				resourceId: configFilePath,
			}),
		);
	}

	// Parse the config file
	const filename = configFilePath.split("/").pop() ?? "config";
	const parseResult = parseConfigFile(content, filename);

	if (parseResult.isErr()) {
		return Result.err(parseResult.error);
	}

	// Validate against schema
	const parsed = parseResult.unwrap();
	const validateResult = schema.safeParse(parsed);

	if (!validateResult.success) {
		const issues = validateResult.error.issues;
		const firstIssue = issues[0];
		const path = firstIssue?.path?.join(".") ?? "";
		const message = firstIssue?.message ?? "Validation failed";
		const fullMessage = path ? `${path}: ${message}` : message;

		return Result.err(
			new ValidationError({
				message: fullMessage,
				...(path ? { field: path } : {}),
			}),
		);
	}

	return Result.ok(validateResult.data);
}
