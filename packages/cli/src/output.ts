/**
 * Output utilities for CLI commands.
 *
 * @packageDocumentation
 */

import type { OutputOptions } from "./types.js";

/**
 * Output data to the console with automatic mode selection.
 *
 * Respects --json, --jsonl, --tree, --table flags automatically.
 * Defaults to human-friendly output when no flags are present.
 *
 * @param data - The data to output
 * @param options - Output configuration options
 *
 * @example
 * ```typescript
 * import { output } from "@outfitter/cli";
 *
 * // Basic usage - mode auto-detected from flags
 * output(results);
 *
 * // Force JSON mode
 * output(results, { mode: "json" });
 *
 * // Pretty-print JSON
 * output(results, { mode: "json", pretty: true });
 *
 * // Output to stderr
 * output(errors, { stream: process.stderr });
 * ```
 */
export function output(_data: unknown, _options?: OutputOptions): void {
	throw new Error("output not implemented");
}

/**
 * Exit the process with an error message.
 *
 * Formats the error according to the current output mode (human or JSON)
 * and exits with an appropriate exit code.
 *
 * @param error - The error to display
 * @returns Never returns (exits the process)
 *
 * @example
 * ```typescript
 * import { exitWithError } from "@outfitter/cli";
 *
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   exitWithError(error instanceof Error ? error : new Error(String(error)));
 * }
 * ```
 */
export function exitWithError(_error: Error): never {
	throw new Error("exitWithError not implemented");
}
