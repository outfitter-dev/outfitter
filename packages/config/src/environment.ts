/**
 * Unified environment profiles for Outfitter packages.
 *
 * Provides a shared "environment" concept that cascades defaults
 * across all Outfitter packages. The environment is determined by
 * the `OUTFITTER_ENV` environment variable, falling back to
 * `"production"` when unset or invalid.
 *
 * @example
 * ```typescript
 * import { getEnvironment, getEnvironmentDefaults } from "@outfitter/config";
 *
 * const env = getEnvironment(); // "development" | "production" | "test"
 * const defaults = getEnvironmentDefaults(env);
 *
 * if (defaults.verbose) {
 *   console.log("Verbose mode enabled");
 * }
 * ```
 *
 * @module
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Valid Outfitter environment names.
 *
 * - `"development"` — Local development with verbose output and debug logging
 * - `"production"` — Production deployments with minimal output
 * - `"test"` — Test runs with full error detail but no logging
 */
export type OutfitterEnv = "development" | "production" | "test";

/**
 * Profile-specific defaults for an environment.
 *
 * These defaults provide sensible starting values that individual
 * packages can override or extend.
 */
export interface EnvironmentDefaults {
  /** How much error detail to include in output. */
  errorDetail: "full" | "message";
  /** Default log level. `null` means logging is disabled by default. */
  logLevel: "debug" | "info" | "warn" | "error" | null;
  /** Whether verbose output is enabled by default. */
  verbose: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const VALID_ENVIRONMENTS: ReadonlySet<OutfitterEnv> = new Set([
  "development",
  "production",
  "test",
]);

const ENVIRONMENT_DEFAULTS: Readonly<
  Record<OutfitterEnv, EnvironmentDefaults>
> = {
  development: {
    logLevel: "debug",
    verbose: true,
    errorDetail: "full",
  },
  production: {
    logLevel: null,
    verbose: false,
    errorDetail: "message",
  },
  test: {
    logLevel: null,
    verbose: false,
    errorDetail: "full",
  },
};

// ============================================================================
// Functions
// ============================================================================

/**
 * Determine the current Outfitter environment.
 *
 * Reads the `OUTFITTER_ENV` environment variable. If set to a valid
 * value (`"development"`, `"production"`, or `"test"`), returns that
 * value. Otherwise falls back to `"production"`.
 *
 * @returns The current environment
 *
 * @example
 * ```typescript
 * // With OUTFITTER_ENV=development
 * getEnvironment(); // "development"
 *
 * // With OUTFITTER_ENV unset or invalid
 * getEnvironment(); // "production"
 * ```
 */
export function getEnvironment(): OutfitterEnv {
  const value = process.env["OUTFITTER_ENV"];

  if (value !== undefined && VALID_ENVIRONMENTS.has(value as OutfitterEnv)) {
    return value as OutfitterEnv;
  }

  return "production";
}

/**
 * Get the default settings for an environment profile.
 *
 * Returns a shallow copy of the defaults for the given environment.
 * These defaults are intended as starting values that individual
 * packages can override via their own configuration.
 *
 * | Setting | `development` | `production` | `test` |
 * |---------|--------------|-------------|--------|
 * | logLevel | `"debug"` | `null` | `null` |
 * | verbose | `true` | `false` | `false` |
 * | errorDetail | `"full"` | `"message"` | `"full"` |
 *
 * @param env - The environment to get defaults for
 * @returns Profile-specific default settings
 *
 * @example
 * ```typescript
 * const defaults = getEnvironmentDefaults("development");
 * // { logLevel: "debug", verbose: true, errorDetail: "full" }
 *
 * const prodDefaults = getEnvironmentDefaults("production");
 * // { logLevel: null, verbose: false, errorDetail: "message" }
 * ```
 */
export function getEnvironmentDefaults(env: OutfitterEnv): EnvironmentDefaults {
  return { ...ENVIRONMENT_DEFAULTS[env] };
}
