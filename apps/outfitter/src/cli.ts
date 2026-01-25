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

import { buildCliCommands, createCLI } from "@outfitter/cli";
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
	const cli = createCLI({
		name: "outfitter",
		version: "0.1.0",
		description: "Outfitter CLI for scaffolding and project management",
		onError: (error) => {
			if (error instanceof Error) {
				// biome-ignore lint/suspicious/noConsole: CLI error output is expected
				console.error(`Error: ${error.message}`);
			} else {
				// biome-ignore lint/suspicious/noConsole: CLI error output is expected
				console.error("An unexpected error occurred");
			}
		},
		onExit: (code) => process.exit(code),
	});

	for (const command of buildCliCommands(outfitterActions)) {
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
