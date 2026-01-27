/**
 * Pagination state persistence utilities.
 *
 * Handles cursor-based pagination state that persists per-command
 * for --next and --reset functionality.
 *
 * XDG State Directory Pattern:
 * Path: $XDG_STATE_HOME/{toolName}/cursors/{command}[/{context}]/cursor.json
 *
 * @packageDocumentation
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CursorOptions, PaginationState } from "./types.js";

/**
 * Pattern matching unsafe path components:
 * - ".." path traversal (standalone or within path)
 * - Absolute paths starting with /
 * - Windows-style paths with drive letters
 */
const UNSAFE_PATH_PATTERN = /(?:^|[\\/])\.\.(?:[\\/]|$)|^[\\/]|^[a-zA-Z]:/;

/**
 * Validates a path component is safe to use in filesystem operations.
 * @throws Error if path contains traversal or absolute path indicators
 */
function validatePathComponent(component: string, name: string): void {
  if (UNSAFE_PATH_PATTERN.test(component)) {
    throw new Error(`Security: path traversal detected in ${name}`);
  }
}

/**
 * Get the default state directory based on platform.
 * - macOS: ~/Library/Application Support
 * - Windows: %LOCALAPPDATA%
 * - Linux/other: ~/.local/state
 */
function getDefaultStateHome(): string {
  const home = os.homedir();
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Application Support");
    case "win32":
      return process.env["LOCALAPPDATA"] ?? path.join(home, "AppData", "Local");
    default:
      return path.join(home, ".local", "state");
  }
}

/**
 * Resolve the XDG state path for a cursor file.
 *
 * @param options - Cursor options specifying command, context, and tool name
 * @returns Absolute path to the cursor.json file
 * @throws Error if path components contain traversal attempts
 */
function getStatePath(options: CursorOptions): string {
  // Validate all path components for security
  validatePathComponent(options.command, "command");
  validatePathComponent(options.toolName, "toolName");
  if (options.context) {
    validatePathComponent(options.context, "context");
  }

  const xdgState = process.env["XDG_STATE_HOME"] ?? getDefaultStateHome();
  const parts = [xdgState, options.toolName, "cursors", options.command];
  if (options.context) {
    parts.push(options.context);
  }
  return path.join(...parts, "cursor.json");
}

/**
 * Load persisted pagination state for a command.
 *
 * @param options - Cursor options specifying command and context
 * @returns The pagination state if it exists, undefined otherwise
 *
 * @example
 * ```typescript
 * const state = loadCursor({
 *   command: "list",
 *   toolName: "waymark",
 * });
 *
 * if (state) {
 *   // Continue from last position
 *   const results = await listNotes({ cursor: state.cursor });
 * }
 * ```
 */
export function loadCursor(
  options: CursorOptions
): PaginationState | undefined {
  const statePath = getStatePath(options);

  if (!fs.existsSync(statePath)) {
    return undefined;
  }

  try {
    const content = fs.readFileSync(statePath, "utf-8");
    const parsed = JSON.parse(content) as unknown;

    // Validate required structure - cursor must be a string
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof (parsed as Record<string, unknown>)["cursor"] !== "string"
    ) {
      return undefined;
    }

    const state = parsed as PaginationState;

    if (options.maxAgeMs !== undefined) {
      if (typeof state.timestamp !== "number") {
        return undefined;
      }

      const ageMs = Date.now() - state.timestamp;
      if (ageMs > options.maxAgeMs) {
        return undefined;
      }
    }

    return state;
  } catch {
    // Return undefined for corrupted/invalid JSON
    return undefined;
  }
}

/**
 * Save pagination state for a command.
 *
 * The cursor is persisted to XDG state directory, scoped by
 * tool name, command, and optional context.
 *
 * @param cursor - The cursor string to persist
 * @param options - Cursor options specifying command and context
 *
 * @example
 * ```typescript
 * const results = await listNotes({ limit: 20 });
 *
 * if (results.hasMore) {
 *   saveCursor(results.cursor, {
 *     command: "list",
 *     toolName: "waymark",
 *   });
 * }
 * ```
 */
export function saveCursor(cursor: string, options: CursorOptions): void {
  const statePath = getStatePath(options);
  const stateDir = path.dirname(statePath);

  // Create parent directories if needed
  fs.mkdirSync(stateDir, { recursive: true });

  // Build the pagination state
  const state: PaginationState = {
    cursor,
    command: options.command,
    timestamp: Date.now(),
    hasMore: options.hasMore ?? true,
    ...(options.context && { context: options.context }),
    ...(options.total !== undefined && { total: options.total }),
  };

  // Write state to file
  fs.writeFileSync(statePath, JSON.stringify(state), "utf-8");
}

/**
 * Clear persisted pagination state for a command.
 *
 * Called when --reset flag is passed or when pagination completes.
 *
 * @param options - Cursor options specifying command and context
 *
 * @example
 * ```typescript
 * // User passed --reset flag
 * if (flags.reset) {
 *   clearCursor({
 *     command: "list",
 *     toolName: "waymark",
 *   });
 * }
 * ```
 */
export function clearCursor(options: CursorOptions): void {
  const statePath = getStatePath(options);

  try {
    if (fs.existsSync(statePath)) {
      fs.unlinkSync(statePath);
    }
  } catch {
    // Don't throw for missing files or directories
  }
}
