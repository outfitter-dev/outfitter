/**
 * Command builder for creating typed CLI commands.
 *
 * @packageDocumentation
 */

import { Command } from "commander";

import { createCLI as createCLIImpl } from "./cli.js";
import { isSchemaPreset } from "./flags.js";
import { exitWithError } from "./output.js";
import { resolveOutputMode } from "./query.js";
import {
  createCommanderOption,
  deriveFlags,
  validateInput,
} from "./schema-input.js";
import type {
  AnyPreset,
  CLI,
  CLIConfig,
  CommandAction,
  CommandBuilder,
  CommandFlags,
  ContextFactory,
  ErrorHintFn,
  FlagPreset,
  RelatedToDeclaration,
  RelatedToOptions,
  SchemaPreset,
  SuccessHintFn,
  ZodObjectLike,
} from "./types.js";

export type {
  AnyPreset,
  CLI,
  CLIConfig,
  CommandAction,
  CommandBuilder,
  CommandConfig,
  CommandFlags,
  ContextFactory,
  ErrorHintFn,
  FlagPreset,
  RelatedToDeclaration,
  RelatedToOptions,
  SchemaPreset,
  SuccessHintFn,
  ZodObjectLike,
} from "./types.js";

/**
 * Command metadata for safety signals (readOnly, idempotent).
 * Stored on Commander commands and surfaced in the command tree.
 */
export interface CommandMetadata {
  /** When true, the command does not modify any state */
  readonly readOnly?: boolean;
  /** When true, calling the command multiple times with the same input has the same effect */
  readonly idempotent?: boolean;
}

/**
 * Internal type extending Commander's Command with hint function metadata.
 * Used to pass stored hint functions through build() for downstream use by runHandler().
 */
interface CommandWithHints extends Command {
  // eslint-disable-next-line typescript/no-explicit-any -- internal metadata; typed externally via SuccessHintFn/ErrorHintFn
  __successHintFn?: SuccessHintFn<any>;
  // eslint-disable-next-line typescript/no-explicit-any -- internal metadata; typed externally via SuccessHintFn/ErrorHintFn
  __errorHintFn?: ErrorHintFn<any>;
  /** Safety metadata signals stored by .readOnly() and .idempotent() */
  __metadata?: CommandMetadata;
  /** Relationship declarations stored by .relatedTo() */
  __relatedTo?: RelatedToDeclaration[];
}

/**
 * Build a merged validation schema from the command's .input() schema and any
 * schema presets. When both exist, the merged schema validates all fields from
 * both. When only one exists, it is returned directly. When neither exists,
 * returns undefined.
 *
 * The merged schema implements ZodObjectLike by combining shapes and delegating
 * safeParse to the underlying schemas.
 */
function buildMergedSchema(
  inputSchema: ZodObjectLike | undefined,
  schemaPresets: readonly SchemaPreset<Record<string, unknown>>[]
): ZodObjectLike | undefined {
  if (!inputSchema && schemaPresets.length === 0) return undefined;
  if (schemaPresets.length === 0) return inputSchema;
  if (!inputSchema && schemaPresets.length === 1) {
    return schemaPresets[0]!.schema;
  }

  // Merge shapes from all schemas
  const mergedShape: Record<string, unknown> = {};
  if (inputSchema) {
    Object.assign(mergedShape, inputSchema.shape);
  }
  for (const preset of schemaPresets) {
    Object.assign(mergedShape, preset.schema.shape);
  }

  // Build a merged safeParse that validates against all schemas
  const allSchemas: ZodObjectLike[] = [];
  if (inputSchema) allSchemas.push(inputSchema);
  for (const preset of schemaPresets) allSchemas.push(preset.schema);

  return {
    shape: mergedShape,
    safeParse(data: unknown): {
      success: boolean;
      data?: Record<string, unknown>;
      error?: unknown;
    } {
      // Validate against each schema separately and merge results.
      // Each schema only knows its own fields, so we pick fields per schema.
      let merged: Record<string, unknown> = {};
      for (const schema of allSchemas) {
        // Pick only the fields this schema defines
        const schemaData: Record<string, unknown> = {};
        if (data && typeof data === "object") {
          for (const key of Object.keys(schema.shape)) {
            if (key in data) {
              schemaData[key] = (data as Record<string, unknown>)[key];
            }
          }
        }
        const result = schema.safeParse(schemaData);
        if (!result.success) {
          return result;
        }
        merged = { ...merged, ...(result.data as Record<string, unknown>) };
      }
      return { success: true, data: merged };
    },
  };
}

function parseCommandSignature(signature: string): {
  name: string;
  argumentsSpec?: string;
} {
  const trimmed = signature.trim();
  const firstWhitespace = trimmed.search(/\s/);

  if (firstWhitespace === -1) {
    return { name: trimmed };
  }

  const name = trimmed.slice(0, firstWhitespace);
  const argumentsSpec = trimmed.slice(firstWhitespace).trim();
  return {
    name,
    ...(argumentsSpec ? { argumentsSpec } : {}),
  };
}

/**
 * Create a CLI instance with a portable return type from this module.
 */
export function createCLI(config: CLIConfig): CLI {
  return createCLIImpl(config);
}

// eslint-disable-next-line typescript/no-explicit-any -- internal impl; public API is typed via CommandBuilder<TInput, TContext>
class CommandBuilderImpl implements CommandBuilder<any, any> {
  private readonly cmd: Command;
  private inputSchema: ZodObjectLike | undefined;
  // eslint-disable-next-line typescript/no-explicit-any -- internal impl; typed at interface level
  private ctxFactory: ((input: any) => Promise<unknown> | unknown) | undefined;
  // eslint-disable-next-line typescript/no-explicit-any -- internal impl; typed at interface level
  private successHintFn: SuccessHintFn<any> | undefined;
  // eslint-disable-next-line typescript/no-explicit-any -- internal impl; typed at interface level
  private errorHintsFn: ErrorHintFn<any> | undefined;
  private readonly explicitLongFlags = new Set<string>();
  private readonly schemaPresets: SchemaPreset<Record<string, unknown>>[] = [];
  private schemaFlagsApplied = false;
  private _destructive = false;
  private _readOnly = false;
  private _idempotent = false;
  private readonly _relatedTo: RelatedToDeclaration[] = [];

  constructor(signature: string) {
    const { name, argumentsSpec } = parseCommandSignature(signature);
    this.cmd = new Command(name);
    if (argumentsSpec) {
      this.cmd.arguments(argumentsSpec);
    }
  }

  description(text: string): this {
    this.cmd.description(text);
    return this;
  }

  option(flags: string, description: string, defaultValue?: unknown): this {
    // Track explicitly declared long flags for override detection
    const longMatch = flags.match(/--([a-z][a-z0-9-]*)/i);
    if (longMatch) {
      this.explicitLongFlags.add(`--${longMatch[1]}`);
    }

    this.cmd.option(
      flags,
      description,
      defaultValue as string | boolean | string[] | undefined
    );
    return this;
  }

  requiredOption(
    flags: string,
    description: string,
    defaultValue?: unknown
  ): this {
    const longMatch = flags.match(/--([a-z][a-z0-9-]*)/i);
    if (longMatch) {
      this.explicitLongFlags.add(`--${longMatch[1]}`);
    }

    this.cmd.requiredOption(
      flags,
      description,
      defaultValue as string | boolean | string[] | undefined
    );
    return this;
  }

  alias(alias: string): this {
    this.cmd.alias(alias);
    return this;
  }

  input<T extends Record<string, unknown>>(
    schema: ZodObjectLike<T>
  ): CommandBuilder<T> {
    this.inputSchema = schema as ZodObjectLike;
    // Schema flags are applied lazily in applySchemaFlags() — called by action() and build()
    return this as unknown as CommandBuilder<T>;
  }

  // eslint-disable-next-line typescript/no-explicit-any -- internal impl; typed at interface level
  context<T>(factory: ContextFactory<any, T>): CommandBuilder<any, T> {
    this.ctxFactory = factory;
    return this as unknown as CommandBuilder<any, T>;
  }

  // eslint-disable-next-line typescript/no-explicit-any -- internal impl; typed at interface level
  hints(fn: SuccessHintFn<any>): this {
    this.successHintFn = fn;
    return this;
  }

  // eslint-disable-next-line typescript/no-explicit-any -- internal impl; typed at interface level
  onError(fn: ErrorHintFn<any>): this {
    this.errorHintsFn = fn;
    return this;
  }

  destructive(isDest: boolean): this {
    this._destructive = isDest;
    return this;
  }

  readOnly(isReadOnly: boolean): this {
    this._readOnly = isReadOnly;
    return this;
  }

  idempotent(isIdempotent: boolean): this {
    this._idempotent = isIdempotent;
    return this;
  }

  relatedTo(target: string, options?: RelatedToOptions): this {
    this._relatedTo.push({
      target,
      ...(options?.description ? { description: options.description } : {}),
    });
    return this;
  }

  preset(preset: AnyPreset<Record<string, unknown>>): this {
    if (isSchemaPreset(preset)) {
      // Schema-driven preset: store for lazy flag derivation in applySchemaFlags()
      this.schemaPresets.push(preset);
      return this;
    }

    // FlagPreset: add options directly to Commander (existing behavior)
    for (const opt of (preset as FlagPreset<Record<string, unknown>>).options) {
      // Track preset flags as explicit too — they override schema-derived flags
      const longMatch = opt.flags.match(/--([a-z][a-z0-9-]*)/i);
      if (longMatch) {
        this.explicitLongFlags.add(`--${longMatch[1]}`);
      }

      if (opt.required) {
        this.cmd.requiredOption(
          opt.flags,
          opt.description,
          opt.defaultValue as string | boolean | string[] | undefined
        );
      } else {
        this.cmd.option(
          opt.flags,
          opt.description,
          opt.defaultValue as string | boolean | string[] | undefined
        );
      }
    }
    return this;
  }

  // eslint-disable-next-line typescript/no-explicit-any -- internal impl; typed at interface level
  action<TFlags extends CommandFlags = CommandFlags>(
    handler: CommandAction<TFlags, any, any>
  ): this {
    const schema = this.inputSchema;
    const contextFactory = this.ctxFactory;
    const presets = [...this.schemaPresets];
    this.applySchemaFlags();
    this.applyDestructiveFlag();

    // Build a merged validation schema that includes both .input() fields
    // and schema preset fields. This ensures preset Zod fragments are
    // validated alongside the command's own input schema.
    const mergedSchema = buildMergedSchema(schema, presets);

    this.cmd.action(async (...args: unknown[]) => {
      const command = args.at(-1) as Command;
      const flags = (command.optsWithGlobals?.() ?? command.opts()) as TFlags;
      const positional = command.args as string[];

      // Wrap validation and context factory — these should go through
      // exitWithError on failure. The handler call stays outside the
      // try/catch so runHandler's own error lifecycle isn't intercepted.
      let input: Record<string, unknown> | undefined;
      let ctx: unknown;
      try {
        input = mergedSchema ? validateInput(flags, mergedSchema) : undefined;

        // Execute schema preset resolvers, composing resolved values into input.
        // Resolvers transform raw Commander flags into typed preset values.
        if (input !== undefined && presets.length > 0) {
          for (const preset of presets) {
            const resolved = preset.resolve(
              flags as unknown as Record<string, unknown>
            );
            Object.assign(input, resolved);
          }
        }
        // Construct context if factory is provided
        if (contextFactory) {
          // When .input() is used, pass validated input; otherwise pass raw flags
          const factoryArg = input !== undefined ? input : flags;
          ctx = await contextFactory(factoryArg);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const { mode } = resolveOutputMode(
          flags as unknown as Record<string, unknown>
        );
        exitWithError(error, mode);
      }

      await (handler as CommandAction<TFlags, unknown, unknown>)({
        args: positional,
        flags,
        command,
        input,
        ctx,
      });
    });
    return this;
  }

  build(): Command {
    this.applySchemaFlags();
    this.applyDestructiveFlag();

    // Store hint functions as metadata on the Command for downstream use by runHandler()
    if (this.successHintFn) {
      (this.cmd as CommandWithHints).__successHintFn = this.successHintFn;
    }
    if (this.errorHintsFn) {
      (this.cmd as CommandWithHints).__errorHintFn = this.errorHintsFn;
    }

    // Store safety metadata signals on the Command for buildCommandTree() to surface
    const metadata: CommandMetadata = {};
    if (this._readOnly) {
      (metadata as { readOnly: boolean }).readOnly = true;
    }
    if (this._idempotent) {
      (metadata as { idempotent: boolean }).idempotent = true;
    }
    if (metadata.readOnly !== undefined || metadata.idempotent !== undefined) {
      (this.cmd as CommandWithHints).__metadata = metadata;
    }

    // Store relationship declarations on the Command for action graph construction
    if (this._relatedTo.length > 0) {
      (this.cmd as CommandWithHints).__relatedTo = [...this._relatedTo];
    }

    return this.cmd;
  }

  /**
   * Apply schema-derived flags to the Commander command.
   * Called lazily so that explicit .option()/.requiredOption()/.preset() calls
   * made after .input() are properly tracked as overrides.
   *
   * Derives flags from both .input() schema AND schema presets.
   */
  private applySchemaFlags(): void {
    if (this.schemaFlagsApplied) return;

    // Nothing to derive if neither .input() nor schema presets are used
    if (!this.inputSchema && this.schemaPresets.length === 0) return;

    this.schemaFlagsApplied = true;

    // Also collect long flags already registered on the Commander command
    // (from .option()/.requiredOption()/.preset() calls made before .input())
    const existingLongs = new Set(this.explicitLongFlags);
    for (const opt of this.cmd.options) {
      if (opt.long) {
        existingLongs.add(opt.long);
      }
    }

    // Derive flags from .input() schema
    if (this.inputSchema) {
      const derived = deriveFlags(this.inputSchema, existingLongs);
      for (const flag of derived) {
        const option = createCommanderOption(flag, this.inputSchema);
        this.cmd.addOption(option);
        // Track the derived long flag so schema preset fields
        // with the same name don't duplicate it
        existingLongs.add(flag.longFlag);
      }
    }

    // Derive flags from schema presets
    for (const schemaPreset of this.schemaPresets) {
      const derived = deriveFlags(schemaPreset.schema, existingLongs);
      for (const flag of derived) {
        const option = createCommanderOption(flag, schemaPreset.schema);
        this.cmd.addOption(option);
        // Track to prevent duplicates across multiple schema presets
        existingLongs.add(flag.longFlag);
      }
    }
  }

  /**
   * Auto-add --dry-run flag when the command is marked destructive.
   * Deduplicates if --dry-run is already present from .option(), .preset(),
   * or .input() schema.
   */
  private applyDestructiveFlag(): void {
    if (!this._destructive) return;

    // Check if --dry-run already exists on the Commander command
    const hasDryRun = this.cmd.options.some((o) => o.long === "--dry-run");
    if (hasDryRun) return;

    this.cmd.option(
      "--dry-run",
      "Preview changes without applying (destructive command safety)",
      false
    );
  }
}

/**
 * Create a new command builder with the given name.
 *
 * The command builder provides a fluent API for defining CLI commands
 * with typed flags, arguments, and actions.
 *
 * @param name - Command name and optional argument syntax (e.g., "list" or "get <id>")
 * @returns A CommandBuilder instance for fluent configuration
 *
 * @example
 * ```typescript
 * import { command, output } from "@outfitter/cli";
 *
 * export const list = command("list")
 *   .description("List all notes")
 *   .option("--limit <n>", "Max results", "20")
 *   .option("--json", "Output as JSON")
 *   .option("--next", "Continue from last position")
 *   .action(async ({ flags }) => {
 *     const results = await listNotes(flags);
 *     output(results);
 *   });
 * ```
 *
 * @example
 * ```typescript
 * // Command with required argument
 * export const get = command("get <id>")
 *   .description("Get a note by ID")
 *   .action(async ({ args }) => {
 *     const [id] = args;
 *     const note = await getNote(id);
 *     output(note);
 *   });
 * ```
 */
export function command(name: string): CommandBuilder {
  return new CommandBuilderImpl(name);
}
