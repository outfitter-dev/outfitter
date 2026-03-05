/**
 * Composable flag presets for CLI commands.
 *
 * @packageDocumentation
 */

// Re-export core preset types and composition utilities
export {
  composePresets,
  createPreset,
  createSchemaPreset,
  isSchemaPreset,
} from "./internal/flag-types.js";

// Re-export generic flag builders
export {
  booleanFlagPreset,
  enumFlagPreset,
  numberFlagPreset,
  stringListFlagPreset,
} from "./internal/flag-builders.js";

// Re-export built-in presets
export {
  colorPreset,
  cwdPreset,
  dryRunPreset,
  executionPreset,
  forcePreset,
  interactionPreset,
  paginationPreset,
  projectionPreset,
  strictPreset,
  timeWindowPreset,
  verbosePreset,
} from "./internal/presets.js";

// Re-export flag-related types from types.ts
export type {
  AnyPreset,
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
  SchemaPreset,
  SchemaPresetConfig,
  StrictFlags,
  StringListFlagPresetConfig,
  TimeWindowFlags,
  TimeWindowPresetConfig,
} from "./types.js";
