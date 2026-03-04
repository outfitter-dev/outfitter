import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import {
  formatZodIssues,
  NotFoundError,
  Result,
  ValidationError,
} from "@outfitter/contracts";
import type { ZodSchema } from "zod";

import {
  CircularExtendsError,
  deepMerge,
  ParseError,
  parseConfigFile,
} from "./parsing.js";

// ============================================================================
// Config Loading
// ============================================================================

/** Supported config file extensions in preference order */
const CONFIG_EXTENSIONS = ["toml", "yaml", "yml", "json", "jsonc", "json5"];

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
   * Note: `appName` is appended to each path (e.g., `"/etc/myapp"` becomes `"/etc/myapp/{appName}"`).
   * Paths are searched in order; first match wins.
   */
  searchPaths?: string[];
}

/**
 * Find the first existing config file in the given directory.
 * Searches for config.{toml,yaml,yml,json,jsonc,json5} in preference order.
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
  const xdgConfigHome = process.env["XDG_CONFIG_HOME"];
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
 * Check if a value is a Zod schema (has `safeParse` method).
 *
 * `loadConfig()` overloads accept either a Zod schema or LoadConfigOptions
 * (`{ searchPaths?: string[] }`) as the second argument. We intentionally use
 * `safeParse` presence as the discriminator because options objects in expected
 * call sites do not expose a function with that name.
 * @internal
 */
function isZodSchema(value: unknown): value is ZodSchema {
  return (
    typeof value === "object" &&
    value !== null &&
    "safeParse" in value &&
    typeof (value as Record<string, unknown>)["safeParse"] === "function"
  );
}

// ============================================================================
// Config Extends Support
// ============================================================================

/**
 * Resolve an extends path relative to the config file that contains it.
 * @internal
 */
function resolveExtendsPath(extendsValue: string, fromFile: string): string {
  if (isAbsolute(extendsValue)) {
    return extendsValue;
  }
  // Resolve relative to the directory containing the config file
  return resolve(dirname(fromFile), extendsValue);
}

/**
 * Load a config file and recursively resolve any extends references.
 * @internal
 */
function loadConfigFileWithExtends(
  filePath: string,
  visited: Set<string> = new Set()
): Result<
  Record<string, unknown>,
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ParseError>
  | InstanceType<typeof CircularExtendsError>
> {
  // Normalize path for circular detection
  const normalizedPath = resolve(filePath);

  // Check for circular reference
  if (visited.has(normalizedPath)) {
    return Result.err(
      new CircularExtendsError({
        message: `Circular extends detected: ${[...visited, normalizedPath].join(" -> ")}`,
        chain: [...visited, normalizedPath],
      })
    );
  }

  // Check file exists
  if (!existsSync(filePath)) {
    return Result.err(
      new NotFoundError({
        message: `Config file not found: ${filePath}`,
        resourceType: "config",
        resourceId: filePath,
      })
    );
  }

  // Read file
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return Result.err(
      new NotFoundError({
        message: `Failed to read config file: ${filePath}`,
        resourceType: "config",
        resourceId: filePath,
      })
    );
  }

  // Parse file
  const filename = filePath.split("/").pop() ?? "config";
  const parseResult = parseConfigFile(content, filename);

  if (parseResult.isErr()) {
    return Result.err(parseResult.error);
  }

  const parsed = parseResult.unwrap();

  // Check for extends field
  const extendsValue = parsed["extends"];
  if (extendsValue === undefined) {
    // No extends field, return parsed config as-is
    return Result.ok(parsed);
  }
  if (typeof extendsValue !== "string") {
    // extends exists but is not a string - this is an error
    return Result.err(
      new ParseError({
        message: `Invalid "extends" value in ${filePath}: expected string, got ${typeof extendsValue}`,
        filename: filePath,
      })
    );
  }

  // Mark current file as visited before recursing
  visited.add(normalizedPath);

  // Resolve the extends path
  const extendsPath = resolveExtendsPath(extendsValue, filePath);

  // Recursively load the base config
  const baseResult = loadConfigFileWithExtends(extendsPath, visited);

  if (baseResult.isErr()) {
    return Result.err(baseResult.error);
  }

  // Merge: base config <- current config (current overrides base)
  const baseConfig = baseResult.unwrap();
  const { extends: __, ...currentConfig } = parsed;

  return Result.ok(deepMerge(baseConfig, currentConfig));
}

// ============================================================================
// loadConfig
// ============================================================================

/**
 * Load configuration for an application from XDG-compliant paths.
 *
 * Search order (first found wins):
 * 1. Custom `searchPaths` if provided in options
 * 2. `$XDG_CONFIG_HOME/{appName}/config.{ext}`
 * 3. `~/.config/{appName}/config.{ext}`
 *
 * File format preference: `.toml` > `.yaml` > `.yml` > `.json` > `.jsonc` > `.json5`
 *
 * When called without a schema, returns the raw parsed config as `unknown`.
 * When called with a schema, returns the validated typed config.
 *
 * @param appName - Application name for XDG directory lookup
 * @returns Result containing raw config or NotFoundError/ParseError/CircularExtendsError
 *
 * @example
 * ```typescript
 * // Without schema — returns raw parsed config
 * const result = loadConfig("myapp");
 * if (result.isOk()) {
 *   const config = result.value; // type: unknown
 * }
 * ```
 */
export function loadConfig(
  appName: string
): Result<
  unknown,
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ParseError>
  | InstanceType<typeof CircularExtendsError>
>;

/**
 * Load configuration for an application from XDG-compliant paths.
 *
 * @param appName - Application name for XDG directory lookup
 * @param options - Configuration options (custom search paths)
 * @returns Result containing raw config or NotFoundError/ParseError/CircularExtendsError
 *
 * @example
 * ```typescript
 * // Without schema, with custom search paths
 * const result = loadConfig("myapp", { searchPaths: ["/etc/myapp"] });
 * ```
 */
export function loadConfig(
  appName: string,
  options: LoadConfigOptions
): Result<
  unknown,
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ParseError>
  | InstanceType<typeof CircularExtendsError>
>;

/**
 * Load configuration for an application from XDG-compliant paths.
 *
 * @typeParam T - The configuration type (inferred from schema)
 * @param appName - Application name for XDG directory lookup
 * @param schema - Zod schema for validation
 * @returns Result containing validated config or NotFoundError/ValidationError/ParseError/CircularExtendsError
 *
 * @example
 * ```typescript
 * import { loadConfig } from "@outfitter/config";
 * import { z } from "zod";
 *
 * const AppConfigSchema = z.object({
 *   apiKey: z.string(),
 *   timeout: z.number().default(5000),
 * });
 *
 * const result = loadConfig("myapp", AppConfigSchema);
 * if (result.isOk()) {
 *   console.log(result.value.apiKey); // typed!
 * }
 * ```
 */
export function loadConfig<T>(
  appName: string,
  schema: ZodSchema<T>
): Result<
  T,
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ValidationError>
  | InstanceType<typeof ParseError>
  | InstanceType<typeof CircularExtendsError>
>;

/**
 * Load configuration for an application from XDG-compliant paths.
 *
 * @typeParam T - The configuration type (inferred from schema)
 * @param appName - Application name for XDG directory lookup
 * @param schema - Zod schema for validation
 * @param options - Configuration options (custom search paths)
 * @returns Result containing validated config or NotFoundError/ValidationError/ParseError/CircularExtendsError
 *
 * @example
 * ```typescript
 * const result = loadConfig("myapp", AppConfigSchema, {
 *   searchPaths: ["/etc/myapp", "/opt/myapp/config"],
 * });
 * ```
 */
export function loadConfig<T>(
  appName: string,
  schema: ZodSchema<T>,
  options: LoadConfigOptions
): Result<
  T,
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ValidationError>
  | InstanceType<typeof ParseError>
  | InstanceType<typeof CircularExtendsError>
>;

// Implementation
export function loadConfig<T>(
  appName: string,
  schemaOrOptions?: ZodSchema<T> | LoadConfigOptions,
  maybeOptions?: LoadConfigOptions
): Result<
  T | unknown,
  | InstanceType<typeof NotFoundError>
  | InstanceType<typeof ValidationError>
  | InstanceType<typeof ParseError>
  | InstanceType<typeof CircularExtendsError>
> {
  // Resolve arguments: determine if second arg is schema or options
  let schema: ZodSchema<T> | undefined;
  let options: LoadConfigOptions | undefined;

  if (schemaOrOptions !== undefined) {
    if (isZodSchema(schemaOrOptions)) {
      schema = schemaOrOptions as ZodSchema<T>;
      options = maybeOptions;
    } else {
      // Second arg is LoadConfigOptions
      options = schemaOrOptions as LoadConfigOptions;
    }
  }

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
      })
    );
  }

  // Load config file with extends support
  const loadResult = loadConfigFileWithExtends(configFilePath);

  if (loadResult.isErr()) {
    return Result.err(loadResult.error);
  }

  const parsed = loadResult.unwrap();

  // Without schema: return raw parsed config
  if (!schema) {
    return Result.ok(parsed as unknown);
  }

  // With schema: validate against it
  const validateResult = schema.safeParse(parsed);

  if (!validateResult.success) {
    const fullMessage = formatZodIssues(validateResult.error.issues);
    const firstPath = validateResult.error.issues[0]?.path?.join(".");

    return Result.err(
      new ValidationError({
        message: fullMessage,
        ...(firstPath ? { field: firstPath } : {}),
      })
    );
  }

  return Result.ok(validateResult.data);
}
