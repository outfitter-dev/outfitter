/* eslint-disable outfitter/max-file-lines -- Output helpers stay grouped so format selection and transport behavior remain aligned. */
/**
 * Output utilities for CLI commands.
 *
 * @packageDocumentation
 */

import { getEnvironment, getEnvironmentDefaults } from "@outfitter/config";

import {
  applyOutputTruncation,
  cliStringify as _cliStringify,
  detectMode as _detectMode,
  formatErrorHuman,
  formatHuman as _formatHuman,
  getExitCode,
  serializeErrorToJson,
  writeWithBackpressure,
} from "./internal/output-formatting.js";
import type { OutputMode, OutputOptions } from "./types.js";

// =============================================================================
// Re-exports from internal module
// =============================================================================

export {
  cliStringify,
  detectMode,
  formatHuman,
} from "./internal/output-formatting.js";

// =============================================================================
// Public API — kept inline to avoid pure-re-export barrel (bunup compat)
// =============================================================================

/**
 * Output data to the console with automatic mode selection.
 *
 * Respects --json, --jsonl, --tree, --table flags automatically.
 * Defaults to human-friendly output when no flags are present.
 *
 * Detection hierarchy (highest wins):
 * 1. Explicit `format` parameter
 * 2. Environment variables (`OUTFITTER_JSON`, `OUTFITTER_JSONL`)
 * 3. Default: `"human"`
 *
 * @param data - The data to output
 * @param format - Explicit output format (e.g. from a resolved CLI flag)
 * @param options - Output configuration options
 *
 * @example
 * ```typescript
 * import { output } from "@outfitter/cli";
 *
 * // Basic usage - mode auto-detected from env
 * output(results);
 *
 * // Explicit format from resolved flag
 * output(results, "json");
 *
 * // Pretty-print JSON
 * output(results, "json", { pretty: true });
 *
 * // Output to stderr
 * output(errors, undefined, { stream: process.stderr });
 *
 * // Await for large outputs (recommended)
 * await output(largeDataset, "jsonl");
 * ```
 */
export async function output(
  data: unknown,
  format?: OutputMode,
  options?: OutputOptions
): Promise<void> {
  const mode = _detectMode(format);
  const stream = options?.stream ?? process.stdout;
  const renderedData = applyOutputTruncation(data, options?.truncation);

  let outputText: string;

  switch (mode) {
    case "json": {
      // Handle undefined/null explicitly
      const jsonData = renderedData === undefined ? null : renderedData;
      outputText = _cliStringify(jsonData, options?.pretty);
      break;
    }

    case "jsonl": {
      // Arrays get one JSON object per line
      if (Array.isArray(renderedData)) {
        if (renderedData.length === 0) {
          outputText = "";
        } else {
          outputText = renderedData
            .map((item) => _cliStringify(item))
            .join("\n");
        }
      } else {
        // Single objects get single JSON line
        outputText = _cliStringify(renderedData);
      }
      break;
    }

    default: {
      outputText = _formatHuman(renderedData);
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
 * @param format - Explicit output format (e.g. from a resolved CLI flag)
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
export function exitWithError(error: Error, format?: OutputMode): never {
  const exitCode = getExitCode(error);
  const mode = _detectMode(format);
  const isJsonMode = mode === "json" || mode === "jsonl";

  if (isJsonMode) {
    // JSON mode: serialize to stderr
    process.stderr.write(`${serializeErrorToJson(error)}\n`);
  } else {
    // Human mode: formatted output to stderr
    process.stderr.write(`${formatErrorHuman(error)}\n`);
  }

  // oxlint-disable-next-line outfitter/no-process-exit-in-packages -- terminal adapter intentionally exits after serializing errors
  process.exit(exitCode);
}

// =============================================================================
// Environment-Aware Verbose Resolution
// =============================================================================

/**
 * Resolve verbose mode from environment configuration.
 *
 * Precedence (highest wins):
 * 1. `OUTFITTER_VERBOSE` environment variable (`"1"` or `"0"`)
 * 2. Explicit `verbose` parameter (from CLI flag)
 * 3. `OUTFITTER_ENV` environment profile defaults
 * 4. `false` (default)
 *
 * @param verbose - Optional explicit verbose flag (e.g. from --verbose CLI flag)
 * @returns Whether verbose mode is enabled
 *
 * @example
 * ```typescript
 * import { resolveVerbose } from "@outfitter/cli/output";
 *
 * // Auto-resolve from environment
 * const isVerbose = resolveVerbose();
 *
 * // With OUTFITTER_ENV=development -> true
 * // With OUTFITTER_VERBOSE=0 -> false (overrides everything)
 * // With nothing set -> false
 *
 * // From CLI flag
 * const isVerbose = resolveVerbose(cliFlags.verbose);
 * ```
 */
export function resolveVerbose(verbose?: boolean): boolean {
  // 1. OUTFITTER_VERBOSE env var (highest precedence)
  // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: runtime env read
  const envVerbose = process.env["OUTFITTER_VERBOSE"];
  if (envVerbose === "1") return true;
  if (envVerbose === "0") return false;

  // 2. Explicit parameter
  if (verbose !== undefined) {
    return verbose;
  }

  // 3. Environment profile
  const env = getEnvironment();
  const defaults = getEnvironmentDefaults(env);
  return defaults.verbose;
}
