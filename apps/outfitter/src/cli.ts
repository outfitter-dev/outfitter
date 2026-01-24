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

import { Command } from "commander";
import { initCommand } from "./commands/init";
import { doctorCommand } from "./commands/doctor";

// =============================================================================
// CLI Setup
// =============================================================================

/**
 * Creates and configures the CLI program.
 *
 * @returns Configured Commander program
 */
function createProgram(): Command {
	const program = new Command();

	program
		.name("outfitter")
		.description("Outfitter CLI for scaffolding and project management")
		.version("0.1.0");

	// Register commands
	initCommand(program);
	doctorCommand(program);

	return program;
}

// =============================================================================
// Main Entry Point
// =============================================================================

/**
 * Main entry point for the CLI.
 */
async function main(): Promise<void> {
	const program = createProgram();

	try {
		await program.parseAsync(process.argv);
	} catch (error) {
		if (error instanceof Error) {
			// biome-ignore lint/suspicious/noConsole: CLI error output is expected
			console.error(`Error: ${error.message}`);
		} else {
			// biome-ignore lint/suspicious/noConsole: CLI error output is expected
			console.error("An unexpected error occurred");
		}
		process.exit(1);
	}
}

// Run the CLI
main();
