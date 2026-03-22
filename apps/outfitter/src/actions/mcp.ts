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

import type { DocsIndexOutput } from "../commands/docs-index.js";
import { runDocsIndex } from "../commands/docs-index.js";
import type { DocsListEntry, DocsListOutput } from "../commands/docs-list.js";
import { runDocsList } from "../commands/docs-list.js";
import type {
  DocsSearchMatch,
  DocsSearchOutput,
} from "../commands/docs-search.js";
import { runDocsSearch } from "../commands/docs-search.js";
import type { DocsShowOutput } from "../commands/docs-show.js";
import { runDocsShow } from "../commands/docs-show.js";

// ---------------------------------------------------------------------------
// Input types — MCP tools omit CLI-specific fields (outputMode, jq)
// ---------------------------------------------------------------------------

/** Input for the MCP index_docs tool. */
interface McpDocsIndexInput {
  readonly cwd: string;
  readonly indexPath?: string | undefined;
}

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
  readonly indexPath?: string | undefined;
  readonly limit?: number | undefined;
  readonly query: string;
}

// ---------------------------------------------------------------------------
// Action types
// ---------------------------------------------------------------------------

type McpDocsIndexAction = ReturnType<
  typeof defineAction<McpDocsIndexInput, DocsIndexOutput>
>;
type McpDocsListAction = ReturnType<
  typeof defineAction<McpDocsListInput, DocsListOutput>
>;
type McpDocsShowAction = ReturnType<
  typeof defineAction<McpDocsShowInput, DocsShowOutput>
>;
type McpDocsSearchAction = ReturnType<
  typeof defineAction<McpDocsSearchInput, DocsSearchOutput>
>;

const docsIndexOutputSchema: z.ZodType<DocsIndexOutput> = z.object({
  failed: z.number(),
  indexed: z.number(),
  indexPath: z.string(),
  removed: z.number(),
  skipped: z.number(),
  total: z.number(),
});

const docsListEntryOutputSchema: z.ZodType<DocsListEntry> = z
  .object({
    id: z.string(),
    kind: z.string(),
    outputPath: z.string(),
    package: z.string().optional(),
    sourcePath: z.string(),
    title: z.string(),
  })
  .transform((entry) => ({
    id: entry.id,
    kind: entry.kind,
    outputPath: entry.outputPath,
    sourcePath: entry.sourcePath,
    title: entry.title,
    ...(entry.package !== undefined ? { package: entry.package } : {}),
  }));

const docsListOutputSchema: z.ZodType<DocsListOutput> = z.object({
  entries: z.array(docsListEntryOutputSchema),
  total: z.number(),
});

const docsShowEntryOutputSchema: z.ZodType<DocsShowOutput["entry"]> = z
  .object({
    id: z.string(),
    kind: z.string(),
    outputPath: z.string(),
    package: z.string().optional(),
    sourcePath: z.string(),
    tags: z.array(z.string()),
    title: z.string(),
  })
  .transform((entry) => ({
    id: entry.id,
    kind: entry.kind,
    outputPath: entry.outputPath,
    sourcePath: entry.sourcePath,
    tags: entry.tags,
    title: entry.title,
    ...(entry.package !== undefined ? { package: entry.package } : {}),
  }));

const docsShowOutputSchema: z.ZodType<DocsShowOutput> = z.object({
  content: z.string(),
  entry: docsShowEntryOutputSchema,
});

const docsSearchMatchOutputSchema: z.ZodType<DocsSearchMatch> = z
  .object({
    id: z.string(),
    kind: z.string(),
    matchLines: z.array(z.string()),
    outputPath: z.string(),
    package: z.string().optional(),
    sourcePath: z.string(),
    title: z.string(),
  })
  .transform((match) => ({
    id: match.id,
    kind: match.kind,
    matchLines: match.matchLines,
    outputPath: match.outputPath,
    sourcePath: match.sourcePath,
    title: match.title,
    ...(match.package !== undefined ? { package: match.package } : {}),
  }));

const docsSearchOutputSchema: z.ZodType<DocsSearchOutput> = z.object({
  matches: z.array(docsSearchMatchOutputSchema),
  query: z.string(),
  total: z.number(),
});

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Build documentation search index, exposed as the `index_docs` MCP tool. */
export const mcpDocsIndexAction: McpDocsIndexAction = defineAction({
  id: "mcp.docs.index",
  description: "Build search index for documentation",
  surfaces: ["mcp"],
  input: z.object({
    cwd: z.string().describe("Workspace root to index"),
    indexPath: z
      .string()
      .optional()
      .describe("Optional path to a custom SQLite docs index"),
  }),
  output: docsIndexOutputSchema,
  mcp: {
    tool: "index_docs",
    description: "Build search index for documentation",
    idempotent: true,
  },
  handler: async (input) => {
    return runDocsIndex({ ...input, outputMode: "json" });
  },
});

/** List documentation entries, exposed as the `list_docs` MCP tool. */
export const mcpDocsListAction: McpDocsListAction = defineAction({
  id: "mcp.docs.list",
  description: "List documentation entries from the docs map",
  surfaces: ["mcp"],
  input: z.object({
    cwd: z.string().default(".").describe("Workspace root containing docs"),
    kind: z.string().optional().describe("Optional docs-map kind filter"),
    package: z.string().optional().describe("Optional package-name filter"),
  }),
  output: docsListOutputSchema,
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
    cwd: z.string().default(".").describe("Workspace root containing docs"),
    id: z.string().describe("Documentation entry identifier"),
  }),
  output: docsShowOutputSchema,
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
  description: "Search documentation content using FTS5 BM25-ranked search",
  surfaces: ["mcp"],
  input: z.object({
    cwd: z.string().default(".").describe("Workspace root containing docs"),
    indexPath: z
      .string()
      .optional()
      .describe("Optional path to a custom SQLite docs index"),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum number of matches to return"),
    query: z.string().describe("Full-text query to search for"),
  }),
  output: docsSearchOutputSchema,
  mcp: {
    tool: "search_docs",
    description: "Search documentation content using FTS5 BM25-ranked search",
    readOnly: true,
  },
  handler: async (input) => {
    return runDocsSearch({ ...input, outputMode: "json" });
  },
});
