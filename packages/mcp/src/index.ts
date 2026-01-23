/**
 * @outfitter/mcp
 *
 * MCP (Model Context Protocol) server framework with typed tools.
 * Provides a transport-agnostic wrapper around @modelcontextprotocol/sdk
 * with Result-based error handling and Zod schema validation.
 *
 * @packageDocumentation
 *
 * @example
 * ```typescript
 * import { createMcpServer, defineTool } from "@outfitter/mcp";
 * import { Result } from "@outfitter/contracts";
 * import { z } from "zod";
 *
 * const server = createMcpServer({
 *   name: "my-mcp-server",
 *   version: "1.0.0",
 * });
 *
 * server.registerTool(defineTool({
 *   name: "greet",
 *   description: "Greet a person by name",
 *   inputSchema: z.object({ name: z.string() }),
 *   handler: async (input, ctx) => {
 *     ctx.logger.info("Greeting user", { name: input.name });
 *     return Result.ok({ greeting: `Hello, ${input.name}!` });
 *   },
 * }));
 *
 * await server.start();
 * ```
 */

// Types
export {
	type McpServerOptions,
	type ToolDefinition,
	type ResourceDefinition,
	type SerializedTool,
	type McpServer,
	type InvokeToolOptions,
	type McpHandlerContext,
	McpError,
} from "./types.js";

// Server
export { createMcpServer, defineTool, defineResource } from "./server.js";

// Schema utilities
export { type JsonSchema, zodToJsonSchema } from "./schema.js";
