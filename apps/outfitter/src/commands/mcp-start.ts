/**
 * `outfitter mcp start` - Start MCP server with stdio transport.
 *
 * Creates an MCP server, registers tools for docs and schema introspection,
 * and connects via stdio.
 *
 * @packageDocumentation
 */

import { command, commandGroup } from "@outfitter/cli/command";
import { buildMcpTools, connectStdio, createMcpServer } from "@outfitter/mcp";
import type { Command } from "commander";

import { outfitterActions } from "../actions.js";
import { VERSION } from "../version.js";

/**
 * Start the Outfitter MCP server over stdio.
 *
 * Creates an MCP server, registers all mcp-surface actions as tools,
 * and connects via stdio transport.
 */
export async function startMcpServer(): Promise<void> {
  try {
    const server = createMcpServer({
      name: "outfitter",
      version: VERSION,
    });

    const tools = buildMcpTools(outfitterActions);
    for (const tool of tools) {
      server.registerTool(tool);
    }

    await connectStdio(server);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to start MCP server";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}

/**
 * Create the `outfitter mcp` command group with `start` subcommand.
 *
 * @returns Commander Command for the mcp namespace
 */
export function createMcpCommand(): Command {
  return commandGroup("mcp", "MCP server for docs and schema introspection", [
    command("start")
      .description("Start MCP server with stdio transport")
      .readOnly(true)
      .action(async () => {
        await startMcpServer();
      }),
  ]);
}
