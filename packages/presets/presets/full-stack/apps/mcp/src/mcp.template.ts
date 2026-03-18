import { createMcpServer, defineTool } from "@outfitter/mcp";
import { greetAction, greetingInputSchema } from "{{packageName}}-core";

const server = createMcpServer({
  name: "{{projectName}}-mcp",
  version: "{{version}}",
});

// Wire MCP tools from action definitions
const greetTool = defineTool({
  name: greetAction.mcp?.tool ?? greetAction.id,
  description: greetAction.mcp?.description ?? greetAction.description ?? "",
  inputSchema: greetingInputSchema,
  annotations: greetAction.mcp?.readOnly ? { readOnlyHint: true } : {},
  handler: async (input, ctx) => greetAction.handler(input, ctx),
});

server.registerTool(greetTool);

export { server };
