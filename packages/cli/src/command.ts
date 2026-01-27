/**
 * Command builder for creating typed CLI commands.
 *
 * @packageDocumentation
 */

import { Command } from "commander";
import type { CommandAction, CommandBuilder, CommandFlags } from "./types.js";

class CommandBuilderImpl implements CommandBuilder {
  private readonly command: Command;

  constructor(name: string) {
    this.command = new Command(name);
  }

  description(text: string): this {
    this.command.description(text);
    return this;
  }

  option(flags: string, description: string, defaultValue?: unknown): this {
    this.command.option(
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
    this.command.requiredOption(
      flags,
      description,
      defaultValue as string | boolean | string[] | undefined
    );
    return this;
  }

  alias(alias: string): this {
    this.command.alias(alias);
    return this;
  }

  action<TFlags extends CommandFlags = CommandFlags>(
    handler: CommandAction<TFlags>
  ): this {
    this.command.action(async (...args: unknown[]) => {
      const command = args.at(-1) as Command;
      const flags = (command.optsWithGlobals?.() ?? command.opts()) as TFlags;
      const positional = command.args as string[];
      await handler({ args: positional, flags, command });
    });
    return this;
  }

  build(): Command {
    return this.command;
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
