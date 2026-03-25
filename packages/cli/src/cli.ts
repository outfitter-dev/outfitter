/**
 * CLI factory for creating typed Commander.js instances.
 *
 * @packageDocumentation
 */

import { Command } from "commander";

import { buildCommandTree } from "./hints.js";
import { output } from "./output.js";
import type { CLI, CLIConfig, CommandBuilder } from "./types.js";

function isCommanderHelp(error: { code?: string }): boolean {
  return (
    error.code === "commander.helpDisplayed" ||
    error.code === "commander.version" ||
    error.code === "commander.help"
  );
}

/**
 * Relocate `--json` flags to the global position (after argv[0..1]).
 *
 * Commander requires global flags to appear before the subcommand, but users
 * naturally place `--json` at the end. This function scans for `--json` tokens
 * in the subcommand region and moves them immediately after the binary pair
 * (argv[0] and argv[1]), so Commander sees them as global flags.
 *
 * Stops scanning at the `--` end-of-options separator so that
 * `--json` tokens after `--` are preserved as positional arguments.
 *
 * @param argv - Full process.argv-style argument array (e.g. `process.argv`)
 * @returns A new argv array with any `--json` flags relocated to the global
 *   position (index 2), preserving relative order of all other arguments
 *
 * @internal Exported for unit testing only.
 */
export function normalizeGlobalJsonFlag(argv: readonly string[]): string[] {
  const dashDashIndex = argv.indexOf("--");
  const searchBound = dashDashIndex === -1 ? argv.length : dashDashIndex;

  const relocatedJsonFlags: string[] = [];
  const normalized: string[] = [];

  for (const [index, arg] of argv.entries()) {
    if (index >= 2 && index < searchBound && arg === "--json") {
      relocatedJsonFlags.push(arg);
      continue;
    }

    normalized.push(arg);
  }

  if (relocatedJsonFlags.length === 0) {
    return [...argv];
  }

  const prefixLength = Math.min(2, normalized.length);
  return [
    ...normalized.slice(0, prefixLength),
    ...relocatedJsonFlags,
    ...normalized.slice(prefixLength),
  ];
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
  let bridgedJsonEnvPrevious: string | undefined;
  let bridgedJsonEnvActive = false;

  const restoreJsonEnvBridge = (): void => {
    if (!bridgedJsonEnvActive) {
      return;
    }

    if (bridgedJsonEnvPrevious === undefined) {
      // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-var restoration after flag bridging
      delete process.env["OUTFITTER_JSON"];
    } else {
      // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-var restoration after flag bridging
      process.env["OUTFITTER_JSON"] = bridgedJsonEnvPrevious;
    }

    bridgedJsonEnvPrevious = undefined;
    bridgedJsonEnvActive = false;
  };

  program.name(config.name).version(config.version);
  program.enablePositionalOptions();
  if (config.description) {
    program.description(config.description);
  }

  // Global --json flag available to all commands.
  // The preAction hook bridges any --json flag (global or subcommand) into
  // the OUTFITTER_JSON env var so output() auto-detects JSON mode.
  program.option("--json", "Output as JSON");
  program.hook("preAction", (thisCommand) => {
    const allOpts = thisCommand.optsWithGlobals();
    if (allOpts["json"] === true && !bridgedJsonEnvActive) {
      // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-var state capture before flag bridging
      bridgedJsonEnvPrevious = process.env["OUTFITTER_JSON"];
      // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-var bridging: propagates --json flag
      process.env["OUTFITTER_JSON"] = "1";
      bridgedJsonEnvActive = true;
    }
  });
  program.hook("postAction", () => {
    restoreJsonEnvBridge();
  });

  const exit =
    // oxlint-disable-next-line outfitter/no-process-exit-in-packages -- CLI adapter default exit hook owns process termination
    config.onExit ?? ((code: number): void => void process.exit(code));

  // Force Commander to throw instead of exiting so parse() can route all exits
  // through the configured onExit hook (including async cleanup).
  program.exitOverride();

  // Self-documenting root command: when no subcommand is given, output the
  // command tree as JSON (piped/JSON mode) or help text (TTY mode).
  // When piped (non-TTY) and no explicit JSON flag, default to JSON output
  // so agents and scripts get structured data without requiring --json.
  program.action(async () => {
    const isJsonMode =
      program.opts()["json"] === true ||
      // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-based feature detection
      process.env["OUTFITTER_JSON"] === "1" ||
      // oxlint-disable-next-line outfitter/no-process-env-in-packages -- boundary: env-based feature detection
      process.env["OUTFITTER_JSONL"] === "1" ||
      !process.stdout.isTTY;

    if (isJsonMode) {
      const tree = buildCommandTree(program);
      await output(tree, "json");
    } else {
      program.outputHelp();
    }
  });

  const parse = async (argv?: readonly string[]): Promise<void> => {
    const normalizedArgv = normalizeGlobalJsonFlag(argv ?? process.argv);

    try {
      await program.parseAsync(normalizedArgv);
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
    } finally {
      restoreJsonEnvBridge();
    }
  };

  const cli: CLI = {
    program,
    register: (
      builderOrCommand: CommandBuilder<unknown, unknown> | Command
    ): CLI => {
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
