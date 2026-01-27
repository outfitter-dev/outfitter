/**
 * @outfitter/cli - Typed CLI runtime with output contracts, input parsing, and pagination
 *
 * @packageDocumentation
 */

export type { BuildCliCommandsOptions } from "./actions.js";
// Action adapter
export { buildCliCommands } from "./actions.js";
// Core CLI factory
export { createCLI } from "./cli.js";
// Command builder
export { command } from "./command.js";
// Input utilities
export {
  collectIds,
  confirmDestructive,
  expandFileArg,
  normalizeId,
  parseFilter,
  parseGlob,
  parseKeyValue,
  parseRange,
  parseSortSpec,
} from "./input.js";

// Output utilities
export { exitWithError, output } from "./output.js";
// Pagination utilities
export { clearCursor, loadCursor, saveCursor } from "./pagination.js";
// Re-export types
export type {
  CancelledError,
  // Core types
  CLI,
  CLIConfig,
  // Input types
  CollectIdsOptions,
  CommandAction,
  CommandBuilder,
  CommandConfig,
  CommandFlags,
  ConfirmDestructiveOptions,
  CursorOptions,
  DateRange,
  ExpandFileOptions,
  FilterExpression,
  KeyValuePair,
  NormalizeIdOptions,
  NumericRange,
  // Output types
  OutputMode,
  OutputOptions,
  // Pagination types
  PaginationState,
  ParseGlobOptions,
  // Result types
  Range,
  SortCriteria,
  // Error types
  ValidationError,
} from "./types.js";
