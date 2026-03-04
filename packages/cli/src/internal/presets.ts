/**
 * Built-in flag presets for common CLI patterns.
 *
 * @internal
 */

import type {
  ColorFlags,
  ColorMode,
  ExecutionFlags,
  ExecutionPresetConfig,
  FlagPreset,
  InteractionFlags,
  PaginationFlags,
  PaginationPresetConfig,
  ProjectionFlags,
  StrictFlags,
  TimeWindowFlags,
  TimeWindowPresetConfig,
} from "../types.js";
import { createPreset } from "./flag-types.js";

// =============================================================================
// Shared Helpers
// =============================================================================

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

function sanitizePositiveInteger(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
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

// =============================================================================
// Duration Parsing (used by timeWindowPreset)
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
