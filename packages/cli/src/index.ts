/**
 * @outfitter/cli - Typed CLI runtime with output contracts, input parsing, and pagination
 *
 * @packageDocumentation
 */

// Re-export types
export type {
	// Core types
	CLI,
	CLIConfig,
	CommandBuilder,
	CommandConfig,
	CommandAction,
	CommandFlags,
	// Output types
	OutputMode,
	OutputOptions,
	// Input types
	CollectIdsOptions,
	ExpandFileOptions,
	ParseGlobOptions,
	NormalizeIdOptions,
	ConfirmDestructiveOptions,
	// Result types
	Range,
	NumericRange,
	DateRange,
	FilterExpression,
	SortCriteria,
	KeyValuePair,
	// Error types
	ValidationError,
	CancelledError,
	// Pagination types
	PaginationState,
	CursorOptions,
} from "./types.js";

// Core CLI factory
export { createCLI } from "./cli.js";

// Command builder
export { command } from "./command.js";

// Output utilities
export { output, exitWithError } from "./output.js";

// Input utilities
export {
	collectIds,
	expandFileArg,
	parseGlob,
	parseKeyValue,
	parseRange,
	parseFilter,
	parseSortSpec,
	normalizeId,
	confirmDestructive,
} from "./input.js";

// Pagination utilities
export { loadCursor, saveCursor, clearCursor } from "./pagination.js";
