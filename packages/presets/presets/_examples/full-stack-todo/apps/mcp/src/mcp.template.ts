/**
 * {{projectName}} MCP server definition
 *
 * Wires MCP tools from the shared action registry.
 * Each tool delegates to the same core handler used by the CLI.
 */

import { createMcpServer, defineTool } from "@outfitter/mcp";
import {
  addAction,
  listAction,
  completeAction,
  deleteAction,
  addTodoInputSchema,
  listTodosInputSchema,
  completeTodoInputSchema,
  deleteTodoInputSchema,
} from "{{packageName}}-core";

const server = createMcpServer({
  name: "{{projectName}}-mcp",
  version: "{{version}}",
});

// =============================================================================
// Tools
// =============================================================================

const addTool = defineTool({
  name: addAction.mcp?.tool ?? addAction.id,
  description: addAction.mcp?.description ?? addAction.description ?? "",
  inputSchema: addTodoInputSchema,
  handler: async (input, ctx) => addAction.handler(input, ctx),
});

const listTool = defineTool({
  name: listAction.mcp?.tool ?? listAction.id,
  description: listAction.mcp?.description ?? listAction.description ?? "",
  inputSchema: listTodosInputSchema,
  annotations: listAction.mcp?.readOnly ? { readOnlyHint: true } : {},
  handler: async (input, ctx) => listAction.handler(input, ctx),
});

const completeTool = defineTool({
  name: completeAction.mcp?.tool ?? completeAction.id,
  description:
    completeAction.mcp?.description ?? completeAction.description ?? "",
  inputSchema: completeTodoInputSchema,
  handler: async (input, ctx) => completeAction.handler(input, ctx),
});

const deleteTool = defineTool({
  name: deleteAction.mcp?.tool ?? deleteAction.id,
  description: deleteAction.mcp?.description ?? deleteAction.description ?? "",
  inputSchema: deleteTodoInputSchema,
  annotations: { destructiveHint: true },
  handler: async (input, ctx) => deleteAction.handler(input, ctx),
});

server.registerTool(addTool);
server.registerTool(listTool);
server.registerTool(completeTool);
server.registerTool(deleteTool);

export { server };
