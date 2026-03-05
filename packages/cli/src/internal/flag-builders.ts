/**
 * Generic flag builder functions for custom-typed presets.
 *
 * @internal
 */

import type {
  BooleanFlagPresetConfig,
  EnumFlagPresetConfig,
  FlagPreset,
  NumberFlagPresetConfig,
  StringListFlagPresetConfig,
} from "../types.js";
import { createPreset } from "./flag-types.js";

// =============================================================================
// Shared Helpers
// =============================================================================

function resolveSourceKeys(
  key: string,
  sources?: readonly string[]
): readonly string[] {
  return sources && sources.length > 0 ? sources : [key];
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

// =============================================================================
// Flag Builders
// =============================================================================

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

  // For --no-* flags, Commander's natural default for the positive attribute
  // is `true`. Overriding with `defaultValue: false` would make the flag a
  // no-op (default=false, --no-X=false → indistinguishable). Only pass
  // defaultValue to Commander when explicitly provided or for non-negated flags.
  const isNegatedFlag = config.flags.includes("--no-");
  const optionDefault =
    isNegatedFlag && config.defaultValue === undefined ? {} : { defaultValue };

  return createPreset({
    id: config.id,
    options: [
      {
        flags: config.flags,
        description: config.description,
        ...optionDefault,
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
        if (value === "" || value == null || typeof value === "boolean") {
          continue;
        }
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
