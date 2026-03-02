/**
 * Type definitions for @outfitter/cli
 *
 * @packageDocumentation
 */

import type { ActionCliOption } from "@outfitter/contracts";
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
  /** CLI description (displayed in help output) */
  readonly description?: string;
  /** CLI name (used in help output and error messages) */
  readonly name: string;

  /** Custom error handler */
  readonly onError?: (error: Error) => void;

  /** Custom exit handler (defaults to process.exit) */
  readonly onExit?: (code: number) => void | Promise<void>;

  /** CLI version (displayed with --version) */
  readonly version: string;
}

/**
 * CLI instance returned by createCLI.
 */
export interface CLI {
  /** Parse arguments and execute the matched command */
  parse(argv?: readonly string[]): Promise<void>;

  /** Get the underlying Commander program */
  readonly program: Command;
  /** Register a command with the CLI */
  register(command: CommandBuilder | Command): this;
}

/**
 * Configuration for a single command.
 */
export interface CommandConfig {
  /** Command aliases */
  readonly aliases?: readonly string[];

  /** Command description */
  readonly description?: string;

  /** Whether to hide from help output */
  readonly hidden?: boolean;
  /** Command name and argument syntax (e.g., "list" or "get <id>") */
  readonly name: string;
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
  /** Set the action handler */
  action<TFlags extends CommandFlags = CommandFlags>(
    handler: CommandAction<TFlags>
  ): this;

  /** Add command aliases */
  alias(alias: string): this;

  /** Build the underlying Commander command */
  build(): Command;
  /** Set command description */
  description(text: string): this;

  /** Add a command option/flag */
  option(flags: string, description: string, defaultValue?: unknown): this;

  /** Apply a flag preset (adds its options to the command) */
  preset(preset: FlagPreset<Record<string, unknown>>): this;

  /** Add a required option */
  requiredOption(
    flags: string,
    description: string,
    defaultValue?: unknown
  ): this;
}

// =============================================================================
// Verb Convention Types
// =============================================================================

/**
 * A family of related command verbs with a primary name and aliases.
 */
export interface VerbFamily {
  /** Alternative names for this verb */
  readonly aliases: readonly string[];

  /** Description of what this verb family does */
  readonly description: string;
  /** Primary verb name */
  readonly primary: string;
}

/**
 * Configuration for resolving a verb family with project-level overrides.
 */
export interface VerbConfig {
  /** Whether to include aliases (default: true) */
  readonly aliases?: boolean;

  /** Aliases to exclude */
  readonly excludeAliases?: readonly string[];

  /** Additional aliases beyond defaults */
  readonly extraAliases?: readonly string[];
  /** Override the primary verb (e.g., "edit" instead of "modify") */
  readonly primary?: string;
}

// =============================================================================
// Flag Preset Types
// =============================================================================

/**
 * A composable set of CLI flags with typed resolution.
 *
 * Presets bundle flag definitions with a resolver that coerces
 * raw Commander output into typed values.
 */
export interface FlagPreset<TResolved extends Record<string, unknown>> {
  /** Unique identifier for deduplication in composePresets */
  readonly id: string;

  /** Commander option definitions */
  readonly options: readonly ActionCliOption[];

  /** Resolve raw Commander flags into typed values */
  readonly resolve: (flags: Record<string, unknown>) => TResolved;
}

/**
 * Configuration for creating a flag preset.
 */
export interface FlagPresetConfig<TResolved extends Record<string, unknown>> {
  /** Unique identifier for deduplication */
  readonly id: string;

  /** Commander option definitions */
  readonly options: readonly ActionCliOption[];

  /** Resolve raw Commander flags into typed values */
  readonly resolve: (flags: Record<string, unknown>) => TResolved;
}

/**
 * Configuration for creating a custom boolean flag preset.
 */
export interface BooleanFlagPresetConfig<TKey extends string> {
  /** Default resolved value (defaults to false) */
  readonly defaultValue?: boolean;

  /** Help description for the option */
  readonly description: string;

  /** Commander option definition (e.g., "--force" or "--no-codemods") */
  readonly flags: string;
  /** Unique identifier for deduplication */
  readonly id: string;

  /** Resolved output property name */
  readonly key: TKey;

  /** Positive keys that should be negated (e.g., "codemods" for --no-codemods) */
  readonly negatedSources?: readonly string[];

  /** Whether the option is required */
  readonly required?: boolean;

  /** Candidate raw flag keys to read (defaults to [key]) */
  readonly sources?: readonly string[];
}

/**
 * Configuration for creating a custom enum flag preset.
 */
export interface EnumFlagPresetConfig<
  TKey extends string,
  TValue extends string,
> {
  /** Fallback value when input is missing or invalid */
  readonly defaultValue: TValue;

  /** Help description for the option */
  readonly description: string;

  /** Commander option definition */
  readonly flags: string;
  /** Unique identifier for deduplication */
  readonly id: string;

  /** Resolved output property name */
  readonly key: TKey;

  /** Whether the option is required */
  readonly required?: boolean;

  /** Candidate raw flag keys to read (defaults to [key]) */
  readonly sources?: readonly string[];

  /** Allowed enum values */
  readonly values: readonly TValue[];
}

/**
 * Configuration for creating a custom numeric flag preset.
 */
export interface NumberFlagPresetConfig<TKey extends string> {
  /** Fallback value when input is missing or invalid */
  readonly defaultValue: number;

  /** Help description for the option */
  readonly description: string;

  /** Commander option definition */
  readonly flags: string;
  /** Unique identifier for deduplication */
  readonly id: string;

  /** Floor parsed values (defaults to true) */
  readonly integer?: boolean;

  /** Resolved output property name */
  readonly key: TKey;

  /** Upper bound (inclusive) */
  readonly max?: number;

  /** Lower bound (inclusive) */
  readonly min?: number;

  /** Whether the option is required */
  readonly required?: boolean;

  /** Candidate raw flag keys to read (defaults to [key]) */
  readonly sources?: readonly string[];
}

/**
 * Configuration for creating a custom string-list flag preset.
 */
export interface StringListFlagPresetConfig<TKey extends string> {
  /** Remove duplicate values while preserving order */
  readonly dedupe?: boolean;

  /** Fallback list when input is missing or invalid */
  readonly defaultValue?: readonly string[];

  /** Help description for the option */
  readonly description: string;

  /** Commander option definition */
  readonly flags: string;
  /** Unique identifier for deduplication */
  readonly id: string;

  /** Resolved output property name */
  readonly key: TKey;

  /** Whether the option is required */
  readonly required?: boolean;

  /** Split string values by this separator (defaults to ",") */
  readonly separator?: string;

  /** Candidate raw flag keys to read (defaults to [key]) */
  readonly sources?: readonly string[];
}

/**
 * Result of composing multiple presets together.
 * Options are deduplicated by preset id (first wins).
 */
export type ComposedPreset<TResolved extends Record<string, unknown>> =
  FlagPreset<TResolved>;

/**
 * Configuration for the pagination flag preset.
 */
export interface PaginationPresetConfig {
  /** Default limit when not specified (default: 20) */
  readonly defaultLimit?: number;

  /** Maximum allowed limit (default: 100) */
  readonly maxLimit?: number;
}

/**
 * Resolved interaction flags from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type InteractionFlags = {
  /** Whether interactive prompts are allowed */
  readonly interactive: boolean;

  /** Whether to auto-confirm prompts */
  readonly yes: boolean;
};

/**
 * Resolved strict mode flags from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type StrictFlags = {
  /** Whether strict mode is enabled */
  readonly strict: boolean;
};

/**
 * Resolved time-window flags from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type TimeWindowFlags = {
  /** Start of time window */
  readonly since: Date | undefined;

  /** End of time window */
  readonly until: Date | undefined;
};

/**
 * Configuration for the time-window flag preset.
 */
export interface TimeWindowPresetConfig {
  /** Maximum range in milliseconds between since and until (optional guard) */
  readonly maxRange?: number;
}

/**
 * Resolved execution flags from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type ExecutionFlags = {
  /** Timeout in milliseconds (undefined = no timeout) */
  readonly timeout: number | undefined;

  /** Number of retries */
  readonly retries: number;

  /** Whether to operate in offline mode */
  readonly offline: boolean;
};

/**
 * Configuration for the execution flag preset.
 */
export interface ExecutionPresetConfig {
  /** Default number of retries (default: 0) */
  readonly defaultRetries?: number;
  /** Default timeout in milliseconds (default: undefined) */
  readonly defaultTimeout?: number;

  /** Maximum number of retries (default: 10) */
  readonly maxRetries?: number;
}

/**
 * Resolved projection flags from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type ProjectionFlags = {
  /** Fields to include (undefined = all) */
  readonly fields: string[] | undefined;

  /** Fields to exclude (undefined = none) */
  readonly excludeFields: string[] | undefined;

  /** Whether to output only the count of results */
  readonly count: boolean;
};

/**
 * Color mode for CLI output.
 */
export type ColorMode = "auto" | "always" | "never";

/**
 * Resolved color flags from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type ColorFlags = {
  /** Color output mode */
  readonly color: ColorMode;
};

/**
 * Resolved pagination flags from CLI input.
 */
// eslint-disable-next-line typescript/consistent-type-definitions -- must be `type` to satisfy Record<string, unknown> constraint in FlagPreset<T>
export type PaginationFlags = {
  /** Number of results to return */
  readonly limit: number;

  /** Continue from last position */
  readonly next: boolean;

  /** Clear saved cursor and start fresh */
  readonly reset: boolean;
};

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
  /** Exit code to use after output (undefined = don't exit) */
  readonly exitCode?: number;

  /** Whether to pretty-print JSON output */
  readonly pretty?: boolean;

  /** Stream to write to (defaults to stdout) */
  readonly stream?: NodeJS.WritableStream;
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

  /** Only match directories (not files) */
  readonly onlyDirectories?: boolean;

  /** Only match files (not directories) */
  readonly onlyFiles?: boolean;
}

/**
 * Options for normalizeId().
 */
export interface NormalizeIdOptions {
  /** Whether to lowercase the ID */
  readonly lowercase?: boolean;

  /** Maximum length requirement */
  readonly maxLength?: number;

  /** Minimum length requirement */
  readonly minLength?: number;

  /** Pattern the ID must match */
  readonly pattern?: RegExp;

  /** Whether to trim whitespace */
  readonly trim?: boolean;
}

/**
 * Numeric or date range parsed from CLI input.
 */
export type Range = NumericRange | DateRange;

/**
 * Numeric range (e.g., "1-10").
 */
export interface NumericRange {
  readonly max: number;
  readonly min: number;
  readonly type: "number";
}

/**
 * Date range (e.g., "2024-01-01..2024-12-31").
 */
export interface DateRange {
  readonly end: Date;
  readonly start: Date;
  readonly type: "date";
}

/**
 * Filter expression parsed from CLI input.
 */
export interface FilterExpression {
  readonly field: string;
  readonly operator?: "eq" | "ne" | "gt" | "lt" | "gte" | "lte" | "contains";
  readonly value: string;
}

/**
 * Sort criteria parsed from CLI input.
 */
export interface SortCriteria {
  readonly direction: "asc" | "desc";
  readonly field: string;
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
  /** Command that generated this state */
  readonly command: string;

  /** Context key for scoping pagination */
  readonly context?: string;
  /** Cursor for the next page */
  readonly cursor: string;

  /** Whether there are more results */
  readonly hasMore: boolean;

  /** Timestamp when state was created */
  readonly timestamp: number;

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

  /** Whether there are more results (defaults to true) */
  readonly hasMore?: boolean;

  /** Maximum age in milliseconds before a cursor is treated as expired */
  readonly maxAgeMs?: number;

  /** Tool name for XDG path resolution */
  readonly toolName: string;

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
// eslint-disable-next-line oxc/no-barrel-file -- intentional re-exports for API surface
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
