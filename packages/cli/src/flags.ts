/**
 * Composable flag presets for CLI commands.
 *
 * @packageDocumentation
 */

import type { ActionCliOption } from "@outfitter/contracts";
import type {
  ComposedPreset,
  FlagPreset,
  FlagPresetConfig,
  PaginationFlags,
  PaginationPresetConfig,
} from "./types.js";

/**
 * Create a typed flag preset.
 *
 * @param config - Preset configuration with id, options, and resolver
 * @returns A flag preset that can be applied to commands or composed
 *
 * @example
 * ```typescript
 * const myPreset = createPreset({
 *   id: "output-format",
 *   options: [{ flags: "--format <type>", description: "Output format" }],
 *   resolve: (flags) => ({
 *     format: String(flags["format"] ?? "text"),
 *   }),
 * });
 * ```
 */
export function createPreset<TResolved extends Record<string, unknown>>(
  config: FlagPresetConfig<TResolved>
): FlagPreset<TResolved> {
  const preset: FlagPreset<TResolved> = {
    id: config.id,
    options: config.options,
    resolve: config.resolve,
  };
  (preset as InternalPreset)[PRESET_IDS] = [config.id];
  return preset;
}

// Utility types for composing preset resolved types
type ResolvedType<T> = T extends FlagPreset<infer R> ? R : never;
type UnionToIntersection<U> = (
  U extends unknown
    ? (k: U) => void
    : never
) extends (k: infer I) => void
  ? I
  : never;

/**
 * Resolves the merged type from a tuple of presets.
 * Falls back to Record<string, unknown> when the tuple is empty
 * (since UnionToIntersection<never> produces unknown).
 */
type MergedPresetResult<
  TPresets extends readonly FlagPreset<Record<string, unknown>>[],
> =
  UnionToIntersection<ResolvedType<TPresets[number]>> extends Record<
    string,
    unknown
  >
    ? UnionToIntersection<ResolvedType<TPresets[number]>>
    : Record<string, unknown>;

const PRESET_IDS = Symbol("presetIds");

type InternalPreset = FlagPreset<Record<string, unknown>> & {
  [PRESET_IDS]?: readonly string[];
};

function getPresetIds(
  preset: FlagPreset<Record<string, unknown>>
): readonly string[] {
  const ids = (preset as InternalPreset)[PRESET_IDS];
  return ids && ids.length > 0 ? ids : [preset.id];
}

/**
 * Compose multiple presets into one, deduplicating by id (first wins).
 *
 * @param presets - Presets to compose together
 * @returns A single preset merging all options and resolvers
 *
 * @example
 * ```typescript
 * const composed = composePresets(
 *   verbosePreset(),
 *   cwdPreset(),
 *   forcePreset(),
 * );
 * // composed.resolve({ verbose: true, cwd: "/tmp", force: false })
 * // => { verbose: true, cwd: "/tmp", force: false }
 * ```
 */
export function composePresets<
  TPresets extends readonly FlagPreset<Record<string, unknown>>[],
>(...presets: TPresets): ComposedPreset<MergedPresetResult<TPresets>> {
  const seen = new Set<string>();
  const mergedIds: string[] = [];
  const mergedOptions: ActionCliOption[] = [];
  const resolvers: Array<
    (flags: Record<string, unknown>) => Record<string, unknown>
  > = [];

  for (const preset of presets) {
    const presetIds = getPresetIds(preset);
    if (presetIds.every((id) => seen.has(id))) continue;

    for (const id of presetIds) {
      if (seen.has(id)) continue;
      seen.add(id);
      mergedIds.push(id);
    }

    mergedOptions.push(...preset.options);
    resolvers.push(preset.resolve);
  }

  type Merged = MergedPresetResult<TPresets>;
  const composed: ComposedPreset<Merged> = {
    id: mergedIds.join("+"),
    options: mergedOptions,
    resolve: (flags: Record<string, unknown>): Merged => {
      let result = {} as Record<string, unknown>;
      for (const resolver of resolvers) {
        result = { ...result, ...resolver(flags) };
      }
      return result as Merged;
    },
  };
  (composed as InternalPreset)[PRESET_IDS] = mergedIds;
  return composed;
}

// =============================================================================
// Built-in Presets
// =============================================================================

/**
 * Verbose output flag preset.
 *
 * Adds: `-v, --verbose`
 * Resolves: `{ verbose: boolean }`
 */
export function verbosePreset(): FlagPreset<{ verbose: boolean }> {
  return createPreset({
    id: "verbose",
    options: [
      {
        flags: "-v, --verbose",
        description: "Verbose output",
        defaultValue: false,
      },
    ],
    resolve: (flags) => ({
      verbose: Boolean(flags["verbose"]),
    }),
  });
}

/**
 * Working directory flag preset.
 *
 * Adds: `--cwd <path>`
 * Resolves: `{ cwd: string }` (defaults to `process.cwd()`)
 */
export function cwdPreset(): FlagPreset<{ cwd: string }> {
  return createPreset({
    id: "cwd",
    options: [
      {
        flags: "--cwd <path>",
        description: "Working directory",
      },
    ],
    resolve: (flags) => ({
      cwd: typeof flags["cwd"] === "string" ? flags["cwd"] : process.cwd(),
    }),
  });
}

/**
 * Dry-run flag preset.
 *
 * Adds: `--dry-run`
 * Resolves: `{ dryRun: boolean }`
 */
export function dryRunPreset(): FlagPreset<{ dryRun: boolean }> {
  return createPreset({
    id: "dryRun",
    options: [
      {
        flags: "--dry-run",
        description: "Preview changes without applying",
        defaultValue: false,
      },
    ],
    resolve: (flags) => ({
      // Commander camelCases --dry-run to dryRun, but check both for safety
      dryRun: Boolean(flags["dryRun"] ?? flags["dry-run"]),
    }),
  });
}

/**
 * Force flag preset.
 *
 * Adds: `-f, --force`
 * Resolves: `{ force: boolean }`
 */
export function forcePreset(): FlagPreset<{ force: boolean }> {
  return createPreset({
    id: "force",
    options: [
      {
        flags: "-f, --force",
        description: "Force operation (skip confirmations)",
        defaultValue: false,
      },
    ],
    resolve: (flags) => ({
      force: Boolean(flags["force"]),
    }),
  });
}

/**
 * Pagination flag preset.
 *
 * Adds: `-l, --limit <n>`, `--next`, `--reset`
 * Resolves: `{ limit: number, next: boolean, reset: boolean }`
 *
 * Limit is parsed as an integer, clamped to maxLimit, and defaults
 * to defaultLimit on invalid input. Mutual exclusivity of --next
 * and --reset is a handler concern (not enforced here).
 *
 * Integrates with loadCursor/saveCursor/clearCursor from
 * `@outfitter/cli/pagination`.
 */
export function paginationPreset(
  config?: PaginationPresetConfig
): FlagPreset<PaginationFlags> {
  const maxLimit = sanitizePositiveInteger(config?.maxLimit, 100);
  const defaultLimit = Math.min(
    sanitizePositiveInteger(config?.defaultLimit, 20),
    maxLimit
  );

  return createPreset({
    id: "pagination",
    options: [
      {
        flags: "-l, --limit <n>",
        description: `Maximum number of results (default: ${defaultLimit}, max: ${maxLimit})`,
      },
      {
        flags: "--next",
        description: "Continue from last position",
        defaultValue: false,
      },
      {
        flags: "--reset",
        description: "Clear saved cursor and start fresh",
        defaultValue: false,
      },
    ],
    resolve: (flags) => {
      let limit = defaultLimit;
      const rawLimit = flags["limit"];
      if (rawLimit !== undefined) {
        const parsed = Number(rawLimit);
        if (Number.isFinite(parsed) && parsed > 0) {
          limit = Math.min(Math.floor(parsed), maxLimit);
        }
      }

      return {
        limit,
        next: Boolean(flags["next"]),
        reset: Boolean(flags["reset"]),
      };
    },
  });
}

export type {
  ComposedPreset,
  FlagPreset,
  FlagPresetConfig,
  PaginationFlags,
  PaginationPresetConfig,
} from "./types.js";
