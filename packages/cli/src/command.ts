/**
 * Command builder for creating typed CLI commands.
 *
 * @packageDocumentation
 */

import { Command } from "commander";

import { createCLI as createCLIImpl } from "./cli.js";
import {
  createCommanderOption,
  deriveFlags,
  validateInput,
} from "./schema-input.js";
import type {
  CLI,
  CLIConfig,
  CommandAction,
  CommandBuilder,
  CommandFlags,
  FlagPreset,
  ZodObjectLike,
} from "./types.js";

export type {
  CLI,
  CLIConfig,
  CommandAction,
  CommandBuilder,
  CommandConfig,
  CommandFlags,
  FlagPreset,
  ZodObjectLike,
} from "./types.js";

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

// eslint-disable-next-line typescript/no-explicit-any -- internal impl; public API is typed via CommandBuilder<TInput>
class CommandBuilderImpl implements CommandBuilder<any> {
  private readonly cmd: Command;
  private inputSchema: ZodObjectLike | undefined;
  private readonly explicitLongFlags = new Set<string>();
  private schemaFlagsApplied = false;

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

  preset(preset: FlagPreset<Record<string, unknown>>): this {
    for (const opt of preset.options) {
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
    handler: CommandAction<TFlags, any>
  ): this {
    const schema = this.inputSchema;
    this.applySchemaFlags();

    this.cmd.action(async (...args: unknown[]) => {
      const command = args.at(-1) as Command;
      const flags = (command.optsWithGlobals?.() ?? command.opts()) as TFlags;
      const positional = command.args as string[];

      const input = schema ? validateInput(flags, schema) : undefined;

      await (handler as CommandAction<TFlags, unknown>)({
        args: positional,
        flags,
        command,
        input,
      });
    });
    return this;
  }

  build(): Command {
    this.applySchemaFlags();
    return this.cmd;
  }

  /**
   * Apply schema-derived flags to the Commander command.
   * Called lazily so that explicit .option()/.requiredOption()/.preset() calls
   * made after .input() are properly tracked as overrides.
   */
  private applySchemaFlags(): void {
    if (this.schemaFlagsApplied || !this.inputSchema) return;
    this.schemaFlagsApplied = true;

    // Also collect long flags already registered on the Commander command
    // (from .option()/.requiredOption()/.preset() calls made before .input())
    const existingLongs = new Set(this.explicitLongFlags);
    for (const opt of this.cmd.options) {
      if (opt.long) {
        existingLongs.add(opt.long);
      }
    }

    const derived = deriveFlags(this.inputSchema, existingLongs);

    for (const flag of derived) {
      const option = createCommanderOption(flag, this.inputSchema);
      this.cmd.addOption(option);
    }
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
