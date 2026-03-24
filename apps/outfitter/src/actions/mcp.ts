/**
 * MCP-specific action definitions.
 *
 * These actions wrap the same `run*` handler functions as the CLI docs actions
 * but omit the `print*` calls. This avoids stdout corruption when running
 * over stdio transport where stdout carries the MCP protocol stream.
 *
 * @packageDocumentation
 */

import { defineAction } from "@outfitter/contracts";
import { z } from "zod";

import { runDocsList } from "../commands/docs-list.js";
import { runDocsSearch } from "../commands/docs-search.js";
import { runDocsShow } from "../commands/docs-show.js";

// ---------------------------------------------------------------------------
// Input types — MCP tools omit CLI-specific fields (outputMode, jq)
// ---------------------------------------------------------------------------

/** Input for the MCP list_docs tool. */
interface McpDocsListInput {
  readonly cwd: string;
  readonly kind?: string | undefined;
  readonly package?: string | undefined;
}

/** Input for the MCP get_doc tool. */
interface McpDocsShowInput {
  readonly cwd: string;
  readonly id: string;
}

/** Input for the MCP search_docs tool. */
interface McpDocsSearchInput {
  readonly cwd: string;
  readonly kind?: string | undefined;
  readonly package?: string | undefined;
  readonly query: string;
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

type McpDocsListAction = ReturnType<
  typeof defineAction<McpDocsListInput, unknown>
>;
type McpDocsShowAction = ReturnType<
  typeof defineAction<McpDocsShowInput, unknown>
>;
type McpDocsSearchAction = ReturnType<
  typeof defineAction<McpDocsSearchInput, unknown>
>;

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** List documentation entries, exposed as the `list_docs` MCP tool. */
export const mcpDocsListAction: McpDocsListAction = defineAction({
  id: "mcp.docs.list",
  description: "List documentation entries from the docs map",
  surfaces: ["mcp"],
  input: z.object({
    cwd: z.string().default("."),
    kind: z.string().optional(),
    package: z.string().optional(),
  }),
  mcp: {
    tool: "list_docs",
    description: "List documentation entries from the docs map",
    readOnly: true,
  },
  handler: async (input) => {
    return runDocsList({ ...input, outputMode: "json" });
  },
});

/** Show a documentation entry by ID, exposed as the `get_doc` MCP tool. */
export const mcpDocsShowAction: McpDocsShowAction = defineAction({
  id: "mcp.docs.show",
  description: "Get a specific documentation entry and its content",
  surfaces: ["mcp"],
  input: z.object({
    cwd: z.string().default("."),
    id: z.string(),
  }),
  mcp: {
    tool: "get_doc",
    description: "Get a specific documentation entry and its content",
    readOnly: true,
  },
  handler: async (input) => {
    return runDocsShow({ ...input, outputMode: "json" });
  },
});

/** Search documentation content, exposed as the `search_docs` MCP tool. */
export const mcpDocsSearchAction: McpDocsSearchAction = defineAction({
  id: "mcp.docs.search",
  description: "Search documentation content for a query string",
  surfaces: ["mcp"],
  input: z.object({
    cwd: z.string().default("."),
    kind: z.string().optional(),
    package: z.string().optional(),
    query: z.string(),
  }),
  mcp: {
    tool: "search_docs",
    description: "Search documentation content for a query string",
    readOnly: true,
  },
  handler: async (input) => {
    return runDocsSearch({ ...input, outputMode: "json" });
  },
});
