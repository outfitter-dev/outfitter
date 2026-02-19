/**
 * Composable flag presets for CLI commands.
 *
 * @packageDocumentation
 */

import type { ActionCliOption } from "@outfitter/contracts";
import type {
  BooleanFlagPresetConfig,
  ColorFlags,
  ColorMode,
  ComposedPreset,
  EnumFlagPresetConfig,
  ExecutionFlags,
  ExecutionPresetConfig,
  FlagPreset,
  FlagPresetConfig,
  InteractionFlags,
  NumberFlagPresetConfig,
  PaginationFlags,
  PaginationPresetConfig,
  ProjectionFlags,
  StrictFlags,
  StringListFlagPresetConfig,
  TimeWindowFlags,
  TimeWindowPresetConfig,
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

function resolveSourceKeys(
  key: string,
  sources?: readonly string[]
): readonly string[] {
  return sources && sources.length > 0 ? sources : [key];
}

/**
 * Generic boolean custom-flag builder.
 *
 * Supports normal sources and negated sources so `--no-foo` patterns can
 * resolve consistently across Commander flag-shape differences.
 */
export function booleanFlagPreset<TKey extends string>(
  config: BooleanFlagPresetConfig<TKey>
): FlagPreset<{ [K in TKey]: boolean }> {
  const sources = resolveSourceKeys(config.key, config.sources);
  const defaultValue = config.defaultValue ?? false;

  return createPreset({
    id: config.id,
    options: [
      {
        flags: config.flags,
        description: config.description,
        defaultValue,
        ...(config.required === true ? { required: true } : {}),
      },
    ],
    resolve: (flags) => {
      for (const source of sources) {
        const value = flags[source];
        if (typeof value === "boolean") {
          return { [config.key]: value } as { [K in TKey]: boolean };
        }
      }

      if (config.negatedSources) {
        for (const source of config.negatedSources) {
          const value = flags[source];
          if (typeof value === "boolean") {
            return { [config.key]: !value } as { [K in TKey]: boolean };
          }
        }
      }

      return { [config.key]: defaultValue } as { [K in TKey]: boolean };
    },
  });
}

/**
 * Generic enum custom-flag builder.
 */
export function enumFlagPreset<TKey extends string, TValue extends string>(
  config: EnumFlagPresetConfig<TKey, TValue>
): FlagPreset<{ [K in TKey]: TValue }> {
  const sources = resolveSourceKeys(config.key, config.sources);
  const allowed = new Set(config.values);

  return createPreset({
    id: config.id,
    options: [
      {
        flags: config.flags,
        description: config.description,
        ...(config.required === true ? { required: true } : {}),
      },
    ],
    resolve: (flags) => {
      for (const source of sources) {
        const value = flags[source];
        if (typeof value === "string" && allowed.has(value as TValue)) {
          return { [config.key]: value as TValue } as { [K in TKey]: TValue };
        }
      }

      return {
        [config.key]: config.defaultValue,
      } as { [K in TKey]: TValue };
    },
  });
}

/**
 * Generic number custom-flag builder.
 */
export function numberFlagPreset<TKey extends string>(
  config: NumberFlagPresetConfig<TKey>
): FlagPreset<{ [K in TKey]: number }> {
  const sources = resolveSourceKeys(config.key, config.sources);

  return createPreset({
    id: config.id,
    options: [
      {
        flags: config.flags,
        description: config.description,
        ...(config.required === true ? { required: true } : {}),
      },
    ],
    resolve: (flags) => {
      let parsed: number | undefined;
      for (const source of sources) {
        const value = flags[source];
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
          parsed = config.integer === false ? numeric : Math.floor(numeric);
          break;
        }
      }

      if (parsed === undefined) {
        parsed = config.defaultValue;
      }

      if (typeof config.min === "number" && Number.isFinite(config.min)) {
        parsed = Math.max(parsed, config.min);
      }
      if (typeof config.max === "number" && Number.isFinite(config.max)) {
        parsed = Math.min(parsed, config.max);
      }

      return { [config.key]: parsed } as { [K in TKey]: number };
    },
  });
}

function normalizeStringListInput(
  value: unknown,
  separator: string
): string[] | undefined {
  if (Array.isArray(value)) {
    const items = value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  if (typeof value !== "string") return undefined;
  const items = value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/**
 * Generic string-list custom-flag builder.
 */
export function stringListFlagPreset<TKey extends string>(
  config: StringListFlagPresetConfig<TKey>
): FlagPreset<{ [K in TKey]: string[] | undefined }> {
  const sources = resolveSourceKeys(config.key, config.sources);
  const separator = config.separator ?? ",";
  const fallback =
    config.defaultValue === undefined ? undefined : [...config.defaultValue];

  return createPreset({
    id: config.id,
    options: [
      {
        flags: config.flags,
        description: config.description,
        ...(config.required === true ? { required: true } : {}),
      },
    ],
    resolve: (flags) => {
      let resolved: string[] | undefined;
      for (const source of sources) {
        const parsed = normalizeStringListInput(flags[source], separator);
        if (parsed !== undefined) {
          resolved = parsed;
          break;
        }
      }

      if (resolved === undefined) {
        resolved = fallback === undefined ? undefined : [...fallback];
      }

      if (resolved && config.dedupe) {
        resolved = [...new Set(resolved)];
      }

      return {
        [config.key]: resolved,
      } as { [K in TKey]: string[] | undefined };
    },
  });
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
 * Interaction mode flag preset.
 *
 * Adds: `--non-interactive`, `--no-input`, `-y, --yes`
 * Resolves: `{ interactive: boolean, yes: boolean }`
 *
 * `interactive` defaults to `true` and is set to `false` when
 * `--non-interactive` or `--no-input` is passed. The two flags
 * are synonyms for user convenience.
 */
export function interactionPreset(): FlagPreset<InteractionFlags> {
  return createPreset({
    id: "interaction",
    options: [
      {
        flags: "--non-interactive",
        description: "Disable interactive prompts",
        defaultValue: false,
      },
      {
        flags: "--no-input",
        description: "Disable interactive prompts (alias)",
      },
      {
        flags: "-y, --yes",
        description: "Auto-confirm prompts",
        defaultValue: false,
      },
    ],
    resolve: (flags) => {
      const nonInteractive =
        flags["input"] === false ||
        Boolean(flags["nonInteractive"]) ||
        Boolean(flags["non-interactive"]) ||
        Boolean(flags["noInput"]) ||
        Boolean(flags["no-input"]);
      return {
        interactive: !nonInteractive,
        yes: Boolean(flags["yes"]),
      };
    },
  });
}

/**
 * Strict mode flag preset.
 *
 * Adds: `--strict`
 * Resolves: `{ strict: boolean }`
 */
export function strictPreset(): FlagPreset<StrictFlags> {
  return createPreset({
    id: "strict",
    options: [
      {
        flags: "--strict",
        description: "Enable strict mode (treat warnings as errors)",
        defaultValue: false,
      },
    ],
    resolve: (flags) => ({
      strict: Boolean(flags["strict"]),
    }),
  });
}

const COLOR_MODES = new Set<ColorMode>(["auto", "always", "never"]);

/**
 * Color mode flag preset.
 *
 * Adds: `--color [mode]`, `--no-color`
 * Resolves: `{ color: "auto" | "always" | "never" }`
 *
 * Commander's `--no-color` negation sets `flags["color"]` to `false`,
 * which resolves to `"never"`. Invalid values default to `"auto"`.
 *
 * This preset resolves the user's *intent*. Consumers should compose
 * with terminal detection (`supportsColor()`, `resolveColorEnv()`)
 * to determine actual color output behavior.
 */
export function colorPreset(): FlagPreset<ColorFlags> {
  return createPreset({
    id: "color",
    options: [
      {
        flags: "--color [mode]",
        description: "Color output mode (auto, always, never)",
        defaultValue: "auto",
      },
      {
        flags: "--no-color",
        description: "Disable color output",
      },
    ],
    resolve: (flags) => {
      const raw = flags["color"];

      // Commander sets false for --no-color
      if (raw === false) return { color: "never" };
      // Commander sets true for bare --color when mode is optional.
      if (raw === true) return { color: "always" };

      if (typeof raw === "string" && COLOR_MODES.has(raw as ColorMode)) {
        return { color: raw as ColorMode };
      }

      return { color: "auto" };
    },
  });
}

/**
 * Parse a comma-separated string into a trimmed, non-empty string array.
 * Returns `undefined` if the input is not a string or produces no entries.
 */
function parseCommaSeparated(value: unknown): string[] | undefined {
  if (typeof value !== "string") return undefined;
  const items = value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return items.length > 0 ? items : undefined;
}

/**
 * Projection flag preset.
 *
 * Adds: `--fields <fields>`, `--exclude-fields <fields>`, `--count`
 * Resolves: `{ fields: string[] | undefined, excludeFields: string[] | undefined, count: boolean }`
 *
 * Fields are parsed as comma-separated strings with whitespace trimming.
 * `undefined` when not provided (not empty array) to distinguish
 * "not specified" from "empty".
 *
 * Conflict between `--fields` and `--exclude-fields` is a handler
 * concern (documented, not enforced).
 */
export function projectionPreset(): FlagPreset<ProjectionFlags> {
  return createPreset({
    id: "projection",
    options: [
      {
        flags: "--fields <fields>",
        description: "Comma-separated list of fields to include",
      },
      {
        flags: "--exclude-fields <fields>",
        description: "Comma-separated list of fields to exclude",
      },
      {
        flags: "--count",
        description: "Output only the count of results",
        defaultValue: false,
      },
    ],
    resolve: (flags) => ({
      fields: parseCommaSeparated(flags["fields"]),
      excludeFields: parseCommaSeparated(
        flags["excludeFields"] ?? flags["exclude-fields"]
      ),
      count: Boolean(flags["count"]),
    }),
  });
}

// =============================================================================
// Duration Parsing
// =============================================================================

const DURATION_SUFFIXES: Record<string, number> = {
  w: 7 * 24 * 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  h: 60 * 60 * 1000,
  m: 60 * 1000,
};

/**
 * Parse a date string or relative duration into a Date.
 * Supports ISO 8601 dates and relative durations (7d, 24h, 30m, 2w).
 * Returns `undefined` for invalid or unparseable input.
 */
function parseDate(
  value: unknown,
  nowMs: number = Date.now()
): Date | undefined {
  if (typeof value !== "string" || value === "") return undefined;

  // Try relative duration first (e.g., "7d", "24h", "30m", "2w")
  const durationMatch = value.match(/^(\d+(?:\.\d+)?)(w|d|h|m)$/);
  if (durationMatch) {
    const amount = Number(durationMatch[1]);
    const suffix = durationMatch[2];
    const multiplier = suffix ? DURATION_SUFFIXES[suffix] : undefined;
    if (amount > 0 && multiplier !== undefined) {
      return new Date(nowMs - amount * multiplier);
    }
    return undefined;
  }

  // Try ISO 8601 date
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

function sanitizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

/**
 * Time-window flag preset.
 *
 * Adds: `--since <date>`, `--until <date>`
 * Resolves: `{ since: Date | undefined, until: Date | undefined }`
 *
 * Accepts ISO 8601 dates (`2024-01-15`) or relative durations
 * (`7d`, `24h`, `30m`, `2w`). Durations are past-relative
 * (subtracted from now).
 *
 * Returns `undefined` for unparseable values (does not throw).
 * When `config.maxRange` is set and both bounds are provided,
 * ranges above the limit are treated as invalid.
 */
export function timeWindowPreset(
  config?: TimeWindowPresetConfig
): FlagPreset<TimeWindowFlags> {
  return createPreset({
    id: "timeWindow",
    options: [
      {
        flags: "--since <date>",
        description: "Start of time window (ISO date or duration: 7d, 24h, 2w)",
      },
      {
        flags: "--until <date>",
        description: "End of time window (ISO date or duration: 7d, 24h, 2w)",
      },
    ],
    resolve: (flags) => {
      const now = Date.now();
      const since = parseDate(flags["since"], now);
      const until = parseDate(flags["until"], now);

      if (
        since &&
        until &&
        typeof config?.maxRange === "number" &&
        Number.isFinite(config.maxRange) &&
        config.maxRange > 0
      ) {
        const range = Math.abs(until.getTime() - since.getTime());
        if (range > config.maxRange) {
          return {
            since: undefined,
            until: undefined,
          };
        }
      }

      return { since, until };
    },
  });
}

/**
 * Execution flag preset.
 *
 * Adds: `--timeout <ms>`, `--retries <n>`, `--offline`
 * Resolves: `{ timeout: number | undefined, retries: number, offline: boolean }`
 *
 * Timeout is parsed as a positive integer in milliseconds.
 * Retries are parsed as a non-negative integer, clamped to maxRetries.
 */
export function executionPreset(
  config?: ExecutionPresetConfig
): FlagPreset<ExecutionFlags> {
  const defaultTimeout = config?.defaultTimeout;
  const defaultRetries = config?.defaultRetries ?? 0;
  const maxRetries = config?.maxRetries ?? 10;

  return createPreset({
    id: "execution",
    options: [
      {
        flags: "--timeout <ms>",
        description: "Timeout in milliseconds",
      },
      {
        flags: "--retries <n>",
        description: `Number of retries (default: ${defaultRetries}, max: ${maxRetries})`,
      },
      {
        flags: "--offline",
        description: "Operate in offline mode",
        defaultValue: false,
      },
    ],
    resolve: (flags) => {
      // Timeout: positive integer or undefined
      let timeout = defaultTimeout;
      const rawTimeout = flags["timeout"];
      if (rawTimeout !== undefined) {
        const parsed = Number(rawTimeout);
        if (Number.isFinite(parsed) && parsed > 0) {
          timeout = Math.floor(parsed);
        } else {
          timeout = undefined;
        }
      }

      // Retries: non-negative integer, clamped to maxRetries
      let retries = defaultRetries;
      const rawRetries = flags["retries"];
      if (rawRetries !== undefined) {
        const parsed = Number(rawRetries);
        if (Number.isFinite(parsed) && parsed >= 0) {
          retries = Math.min(Math.floor(parsed), maxRetries);
        }
      }

      return {
        timeout,
        retries,
        offline: Boolean(flags["offline"]),
      };
    },
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
  BooleanFlagPresetConfig,
  ColorFlags,
  ColorMode,
  ComposedPreset,
  EnumFlagPresetConfig,
  ExecutionFlags,
  ExecutionPresetConfig,
  FlagPreset,
  FlagPresetConfig,
  InteractionFlags,
  NumberFlagPresetConfig,
  PaginationFlags,
  PaginationPresetConfig,
  ProjectionFlags,
  StrictFlags,
  StringListFlagPresetConfig,
  TimeWindowFlags,
  TimeWindowPresetConfig,
} from "./types.js";
