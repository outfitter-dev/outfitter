/**
 * Queryability conventions for CLI commands.
 *
 * Provides presets for output mode selection and jq expression filtering.
 *
 * @packageDocumentation
 */

import { createPreset } from "./flags.js";
import type { FlagPreset, OutputMode } from "./types.js";

// =============================================================================
// Output Mode Preset
// =============================================================================

/**
 * Configuration for the output mode preset.
 */
export interface OutputModePresetConfig {
  /** Default mode when not specified (default: "human") */
  readonly defaultMode?: OutputMode;

  /** Whether to include "jsonl" in allowed modes (default: false) */
  readonly includeJsonl?: boolean;
  /** Allowed output modes (default: ["human", "json"]) */
  readonly modes?: readonly OutputMode[];
}

/**
 * Resolved output mode from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type OutputModeFlags = {
  /** The resolved output mode */
  readonly outputMode: OutputMode;
};

/**
 * Output mode flag preset.
 *
 * Adds: `-o, --output <mode>`
 * Resolves: `{ outputMode: string }`
 *
 * Replaces ad-hoc `--json`/`--jsonl` handling with a single
 * `--output` flag that accepts a mode name. Invalid modes
 * fall back to the configured default.
 *
 * @param config - Optional configuration for allowed modes and default
 */
export function outputModePreset(
  config?: OutputModePresetConfig
): FlagPreset<OutputModeFlags> {
  const defaultMode = config?.defaultMode ?? "human";
  const baseModes = config?.modes ?? (["human", "json"] as const);
  const modes = new Set<OutputMode>(
    config?.includeJsonl ? [...baseModes, "jsonl"] : baseModes
  );
  modes.add(defaultMode);

  return createPreset({
    id: "outputMode",
    options: [
      {
        flags: "-o, --output <mode>",
        description: `Output mode (${[...modes].join(", ")})`,
        defaultValue: defaultMode,
      },
    ],
    resolve: (flags) => {
      const raw = flags["output"];
      if (typeof raw === "string" && modes.has(raw as OutputMode)) {
        return { outputMode: raw as OutputMode };
      }
      return { outputMode: defaultMode };
    },
  });
}

// =============================================================================
// JQ Preset
// =============================================================================

/**
 * Resolved jq expression from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type JqFlags = {
  /** The jq expression, or undefined if not provided */
  readonly jq: string | undefined;
};

/**
 * JQ expression flag preset.
 *
 * Adds: `--jq <expr>`
 * Resolves: `{ jq: string | undefined }`
 *
 * The resolver returns the expression string or `undefined`.
 * Actual jq execution is a consumer concern.
 */
export function jqPreset(): FlagPreset<JqFlags> {
  return createPreset({
    id: "jq",
    options: [
      {
        flags: "--jq <expr>",
        description: "Filter JSON output with a jq expression",
      },
    ],
    resolve: (flags) => {
      const raw = flags["jq"];
      if (typeof raw === "string" && raw.length > 0) {
        return { jq: raw };
      }
      return { jq: undefined };
    },
  });
}
