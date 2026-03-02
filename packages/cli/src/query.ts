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
// Output Mode Resolution
// =============================================================================

/**
 * Source of the resolved output mode, indicating how the mode was determined.
 *
 * - `"flag"` — User explicitly passed `--output`, `-o`, `--json`, or `--jsonl`
 * - `"env"` — Mode set via `OUTFITTER_JSON=1` or `OUTFITTER_JSONL=1`
 * - `"default"` — No explicit input; using the configured default (typically `"human"`)
 */
export type OutputModeSource = "flag" | "env" | "default";

/**
 * Result of resolving output mode with source/explicitness tracking.
 */
export interface ResolvedOutputMode {
  /** The resolved output mode */
  readonly mode: "human" | "json" | "jsonl";
  /** How the mode was determined */
  readonly source: OutputModeSource;
}

/**
 * Configuration for the centralized output mode resolver.
 */
export interface ResolveOutputModeConfig {
  /** Custom argv for explicit-flag detection (defaults to `process.argv.slice(2)`) */
  readonly argv?: readonly string[];
  /** Default mode when not specified (default: `"human"`) */
  readonly defaultMode?: "human" | "json" | "jsonl";
  /**
   * When `true`, skip env-var fallback and return the default for implicit
   * modes. Useful for orchestrator modes (e.g., `check --pre-commit`) where
   * structured output should require an explicit flag.
   */
  readonly forceHumanWhenImplicit?: boolean;
}

/**
 * Check whether `-o`/`--output` appears explicitly in the given argv.
 */
function argvContainsOutputFlag(argv: readonly string[]): boolean {
  for (const arg of argv) {
    if (!arg) continue;
    if (arg === "-o" || arg === "--output") return true;
    if (arg.startsWith("--output=") || arg.startsWith("-o=")) return true;
  }
  return false;
}

/**
 * Detect whether the user explicitly passed an output mode flag.
 *
 * Returns `true` when the resolved mode differs from the default,
 * or when `-o`/`--output` appears in the raw argv.
 */
function hasExplicitOutputFlag(
  flags: Record<string, unknown>,
  config?: ResolveOutputModeConfig
): boolean {
  const mode = flags["output"];
  if (typeof mode !== "string") return false;

  const defaultMode = config?.defaultMode ?? "human";
  if (mode !== defaultMode) return true;

  return argvContainsOutputFlag(config?.argv ?? process.argv.slice(2));
}

/**
 * Centralized output-mode resolver with source/explicitness tracking.
 *
 * Resolves the output mode from CLI flags, environment variables, or defaults.
 * Returns both the resolved mode and its source so callers can make decisions
 * based on how the mode was determined.
 *
 * **Resolution order (highest wins):**
 * 1. Explicit `--output` / `-o` flag (source: `"flag"`)
 * 2. Legacy `--json` / `--jsonl` boolean flags (source: `"flag"`)
 * 3. `OUTFITTER_JSONL=1` / `OUTFITTER_JSON=1` env vars (source: `"env"`)
 * 4. Configured default — typically `"human"` (source: `"default"`)
 *
 * When `forceHumanWhenImplicit` is set, steps 3–4 collapse to `"human"`.
 *
 * @param flags - Raw Commander flags (from `context.flags`)
 * @param config - Optional configuration
 * @returns The resolved mode and its source
 *
 * @example
 * ```typescript
 * import { resolveOutputMode } from "@outfitter/cli/query";
 *
 * // In a mapInput function:
 * const { mode, source } = resolveOutputMode(context.flags);
 * // mode: "human" | "json" | "jsonl"
 * // source: "flag" | "env" | "default"
 * ```
 */
export function resolveOutputMode(
  flags: Record<string, unknown>,
  config?: ResolveOutputModeConfig
): ResolvedOutputMode {
  const defaultMode = config?.defaultMode ?? "human";

  // 1. Explicit --output / -o flag
  if (hasExplicitOutputFlag(flags, config)) {
    const raw = flags["output"];
    const mode =
      raw === "json" || raw === "jsonl" || raw === "human" ? raw : defaultMode;
    return { mode, source: "flag" };
  }

  // 2. Legacy --json / --jsonl boolean flags
  if (flags["json"] === true) return { mode: "json", source: "flag" };
  if (flags["jsonl"] === true) return { mode: "jsonl", source: "flag" };

  // 3. forceHumanWhenImplicit short-circuit (skip env fallback)
  if (config?.forceHumanWhenImplicit) {
    return { mode: "human", source: "default" };
  }

  // 4. Environment variable fallback (JSONL takes priority)
  if (process.env["OUTFITTER_JSONL"] === "1") {
    return { mode: "jsonl", source: "env" };
  }
  if (process.env["OUTFITTER_JSON"] === "1") {
    return { mode: "json", source: "env" };
  }

  // 5. Default
  return { mode: defaultMode, source: "default" };
}

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
