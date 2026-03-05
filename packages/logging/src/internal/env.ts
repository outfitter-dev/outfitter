import {
  getEnvironment as _getEnvironment,
  getEnvironmentDefaults as _getEnvironmentDefaults,
} from "@outfitter/config";

import type { LogLevel } from "./types.js";

// ============================================================================
// Runtime Safety Helpers
// ============================================================================

/**
 * Safely read an environment variable.
 * Returns undefined in runtimes where `process` is not available (e.g., edge runtimes, V8 isolates).
 */
function safeGetEnv(key: string): string | undefined {
  if (typeof process !== "undefined") {
    // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-aware log level resolution
    return process.env?.[key];
  }
  return undefined;
}

// ============================================================================
// Environment-Aware Log Level Resolution
// ============================================================================

/**
 * Map from OUTFITTER_LOG_LEVEL / environment defaults values to LogLevel.
 *
 * MCP-style levels (warning, emergency, etc.) are mapped to the
 * closest LogLevel equivalent.
 */
const ENV_LEVEL_MAP: Readonly<Record<string, LogLevel>> = {
  trace: "trace",
  debug: "debug",
  info: "info",
  notice: "info",
  warn: "warn",
  warning: "warn",
  error: "error",
  critical: "fatal",
  alert: "fatal",
  emergency: "fatal",
  fatal: "fatal",
  silent: "silent",
};

/**
 * Resolve the log level from environment configuration.
 *
 * Precedence (highest wins):
 * 1. `OUTFITTER_LOG_LEVEL` environment variable
 * 2. Explicit `level` parameter
 * 3. `OUTFITTER_ENV` environment profile defaults
 * 4. `"info"` (default)
 *
 * @param level - Optional explicit log level (overridden by env var)
 * @returns Resolved LogLevel
 *
 * @example
 * ```typescript
 * import { createLogger, resolveLogLevel } from "@outfitter/logging";
 *
 * // Auto-resolve from environment
 * const logger = createLogger({
 *   name: "my-app",
 *   level: resolveLogLevel(),
 * });
 *
 * // With OUTFITTER_ENV=development → "debug"
 * // With OUTFITTER_LOG_LEVEL=error → "error" (overrides everything)
 * // With nothing set → "info"
 * ```
 */
export function resolveLogLevel(level?: LogLevel | string): LogLevel {
  // 1. OUTFITTER_LOG_LEVEL env var (highest precedence)
  const envLogLevel = safeGetEnv("OUTFITTER_LOG_LEVEL");
  if (envLogLevel !== undefined && Object.hasOwn(ENV_LEVEL_MAP, envLogLevel)) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
    return ENV_LEVEL_MAP[envLogLevel]!;
  }

  // 2. Explicit level parameter (validate strings via ENV_LEVEL_MAP)
  if (level !== undefined && Object.hasOwn(ENV_LEVEL_MAP, level)) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
    return ENV_LEVEL_MAP[level]!;
  }

  // 3. Environment profile (guarded for edge runtimes without process)
  try {
    const env = _getEnvironment();
    const defaults = _getEnvironmentDefaults(env);
    if (
      defaults.logLevel !== null &&
      Object.hasOwn(ENV_LEVEL_MAP, defaults.logLevel)
    ) {
      // oxlint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
      return ENV_LEVEL_MAP[defaults.logLevel]!;
    }
  } catch {
    // process.env unavailable (edge runtime) — fall through to default
  }

  // 4. Default
  return "info";
}

/**
 * Resolve log level using Outfitter runtime defaults.
 *
 * Precedence (highest wins):
 * 1. `OUTFITTER_LOG_LEVEL` environment variable
 * 2. Explicit `level` parameter
 * 3. `OUTFITTER_ENV` profile defaults
 * 4. `"silent"` (when profile default is null)
 */
export function resolveOutfitterLogLevel(level?: LogLevel | string): LogLevel {
  // 1. OUTFITTER_LOG_LEVEL env var (highest precedence)
  const envLogLevel = safeGetEnv("OUTFITTER_LOG_LEVEL");
  if (envLogLevel !== undefined && Object.hasOwn(ENV_LEVEL_MAP, envLogLevel)) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
    return ENV_LEVEL_MAP[envLogLevel]!;
  }

  // 2. Explicit level parameter (validate strings via ENV_LEVEL_MAP)
  if (level !== undefined && Object.hasOwn(ENV_LEVEL_MAP, level)) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
    return ENV_LEVEL_MAP[level]!;
  }

  // 3. Environment profile (guarded for edge runtimes without process)
  try {
    const env = _getEnvironment();
    const defaults = _getEnvironmentDefaults(env);
    if (
      defaults.logLevel !== null &&
      Object.hasOwn(ENV_LEVEL_MAP, defaults.logLevel)
    ) {
      // oxlint-disable-next-line typescript/no-non-null-assertion -- hasOwn guarantees key exists
      return ENV_LEVEL_MAP[defaults.logLevel]!;
    }
  } catch {
    // process.env unavailable (edge runtime) — fall through to default
  }

  // 4. Default: profile disabled logging
  return "silent";
}
