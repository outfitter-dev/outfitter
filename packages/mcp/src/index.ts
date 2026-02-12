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

export type { BuildMcpToolsOptions } from "./actions.js";
// Action adapter
export { buildMcpTools } from "./actions.js";
// Core tools
export {
  type ConfigAction,
  type ConfigStore,
  type ConfigToolInput,
  type ConfigToolOptions,
  type ConfigToolResponse,
  type CoreToolsOptions,
  createCoreTools,
  type DocsSection,
  type DocsToolEntry,
  type DocsToolInput,
  type DocsToolOptions,
  type DocsToolResponse,
  defineConfigTool,
  defineDocsTool,
  defineQueryTool,
  type QueryToolInput,
  type QueryToolOptions,
  type QueryToolResponse,
} from "./core-tools.js";
// Logging
export {
  type McpLogLevel,
  mapLogLevelToMcp,
  shouldEmitLog,
} from "./logging.js";
// Schema utilities
export { type JsonSchema, zodToJsonSchema } from "./schema.js";
// Server
export {
  createMcpServer,
  definePrompt,
  defineResource,
  defineResourceTemplate,
  defineTool,
} from "./server.js";
// Transport helpers
export {
  connectStdio,
  createSdkServer,
  type McpToolResponse,
  wrapToolError,
  wrapToolResult,
} from "./transport.js";
// Types
export {
  adaptHandler,
  type BlobResourceContent,
  type CompletionHandler,
  type CompletionRef,
  type CompletionResult,
  type ContentAnnotations,
  type InvokeToolOptions,
  McpError,
  type McpHandlerContext,
  type McpServer,
  type McpServerOptions,
  type ProgressReporter,
  type PromptArgument,
  type PromptDefinition,
  type PromptHandler,
  type PromptMessage,
  type PromptMessageContent,
  type PromptResult,
  type ResourceContent,
  type ResourceDefinition,
  type ResourceReadHandler,
  type ResourceTemplateDefinition,
  type ResourceTemplateReadHandler,
  type SerializedTool,
  type TextResourceContent,
  TOOL_ANNOTATIONS,
  type ToolAnnotations,
  type ToolDefinition,
} from "./types.js";
