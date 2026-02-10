/**
 * CLI factory for creating typed Commander.js instances.
 *
 * @packageDocumentation
 */

import { Command } from "commander";
import type { CLI, CLIConfig, CommandBuilder } from "./types.js";

function isCommanderHelp(error: { code?: string }): boolean {
  return (
    error.code === "commander.helpDisplayed" ||
    error.code === "commander.version" ||
    error.code === "commander.help"
  );
}

/**
 * Create a new CLI instance with the given configuration.
 *
 * The CLI wraps Commander.js with typed helpers, output contract enforcement,
 * and pagination state management.
 *
 * @param config - CLI configuration options
 * @returns A CLI instance ready for command registration
 *
 * @example
 * ```typescript
 * import { createCLI, command, output } from "@outfitter/cli";
 *
 * const cli = createCLI({
 *   name: "waymark",
 *   version: "1.0.0",
 *   description: "A note management CLI",
 * });
 *
 * cli.register(
 *   command("list")
 *     .description("List all notes")
 *     .action(async () => {
 *       const notes = await getNotes();
 *       output(notes);
 *     })
 * );
 *
 * await cli.parse();
 * ```
 */
export function createCLI(config: CLIConfig): CLI {
  const program = new Command();

  program.name(config.name).version(config.version);
  if (config.description) {
    program.description(config.description);
  }

  // Global --json flag available to all commands
  program.option("--json", "Output as JSON", false);

  const exit =
    config.onExit ?? ((code: number): void => void process.exit(code));

  // Force Commander to throw instead of exiting so parse() can route all exits
  // through the configured onExit hook (including async cleanup).
  program.exitOverride();

  const parse = async (argv?: readonly string[]): Promise<void> => {
    try {
      await program.parseAsync(argv ?? process.argv);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (isCommanderHelp(err as { code?: string })) {
        await exit(0);
        return;
      }

      if (config.onError) {
        config.onError(err);
      }

      const errorExitCode = (error as { exitCode?: number }).exitCode;
      const exitCode = typeof errorExitCode === "number" ? errorExitCode : 1;
      await exit(exitCode);
    }
  };

  const cli: CLI = {
    program,
    register: (builderOrCommand: CommandBuilder | Command): CLI => {
      if ("build" in builderOrCommand) {
        program.addCommand(builderOrCommand.build());
      } else {
        program.addCommand(builderOrCommand);
      }
      return cli;
    },
    parse,
  };

  return cli;
}
