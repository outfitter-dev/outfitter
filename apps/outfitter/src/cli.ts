#!/usr/bin/env bun
/**
 * Outfitter CLI - Umbrella CLI for scaffolding and project management.
 *
 * The outfitter CLI provides commands for:
 * - Scaffolding new Outfitter projects (`outfitter init`)
 * - Validating project environment (`outfitter doctor`)
 *
 * @packageDocumentation
 */

import { buildCliCommands } from "@outfitter/cli/actions";
import { createCLI } from "@outfitter/cli/command";
import { exitWithError } from "@outfitter/cli/output";
import { createContext, generateRequestId } from "@outfitter/contracts";
import { createLogger } from "@outfitter/logging";
import { outfitterActions } from "./actions.js";

// =============================================================================
// CLI Setup
// =============================================================================

/**
 * Creates and configures the CLI program.
 *
 * @returns Configured Commander program
 */
function createProgram() {
  const logger = createLogger({ name: "outfitter" });
  const cli = createCLI({
    name: "outfitter",
    version: cliVersion,
    description: "Outfitter CLI for scaffolding and project management",
    onError: (error) => {
      const err =
        error instanceof Error
          ? error
          : new Error("An unexpected error occurred");
      exitWithError(err);
    },
    onExit: (code) => process.exit(code),
  });

  for (const command of buildCliCommands(outfitterActions, {
    createContext: ({ action }) => {
      const requestId = generateRequestId();
      return createContext({
        cwd: process.cwd(),
        env: process.env as Record<string, string | undefined>,
        requestId,
        logger: logger.child({ action: action.id, requestId }),
      });
    },
  })) {
    cli.register(command);
  }

  return cli;
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Main entry point for the CLI.
 */
async function main(): Promise<void> {
  const cli = createProgram();
  await cli.parse();
}

// Run the CLI
main();
