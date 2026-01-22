/**
 * Pagination state persistence utilities.
 *
 * Handles cursor-based pagination state that persists per-command
 * for --next and --reset functionality.
 *
 * @packageDocumentation
 */

import type { CursorOptions, PaginationState } from "./types.js";

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
export function loadCursor(_options: CursorOptions): PaginationState | undefined {
	throw new Error("loadCursor not implemented");
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
export function saveCursor(_cursor: string, _options: CursorOptions): void {
	throw new Error("saveCursor not implemented");
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
export function clearCursor(_options: CursorOptions): void {
	throw new Error("clearCursor not implemented");
}
