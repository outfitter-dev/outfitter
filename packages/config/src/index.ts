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
// Environment Profiles
// ============================================================================

export type { EnvironmentDefaults, OutfitterEnv } from "./environment.js";
export { getEnvironment, getEnvironmentDefaults } from "./environment.js";

// ============================================================================
// Environment Variable Access
// ============================================================================

export type { Env } from "./env.js";
export {
  booleanSchema,
  env,
  getEnvBoolean,
  optionalBooleanSchema,
  parseEnv,
  portSchema,
} from "./env.js";

// ============================================================================
// XDG Path Functions
// ============================================================================

export {
  getCacheDir,
  getConfigDir,
  getDataDir,
  getStateDir,
} from "./internal/xdg.js";

// ============================================================================
// Parsing (Error Types, Deep Merge, File Parsing)
// ============================================================================

export {
  CircularExtendsError,
  deepMerge,
  ParseError,
  parseConfigFile,
} from "./internal/parsing.js";

// ============================================================================
// Config Loading
// ============================================================================

export type { LoadConfigOptions } from "./internal/loading.js";
export { loadConfig } from "./internal/loading.js";

// ============================================================================
// Config Resolution
// ============================================================================

import { formatZodIssues, Result, ValidationError } from "@outfitter/contracts";
import type { ZodSchema } from "zod";

import { deepMerge, ParseError } from "./internal/parsing.js";

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
  /** Values from environment variables */
  env?: Partial<T>;
  /** Values loaded from config file */
  file?: Partial<T>;
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
  sources: ConfigSources<T>
): Result<
  T,
  InstanceType<typeof ValidationError> | InstanceType<typeof ParseError>
> {
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
    const fullMessage = formatZodIssues(parseResult.error.issues);
    const firstPath = parseResult.error.issues[0]?.path?.join(".");

    return Result.err(
      new ValidationError({
        message: fullMessage,
        ...(firstPath ? { field: firstPath } : {}),
      })
    );
  }

  return Result.ok(parseResult.data);
}

// ============================================================================
// Environment Variable Mapping
// ============================================================================

/**
 * Map environment variables to config object based on prefix.
 *
 * Environment variables are mapped as follows:
 * - `PREFIX_KEY` -> `{ key: value }`
 * - `PREFIX_NESTED__KEY` -> `{ nested: { key: value } }`
 *
 * Only returns values for keys that have matching env vars set.
 * Values are returned as strings; use Zod coercion for type conversion.
 *
 * @param prefix - Environment variable prefix (e.g., "MYAPP")
 * @param schema - Zod schema to determine valid keys (optional, for filtering)
 * @returns Partial config object with mapped values
 *
 * @example
 * ```typescript
 * // With MYAPP_PORT=8080 and MYAPP_DB__HOST=localhost
 * const schema = z.object({
 *   port: z.coerce.number(),
 *   db: z.object({ host: z.string() }),
 * });
 *
 * const envConfig = mapEnvToConfig("MYAPP", schema);
 * // { port: "8080", db: { host: "localhost" } }
 *
 * const result = resolveConfig(schema, { env: envConfig });
 * ```
 */
export function mapEnvToConfig<T>(
  prefix: string,
  _schema?: ZodSchema<T>
): Partial<T> {
  const result: Record<string, unknown> = {};
  const prefixWithUnderscore = `${prefix}_`;

  for (const [key, value] of Object.entries(process.env)) {
    if (!key.startsWith(prefixWithUnderscore) || value === undefined) {
      continue;
    }

    // Remove prefix and convert to lowercase path
    const configPath = key
      .slice(prefixWithUnderscore.length)
      .toLowerCase()
      .split("__");

    // Set nested value
    let current = result;
    for (let i = 0; i < configPath.length - 1; i++) {
      const segment = configPath[i];
      if (segment === undefined) continue;
      if (!(segment in current)) {
        current[segment] = {};
      }
      current = current[segment] as Record<string, unknown>;
    }

    const lastSegment = configPath.at(-1);
    if (lastSegment !== undefined) {
      current[lastSegment] = value;
    }
  }

  return result as Partial<T>;
}
