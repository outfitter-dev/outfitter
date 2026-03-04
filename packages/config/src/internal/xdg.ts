import { join } from "node:path";

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
  const xdgConfigHome = process.env["XDG_CONFIG_HOME"];
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
  const xdgDataHome = process.env["XDG_DATA_HOME"];
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
  const xdgCacheHome = process.env["XDG_CACHE_HOME"];
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
  const xdgStateHome = process.env["XDG_STATE_HOME"];
  const home = process.env["HOME"] ?? "";

  const baseDir = xdgStateHome ?? join(home, ".local", "state");
  return join(baseDir, appName);
}
