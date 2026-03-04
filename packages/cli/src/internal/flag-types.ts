/**
 * Core flag preset types and composition utilities.
 *
 * @internal
 */

import type { ActionCliOption } from "@outfitter/contracts";

import type {
  ComposedPreset,
  FlagPreset,
  FlagPresetConfig,
  SchemaPreset,
  SchemaPresetConfig,
} from "../types.js";

// =============================================================================
// Internal Symbols & Types
// =============================================================================

/** @internal Symbol for tracking composed preset IDs. */
const PRESET_IDS: unique symbol = Symbol("presetIds");

/** @internal Preset with tracked composition IDs. */
type InternalPreset = FlagPreset<Record<string, unknown>> & {
  [PRESET_IDS]?: readonly string[];
};

// =============================================================================
// Utility Types
// =============================================================================

/** Extracts the resolved type from a flag preset. */
type ResolvedType<T> = T extends FlagPreset<infer R> ? R : never;

/** Converts a union type into an intersection type. */
type UnionToIntersection<U> = (
  U extends unknown ? (k: U) => void : never
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

// =============================================================================
// Preset Factories
// =============================================================================

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

/**
 * Create a schema-driven preset using a Zod schema fragment.
 *
 * Instead of declaring Commander options manually, the schema fragment
 * is introspected to auto-derive flags (same as `.input()`). The resolve
 * function maps raw Commander flags into typed values.
 *
 * @param config - Preset configuration with id, schema, and resolver
 * @returns A schema preset that can be applied to commands via `.preset()`
 *
 * @example
 * ```typescript
 * const outputPreset = createSchemaPreset({
 *   id: "output-format",
 *   schema: z.object({
 *     format: z.enum(["json", "text"]).default("text").describe("Output format"),
 *     pretty: z.boolean().default(false).describe("Pretty print"),
 *   }),
 *   resolve: (flags) => ({
 *     format: String(flags["format"] ?? "text"),
 *     pretty: Boolean(flags["pretty"]),
 *   }),
 * });
 * ```
 */
export function createSchemaPreset<TResolved extends Record<string, unknown>>(
  config: SchemaPresetConfig<TResolved>
): SchemaPreset<TResolved> {
  return {
    id: config.id,
    schema: config.schema,
    resolve: config.resolve,
  };
}

/**
 * Type guard to check whether a preset is a schema-driven preset.
 */
export function isSchemaPreset(
  preset:
    | FlagPreset<Record<string, unknown>>
    | SchemaPreset<Record<string, unknown>>
): preset is SchemaPreset<Record<string, unknown>> {
  return "schema" in preset && !("options" in preset);
}

// =============================================================================
// Composition Utilities
// =============================================================================

/** @internal Extract tracked preset IDs from a preset. */
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
