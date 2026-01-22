/**
 * Command builder for creating typed CLI commands.
 *
 * @packageDocumentation
 */

import type { CommandBuilder } from "./types.js";

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
export function command(_name: string): CommandBuilder {
	throw new Error("command not implemented");
}
