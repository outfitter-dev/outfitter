/**
 * Terminal detection utilities.
 *
 * Functions for detecting terminal capabilities including color support,
 * terminal width, and interactivity.
 *
 * @packageDocumentation
 */

import { getEnvBoolean } from "@outfitter/config";

/**
 * Options for terminal detection functions.
 *
 * These options allow overriding automatic detection for testing
 * or specific environments.
 *
 * @example
 * ```typescript
 * // Force TTY mode for testing
 * supportsColor({ isTTY: true });
 *
 * // Simulate CI environment
 * isInteractive({ isTTY: true, isCI: true }); // returns false
 * ```
 */
export interface TerminalOptions {
  /** Override CI detection (uses CI env variable if not specified) */
  isCI?: boolean;
  /** Override TTY detection (uses process.stdout.isTTY if not specified) */
  isTTY?: boolean;
}

/**
 * Gets the value of an environment variable.
 *
 * @param key - Environment variable name
 * @returns The value if set, undefined otherwise
 */
export function getEnvValue(
  key: "NO_COLOR" | "FORCE_COLOR"
): string | undefined {
  return process.env[key];
}

/**
 * Checks if NO_COLOR environment variable is set.
 *
 * @returns `true` if NO_COLOR is set (even if empty)
 */
export function hasNoColorEnv(): boolean {
  return getEnvValue("NO_COLOR") !== undefined;
}

/**
 * Resolves the FORCE_COLOR environment variable.
 *
 * @returns `true` if colors should be forced, `false` if explicitly disabled, `undefined` if not set
 */
export function resolveForceColorEnv(): boolean | undefined {
  const value = getEnvValue("FORCE_COLOR");
  if (value === undefined) {
    return undefined;
  }
  if (value === "") {
    return true;
  }
  const numeric = Number(value);
  if (!Number.isNaN(numeric)) {
    return numeric > 0;
  }
  return true;
}

/**
 * Resolves color environment variables with configurable priority.
 *
 * @param options - Options for resolution priority
 * @returns `true` if colors enabled, `false` if disabled, `undefined` if not determined by env
 */
export function resolveColorEnv(options?: {
  forceColorFirst?: boolean;
}): boolean | undefined {
  const forced = resolveForceColorEnv();
  const noColor = hasNoColorEnv();

  if (options?.forceColorFirst) {
    if (forced !== undefined) {
      return forced;
    }
    if (noColor) {
      return false;
    }
  } else {
    if (noColor) {
      return false;
    }
    if (forced !== undefined) {
      return forced;
    }
  }

  return undefined;
}

/**
 * Checks if the current environment supports ANSI colors.
 *
 * Detection priority:
 * 1. `NO_COLOR` env variable - if set (even empty), returns false (per no-color.org)
 * 2. `FORCE_COLOR` env variable - if set, returns true (numeric levels > 0)
 * 3. Falls back to TTY detection via `process.stdout.isTTY`
 *
 * @param options - Optional overrides for TTY detection
 * @returns `true` if colors are supported, `false` otherwise
 *
 * @example
 * ```typescript
 * if (supportsColor()) {
 *   console.log("\x1b[32mGreen text\x1b[0m");
 * } else {
 *   console.log("Plain text");
 * }
 *
 * // With explicit TTY override for testing
 * supportsColor({ isTTY: true });  // true (unless NO_COLOR is set)
 * supportsColor({ isTTY: false }); // false (unless FORCE_COLOR is set)
 * ```
 */
export function supportsColor(options?: TerminalOptions): boolean {
  const env = resolveColorEnv();
  if (env !== undefined) {
    return env;
  }

  // Check isTTY option if provided
  if (options?.isTTY !== undefined) {
    return options.isTTY;
  }

  // Default to checking stdout
  return process.stdout.isTTY ?? false;
}

/**
 * Gets the terminal width in columns.
 *
 * Returns `process.stdout.columns` when in a TTY, or 80 as a fallback
 * for non-TTY environments (pipes, CI, etc.).
 *
 * @param options - Optional overrides for TTY detection
 * @returns Terminal width in columns (default: 80 if not TTY)
 *
 * @example
 * ```typescript
 * const width = getTerminalWidth();
 * console.log(`Terminal is ${width} columns wide`);
 *
 * // Force non-TTY mode (always returns 80)
 * getTerminalWidth({ isTTY: false }); // 80
 * ```
 */
export function getTerminalWidth(options?: TerminalOptions): number {
  const isTTY = options?.isTTY ?? process.stdout.isTTY ?? false;

  if (!isTTY) {
    return 80;
  }

  return process.stdout.columns ?? 80;
}

/**
 * Checks if the terminal is interactive.
 *
 * A terminal is considered interactive when:
 * - It is a TTY (process.stdout.isTTY is true)
 * - It is NOT running in a CI environment (CI env variable is not set)
 *
 * Use this to decide whether to show interactive prompts or use
 * non-interactive fallbacks.
 *
 * @param options - Optional overrides for TTY and CI detection
 * @returns `true` if interactive prompts are safe to use
 *
 * @example
 * ```typescript
 * if (isInteractive()) {
 *   // Safe to use interactive prompts
 *   const answer = await prompt("Continue?");
 * } else {
 *   // Use non-interactive defaults
 *   console.log("Running in non-interactive mode");
 * }
 * ```
 */
export function isInteractive(options?: TerminalOptions): boolean {
  // Check CI environment first
  // Using getEnvBoolean for dynamic reads (needed for tests)
  const isCI = options?.isCI ?? getEnvBoolean("CI") === true;

  if (isCI) {
    return false;
  }

  // Check TTY
  const isTTY = options?.isTTY ?? process.stdout.isTTY ?? false;
  return isTTY;
}
