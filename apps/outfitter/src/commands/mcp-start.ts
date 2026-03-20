/**
 * `outfitter mcp start` - Start MCP server with stdio transport.
 *
 * Creates an MCP server, registers tools for docs and schema introspection,
 * and connects via stdio. The server runs indefinitely until the parent
 * process closes stdin.
 *
 * @packageDocumentation
 */

import { Result } from "@outfitter/contracts";
import type { InternalError } from "@outfitter/contracts";
import {
  createMcpServer,
  connectStdio,
  defineTool,
  type McpServer,
} from "@outfitter/mcp";
import { Command } from "commander";
import { z } from "zod";

import { outfitterActions } from "../actions.js";
import type { DocsIndexOutput } from "./docs-index.js";
import type { DocsListOutput } from "./docs-list.js";
import type { DocsSearchOutput } from "./docs-search.js";

// ---------------------------------------------------------------------------
// Tool count constant (for testing)
// ---------------------------------------------------------------------------

/** Number of tools registered by the MCP server. */
export const MCP_TOOL_COUNT = 6;

// ---------------------------------------------------------------------------
// Tool registration
// ---------------------------------------------------------------------------

/**
 * Register all MCP tools on the server.
 *
 * Manually registers tools for docs and schema introspection. Each tool
 * calls the corresponding handler function from the command modules.
 *
 * @param server - The MCP server to register tools on
 */
export function registerMcpTools(server: McpServer): void {
  // -- search_docs ----------------------------------------------------------
  server.registerTool(
    defineTool({
      name: "search_docs",
      description:
        "Search documentation using hybrid BM25 keyword + vector similarity search",
      inputSchema: z.object({
        query: z.string().describe("Search query string"),
        limit: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Maximum number of results to return"),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input, ctx) => {
        const { runDocsSearch } = await import("./docs-search.js");
        return (await runDocsSearch({
          query: input.query,
          limit: input.limit,
          cwd: ctx.cwd,
          outputMode: "json",
        })) as Result<DocsSearchOutput, InternalError>;
      },
    })
  );

  // -- get_doc --------------------------------------------------------------
  server.registerTool(
    defineTool({
      name: "get_doc",
      description:
        "Get a specific documentation entry by ID, including its full content",
      inputSchema: z.object({
        id: z.string().describe("Documentation entry ID"),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input, ctx) => {
        const { runDocsShow } = await import("./docs-show.js");
        return await runDocsShow({
          id: input.id,
          cwd: ctx.cwd,
          outputMode: "json",
        });
      },
    })
  );

  // -- list_docs ------------------------------------------------------------
  server.registerTool(
    defineTool({
      name: "list_docs",
      description:
        "List documentation entries, optionally filtered by package or kind",
      inputSchema: z.object({
        package: z
          .string()
          .optional()
          .describe("Filter entries by package name"),
        kind: z.string().optional().describe("Filter entries by doc kind"),
      }),
      annotations: { readOnlyHint: true },
      handler: async (input, ctx) => {
        const { runDocsList } = await import("./docs-list.js");
        return (await runDocsList({
          package: input.package,
          kind: input.kind,
          cwd: ctx.cwd,
          outputMode: "json",
        })) as Result<DocsListOutput, InternalError>;
      },
    })
  );

  // -- index_docs -----------------------------------------------------------
  server.registerTool(
    defineTool({
      name: "index_docs",
      description:
        "Assemble documentation and build the search index for hybrid search",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: false },
      handler: async (_input, ctx) => {
        const { runDocsIndex } = await import("./docs-index.js");
        return (await runDocsIndex({
          cwd: ctx.cwd,
          outputMode: "json",
        })) as Result<DocsIndexOutput, InternalError>;
      },
    })
  );

  // -- list_actions ---------------------------------------------------------
  server.registerTool(
    defineTool({
      name: "list_actions",
      description:
        "List all registered actions in the Outfitter CLI, optionally filtered by surface",
      inputSchema: z.object({
        surface: z
          .enum(["cli", "mcp", "api", "server"])
          .optional()
          .describe("Filter actions by surface"),
      }),
      annotations: { readOnlyHint: true },
      // oxlint-disable-next-line require-await, typescript/require-await -- handler contract requires async
      handler: async (input) => {
        const actions = input.surface
          ? outfitterActions.forSurface(input.surface)
          : outfitterActions.list();

        const entries = actions.map((action) => ({
          id: action.id,
          description: action.description,
          surfaces: action.surfaces ?? ["cli", "mcp", "api", "server"],
        }));

        return Result.ok({ actions: entries, total: entries.length });
      },
    })
  );

  // -- get_action -----------------------------------------------------------
  server.registerTool(
    defineTool({
      name: "get_action",
      description:
        "Get detailed information about a specific action by ID, including its input/output schemas",
      inputSchema: z.object({
        id: z.string().describe("Action ID (e.g. 'docs.search')"),
      }),
      annotations: { readOnlyHint: true },
      // oxlint-disable-next-line require-await, typescript/require-await -- handler contract requires async
      handler: async (input) => {
        const action = outfitterActions.get(input.id);

        if (!action) {
          const { NotFoundError } = await import("@outfitter/contracts");
          return Result.err(
            NotFoundError.create("action", input.id, {
              availableIds: outfitterActions
                .list()
                .map((a) => a.id)
                .slice(0, 10),
            })
          );
        }

        return Result.ok({
          id: action.id,
          description: action.description,
          surfaces: action.surfaces ?? ["cli", "mcp", "api", "server"],
          cli: action.cli
            ? {
                group: action.cli.group,
                command: action.cli.command,
              }
            : undefined,
          mcp: action.mcp
            ? {
                tool: action.mcp.tool,
                readOnly: action.mcp.readOnly,
              }
            : undefined,
        });
      },
    })
  );
}

// ---------------------------------------------------------------------------
// Server startup
// ---------------------------------------------------------------------------

/**
 * Start the MCP server with stdio transport.
 *
 * Creates the server, registers all tools, and connects via stdio.
 * The server runs indefinitely until the parent process closes stdin.
 */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer({
    name: "outfitter",
    version: "0.1.0",
  });

  registerMcpTools(server);

  await connectStdio(server);
}

// ---------------------------------------------------------------------------
// CLI command
// ---------------------------------------------------------------------------

/**
 * Create the `outfitter mcp` command group with `start` subcommand.
 *
 * @returns Commander command for the `mcp` group
 */
export function createMcpCommand(): Command {
  const mcpCommand = new Command("mcp").description("MCP server management");

  mcpCommand
    .command("start")
    .description("Start MCP server (stdio transport)")
    .action(async () => {
      await startMcpServer();
    });

  return mcpCommand;
}
