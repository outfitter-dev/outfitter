/**
 * Output utilities for CLI commands.
 *
 * @packageDocumentation
 */

import { exitCodeMap, safeStringify as contractsSafeStringify } from "@outfitter/contracts";
import type { ErrorCategory } from "@outfitter/contracts";
import type { OutputMode, OutputOptions } from "./types.js";

// =============================================================================
// Exit Code Handling
// =============================================================================

/**
 * Default exit code for unknown error categories.
 */
const DEFAULT_EXIT_CODE = 1;

/**
 * Writes to a stream with proper backpressure handling.
 * Returns a promise that resolves when the write is complete.
 */
async function writeWithBackpressure(stream: NodeJS.WritableStream, data: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const canContinue = stream.write(data, (error) => {
			if (error) reject(error);
		});

		if (canContinue) {
			resolve();
		} else {
			// Backpressure: wait for drain before resolving
			stream.once("drain", () => resolve());
			stream.once("error", reject);
		}
	});
}

// =============================================================================
// Internal Utilities
// =============================================================================

/**
 * Detects output mode based on environment and options.
 *
 * Priority: explicit option > env var > TTY detection
 */
function detectMode(options?: OutputOptions): OutputMode {
	// Explicit mode takes highest priority
	if (options?.mode) {
		return options.mode;
	}

	// Check environment variables (JSONL takes priority over JSON)
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const envJsonl = process.env["OUTFITTER_JSONL"];
	// biome-ignore lint/complexity/useLiteralKeys: noPropertyAccessFromIndexSignature requires bracket notation
	const envJson = process.env["OUTFITTER_JSON"];
	if (envJsonl === "1") return "jsonl";
	if (envJson === "1") return "json";
	if (envJsonl === "0" || envJson === "0") return "human";

	// Default: JSON for non-TTY, human for TTY
	return process.stdout.isTTY ? "human" : "json";
}

/**
 * Type guard for valid error categories.
 */
function isValidCategory(category: string): category is ErrorCategory {
	return category in exitCodeMap;
}

/**
 * Safe JSON stringify that handles circular references and undefined values.
 * Wraps contracts' safeStringify with undefined → null conversion for CLI JSON output.
 */
function safeStringify(value: unknown, pretty?: boolean): string {
	// Use contracts' safeStringify which handles BigInt and circular references
	// We wrap the value to convert undefined to null for CLI JSON compatibility
	const wrappedValue = value === undefined ? null : value;
	return contractsSafeStringify(wrappedValue, pretty ? 2 : undefined);
}

/**
 * Formats data for human-readable output.
 */
function formatHuman(data: unknown): string {
	if (data === null || data === undefined) {
		return "";
	}

	if (typeof data === "string") {
		return data;
	}

	if (typeof data === "number" || typeof data === "boolean") {
		return String(data);
	}

	if (Array.isArray(data)) {
		return data.map((item) => formatHuman(item)).join("\n");
	}

	if (typeof data === "object") {
		// Simple key: value formatting for objects
		const lines: string[] = [];
		for (const [key, value] of Object.entries(data)) {
			lines.push(`${key}: ${formatHuman(value)}`);
		}
		return lines.join("\n");
	}

	return String(data);
}

/**
 * Extracts KitError-compatible properties from an error.
 * Works with both actual KitError instances and duck-typed errors.
 */
interface KitErrorLike {
	_tag: string | undefined;
	category: string | undefined;
	context: Record<string, unknown> | undefined;
}

function getErrorProperties(error: Error): KitErrorLike {
	const errorObj = error as Error & {
		_tag?: string;
		category?: string;
		context?: Record<string, unknown>;
	};
	return {
		_tag: errorObj._tag,
		category: errorObj.category,
		context: errorObj.context,
	};
}

/**
 * Gets the exit code for an error based on its category.
 * Uses exitCodeMap from @outfitter/contracts for known categories.
 */
function getExitCode(error: Error): number {
	const { category } = getErrorProperties(error);

	if (category !== undefined && isValidCategory(category)) {
		return exitCodeMap[category];
	}

	return DEFAULT_EXIT_CODE;
}

/**
 * Serializable error structure for JSON output.
 */
interface SerializedCliError {
	message: string;
	_tag?: string;
	category?: string;
	context?: Record<string, unknown>;
}

/**
 * Serializes an error to JSON format for CLI output.
 * Handles both KitError instances and plain Error objects.
 */
function serializeErrorToJson(error: Error): string {
	const { _tag, category, context } = getErrorProperties(error);

	const result: SerializedCliError = {
		message: error.message,
	};

	if (_tag !== undefined) {
		result._tag = _tag;
	}

	if (category !== undefined) {
		result.category = category;
	}

	if (context !== undefined) {
		result.context = context;
	}

	return JSON.stringify(result);
}

/**
 * Formats an error for human-readable output.
 */
function formatErrorHuman(error: Error): string {
	const { _tag } = getErrorProperties(error);

	if (_tag) {
		return `${_tag}: ${error.message}`;
	}

	return error.message;
}

// =============================================================================
// Public API
// =============================================================================

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
 *
 * // Await for large outputs (recommended)
 * await output(largeDataset, { mode: "jsonl" });
 * ```
 */
export async function output(data: unknown, options?: OutputOptions): Promise<void> {
	const mode = detectMode(options);
	const stream = options?.stream ?? process.stdout;

	let outputText: string;

	switch (mode) {
		case "json": {
			// Handle undefined/null explicitly
			const jsonData = data === undefined ? null : data;
			outputText = safeStringify(jsonData, options?.pretty);
			break;
		}

		case "jsonl": {
			// Arrays get one JSON object per line
			if (Array.isArray(data)) {
				if (data.length === 0) {
					outputText = "";
				} else {
					outputText = data.map((item) => safeStringify(item)).join("\n");
				}
			} else {
				// Single objects get single JSON line
				outputText = safeStringify(data);
			}
			break;
		}

		default: {
			outputText = formatHuman(data);
			break;
		}
	}

	// Only write if there's content (with backpressure handling)
	if (outputText) {
		await writeWithBackpressure(stream, `${outputText}\n`);
	}
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
export function exitWithError(error: Error, options?: OutputOptions): never {
	const exitCode = getExitCode(error);
	const mode = detectMode(options);
	const isJsonMode = mode === "json" || mode === "jsonl";

	if (isJsonMode) {
		// JSON mode: serialize to stderr
		process.stderr.write(`${serializeErrorToJson(error)}\n`);
	} else {
		// Human mode: formatted output to stderr
		process.stderr.write(`${formatErrorHuman(error)}\n`);
	}

	process.exit(exitCode);
}
