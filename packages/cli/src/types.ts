/**
 * Type definitions for @outfitter/cli
 *
 * @packageDocumentation
 */

import type { Command } from "commander";

// =============================================================================
// Core CLI Types
// =============================================================================

/**
 * Configuration for creating a CLI instance.
 *
 * @example
 * ```typescript
 * const config: CLIConfig = {
 *   name: "waymark",
 *   version: "1.0.0",
 *   description: "A note management CLI",
 * };
 * ```
 */
export interface CLIConfig {
  /** CLI name (used in help output and error messages) */
  readonly name: string;

  /** CLI version (displayed with --version) */
  readonly version: string;

  /** CLI description (displayed in help output) */
  readonly description?: string;

  /** Custom error handler */
  readonly onError?: (error: Error) => void;

  /** Custom exit handler (defaults to process.exit) */
  readonly onExit?: (code: number) => never;
}

/**
 * CLI instance returned by createCLI.
 */
export interface CLI {
  /** Register a command with the CLI */
  register(command: CommandBuilder | Command): this;

  /** Parse arguments and execute the matched command */
  parse(argv?: readonly string[]): Promise<void>;

  /** Get the underlying Commander program */
  readonly program: Command;
}

/**
 * Configuration for a single command.
 */
export interface CommandConfig {
  /** Command name and argument syntax (e.g., "list" or "get <id>") */
  readonly name: string;

  /** Command description */
  readonly description?: string;

  /** Command aliases */
  readonly aliases?: readonly string[];

  /** Whether to hide from help output */
  readonly hidden?: boolean;
}

/**
 * Action function executed when a command is invoked.
 *
 * @typeParam TFlags - Type of parsed command flags
 */
export type CommandAction<TFlags extends CommandFlags = CommandFlags> =
  (context: {
    /** Parsed command-line arguments */
    readonly args: readonly string[];

    /** Parsed command flags */
    readonly flags: TFlags;

    /** Raw Commander command instance */
    readonly command: Command;
  }) => Promise<void> | void;

/**
 * Base type for command flags.
 * All flag types must extend this.
 */
export type CommandFlags = Record<string, unknown>;

/**
 * Builder interface for constructing commands fluently.
 */
export interface CommandBuilder {
  /** Set command description */
  description(text: string): this;

  /** Add a command option/flag */
  option(flags: string, description: string, defaultValue?: unknown): this;

  /** Add a required option */
  requiredOption(
    flags: string,
    description: string,
    defaultValue?: unknown
  ): this;

  /** Add command aliases */
  alias(alias: string): this;

  /** Set the action handler */
  action<TFlags extends CommandFlags = CommandFlags>(
    handler: CommandAction<TFlags>
  ): this;

  /** Build the underlying Commander command */
  build(): Command;
}

// =============================================================================
// Output Types
// =============================================================================

/**
 * Available output modes for CLI commands.
 */
export type OutputMode = "human" | "json" | "jsonl" | "tree" | "table";

/**
 * Options for the output() function.
 */
export interface OutputOptions {
  /** Force a specific output mode (overrides flag detection) */
  readonly mode?: OutputMode;

  /** Stream to write to (defaults to stdout) */
  readonly stream?: NodeJS.WritableStream;

  /** Whether to pretty-print JSON output */
  readonly pretty?: boolean;

  /** Exit code to use after output (undefined = don't exit) */
  readonly exitCode?: number;
}

// =============================================================================
// Input Parsing Types
// =============================================================================

/**
 * Options for collectIds() input utility.
 *
 * @example
 * ```typescript
 * const ids = await collectIds(args, {
 *   allowFile: true,   // @file expansion
 *   allowStdin: true,  // - reads from stdin
 * });
 * ```
 */
export interface CollectIdsOptions {
  /** Allow @file expansion (reads IDs from file) */
  readonly allowFile?: boolean;

  /** Allow glob patterns */
  readonly allowGlob?: boolean;

  /** Allow reading from stdin with "-" */
  readonly allowStdin?: boolean;

  /** Separator for comma-separated values */
  readonly separator?: string;
}

/**
 * Options for expandFileArg() input utility.
 */
export interface ExpandFileOptions {
  /** Encoding for file reads (defaults to utf-8) */
  readonly encoding?: BufferEncoding;

  /** Maximum file size to read (in bytes) */
  readonly maxSize?: number;

  /** Whether to trim the file content */
  readonly trim?: boolean;
}

/**
 * Options for parseGlob() input utility.
 */
export interface ParseGlobOptions {
  /** Current working directory for glob resolution */
  readonly cwd?: string;

  /** Whether to follow symlinks */
  readonly followSymlinks?: boolean;

  /** Patterns to exclude */
  readonly ignore?: readonly string[];

  /** Only match files (not directories) */
  readonly onlyFiles?: boolean;

  /** Only match directories (not files) */
  readonly onlyDirectories?: boolean;
}

/**
 * Options for normalizeId().
 */
export interface NormalizeIdOptions {
  /** Whether to lowercase the ID */
  readonly lowercase?: boolean;

  /** Whether to trim whitespace */
  readonly trim?: boolean;

  /** Minimum length requirement */
  readonly minLength?: number;

  /** Maximum length requirement */
  readonly maxLength?: number;

  /** Pattern the ID must match */
  readonly pattern?: RegExp;
}

/**
 * Options for confirmDestructive().
 */
export interface ConfirmDestructiveOptions {
  /** Message to display to the user */
  readonly message: string;

  /** Whether to bypass confirmation (e.g., --yes flag) */
  readonly bypassFlag?: boolean;

  /** Number of items affected (shown in confirmation) */
  readonly itemCount?: number;
}

/**
 * Numeric or date range parsed from CLI input.
 */
export type Range = NumericRange | DateRange;

/**
 * Numeric range (e.g., "1-10").
 */
export interface NumericRange {
  readonly type: "number";
  readonly min: number;
  readonly max: number;
}

/**
 * Date range (e.g., "2024-01-01..2024-12-31").
 */
export interface DateRange {
  readonly type: "date";
  readonly start: Date;
  readonly end: Date;
}

/**
 * Filter expression parsed from CLI input.
 */
export interface FilterExpression {
  readonly field: string;
  readonly value: string;
  readonly operator?: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains";
}

/**
 * Sort criteria parsed from CLI input.
 */
export interface SortCriteria {
  readonly field: string;
  readonly direction: "asc" | "desc";
}

/**
 * Key-value pair parsed from CLI input.
 */
export interface KeyValuePair {
  readonly key: string;
  readonly value: string;
}

// =============================================================================
// Pagination Types
// =============================================================================

/**
 * State for paginated command results.
 */
export interface PaginationState {
  /** Cursor for the next page */
  readonly cursor: string;

  /** Command that generated this state */
  readonly command: string;

  /** Context key for scoping pagination */
  readonly context?: string;

  /** Timestamp when state was created */
  readonly timestamp: number;

  /** Whether there are more results */
  readonly hasMore: boolean;

  /** Total count (if known) */
  readonly total?: number;
}

/**
 * Options for cursor persistence operations.
 */
export interface CursorOptions {
  /** Command name for cursor scoping */
  readonly command: string;

  /** Context key for additional scoping */
  readonly context?: string;

  /** Tool name for XDG path resolution */
  readonly toolName: string;

  /** Maximum age in milliseconds before a cursor is treated as expired */
  readonly maxAgeMs?: number;

  /** Whether there are more results (defaults to true) */
  readonly hasMore?: boolean;

  /** Total count of results (if known) */
  readonly total?: number;
}

// =============================================================================
// Error Types (re-exported from @outfitter/contracts)
// =============================================================================

/**
 * Re-export error classes from contracts for convenience.
 * These are the canonical error types for the CLI.
 */
// biome-ignore lint/performance/noBarrelFile: intentional re-exports for API surface
export {
  CancelledError,
  type ErrorCategory,
  ValidationError,
} from "@outfitter/contracts";

// =============================================================================
// Result Type Re-export
// =============================================================================

/**
 * Re-export Result type for convenience.
 * Handlers should use this for return types.
 */
export type { Result } from "better-result";
