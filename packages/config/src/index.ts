/**
 * @outfitter/config
 *
 * XDG-compliant configuration loading with schema validation.
 * Provides a unified interface for loading, validating, and merging
 * configuration from multiple sources (files, environment, defaults).
 *
 * @packageDocumentation
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NotFoundError, Result, TaggedError, ValidationError } from "@outfitter/contracts";
import JSON5 from "json5";
import { parse as parseToml } from "smol-toml";
import { parse as parseYaml } from "yaml";
import type { ZodSchema } from "zod";

// ============================================================================
// Error Types
// ============================================================================

/**
 * Configuration file parse error.
 */
export class ParseError extends TaggedError("ParseError")<{
	message: string;
	filename: string;
	line?: number;
	column?: number;
}>() {
	readonly category = "validation" as const;
}

// ============================================================================
// XDG Path Functions
// ============================================================================

/**
 * Get the XDG config directory for an application.
 * Uses XDG_CONFIG_HOME if set, otherwise defaults to ~/.config
 */
export function getConfigDir(appName: string): string {
	const xdgConfigHome = process.env["XDG_CONFIG_HOME"];
	const home = process.env["HOME"] ?? "";

	const baseDir = xdgConfigHome ?? join(home, ".config");
	return join(baseDir, appName);
}

/**
 * Get the XDG data directory for an application.
 * Uses XDG_DATA_HOME if set, otherwise defaults to ~/.local/share
 */
export function getDataDir(appName: string): string {
	const xdgDataHome = process.env["XDG_DATA_HOME"];
	const home = process.env["HOME"] ?? "";

	const baseDir = xdgDataHome ?? join(home, ".local", "share");
	return join(baseDir, appName);
}

/**
 * Get the XDG cache directory for an application.
 * Uses XDG_CACHE_HOME if set, otherwise defaults to ~/.cache
 */
export function getCacheDir(appName: string): string {
	const xdgCacheHome = process.env["XDG_CACHE_HOME"];
	const home = process.env["HOME"] ?? "";

	const baseDir = xdgCacheHome ?? join(home, ".cache");
	return join(baseDir, appName);
}

/**
 * Get the XDG state directory for an application.
 * Uses XDG_STATE_HOME if set, otherwise defaults to ~/.local/state
 */
export function getStateDir(appName: string): string {
	const xdgStateHome = process.env["XDG_STATE_HOME"];
	const home = process.env["HOME"] ?? "";

	const baseDir = xdgStateHome ?? join(home, ".local", "state");
	return join(baseDir, appName);
}

// ============================================================================
// Deep Merge Utility
// ============================================================================

/**
 * Check if a value is a plain object (not array, null, etc.)
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
 * Deep merge two objects.
 * - Recursively merges nested objects
 * - Arrays are replaced (not concatenated)
 * - null explicitly replaces
 * - undefined is skipped (doesn't override)
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
 */
function getExtension(filename: string): string {
	const lastDot = filename.lastIndexOf(".");
	if (lastDot === -1) {
		return "";
	}
	return filename.slice(lastDot + 1).toLowerCase();
}

/**
 * Parse a configuration file content based on its filename extension.
 * Supports TOML (.toml), YAML (.yaml/.yml), JSON (.json), and JSON5 (.json5).
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
 * Configuration sources for resolution.
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
 * Resolve configuration from multiple sources with precedence:
 * flags > env > file > defaults
 *
 * Validates the merged result against the provided Zod schema.
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
 * Options for loadConfig.
 */
export interface LoadConfigOptions {
	/** Custom search paths (overrides default XDG paths) */
	searchPaths?: string[];
}

/**
 * Find the first existing config file in the given directory.
 * Searches for config.{toml,yaml,yml,json,json5} in preference order.
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
 */
function getDefaultSearchPaths(appName: string): string[] {
	return [
		getConfigDir(appName),
		// Could add project-local paths here: `./${appName}.config.{ext}`
	];
}

/**
 * Load configuration for an application.
 *
 * Search order (first found wins):
 * 1. Custom searchPaths if provided
 * 2. $XDG_CONFIG_HOME/{appName}/config.{toml,yaml,json}
 * 3. ~/.config/{appName}/config.{toml,yaml,json}
 *
 * File format preference: TOML > YAML > JSON > JSON5
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
