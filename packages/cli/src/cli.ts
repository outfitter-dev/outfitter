/**
 * CLI factory for creating typed Commander.js instances.
 *
 * @packageDocumentation
 */

import type { CLI, CLIConfig } from "./types.js";

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
export function createCLI(_config: CLIConfig): CLI {
	throw new Error("createCLI not implemented");
}
