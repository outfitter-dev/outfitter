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

  const exit = config.onExit ?? ((code: number): never => process.exit(code));

  program.exitOverride((error) => {
    if (isCommanderHelp(error)) {
      exit(0);
    }

    if (config.onError) {
      config.onError(error);
    }

    const exitCode =
      typeof error.exitCode === "number" && Number.isFinite(error.exitCode)
        ? error.exitCode
        : 1;
    exit(exitCode);
  });

  const parse = async (argv?: readonly string[]): Promise<void> => {
    try {
      await program.parseAsync(argv ?? process.argv);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      if (config.onError) {
        config.onError(err);
      }
      const errorExitCode = (error as { exitCode?: number }).exitCode;
      const exitCode = typeof errorExitCode === "number" ? errorExitCode : 1;
      exit(exitCode);
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
