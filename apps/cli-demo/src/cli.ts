#!/usr/bin/env bun

/**
 * CLI demo entrypoint.
 *
 * @packageDocumentation
 */

import { readFileSync } from "node:fs";
import { createCLI } from "@outfitter/cli/command";
import { exitWithError } from "@outfitter/cli/output";
import type { Command } from "commander";
import { printDemoResults, runDemo } from "./commands/demo.js";
import { resolveOutputModeFromContext } from "./output-mode.js";

function createProgram() {
  const cli = createCLI({
    name: "outfitter-demo",
    version: readCliVersion(),
    description: "Demo @outfitter/cli and @outfitter/tui rendering primitives",
    onError: (error) => {
      const err =
        error instanceof Error
          ? error
          : new Error("An unexpected error occurred");
      exitWithError(err);
    },
  });

  // Root command: `outfitter-demo [section]`
  cli.program
    .argument("[section]", "Section to run (or 'all')")
    .option("-l, --list", "List available demo sections", false)
    .option("-a, --animate", "Run animated demo (spinners only)", false)
    .option("--jsonl", "Output as JSONL", false)
    .action(async (...args: unknown[]) => {
      const command = args.at(-1) as Command;
      const section =
        typeof args[0] === "string" ? (args[0] as string) : undefined;
      const flags = (command.optsWithGlobals?.() ?? command.opts()) as Record<
        string,
        unknown
      >;
      const outputMode = resolveOutputModeFromContext(flags);

      const result = await runDemo({
        section,
        list: Boolean(flags["list"]),
        animate: Boolean(flags["animate"]),
      });

      await printDemoResults(result, { mode: outputMode });

      if (result.exitCode !== 0) {
        process.exit(result.exitCode);
      }
    });

  return cli;
}

const DEFAULT_CLI_VERSION = "0.0.0";

function readCliVersion(): string {
  try {
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8")
    ) as { version?: unknown };

    if (
      typeof packageJson.version === "string" &&
      packageJson.version.length > 0
    ) {
      return packageJson.version;
    }
  } catch {
    // Fall through to default
  }

  return DEFAULT_CLI_VERSION;
}

async function main(): Promise<void> {
  const cli = createProgram();
  await cli.parse();
}

main();
