/**
 * @outfitter/mcp - Type Definitions
 *
 * Core types for building MCP (Model Context Protocol) servers with typed tools.
 *
 * @packageDocumentation
 */

// eslint-disable-next-line oxc/no-barrel-file -- intentional barrel for public API surface

// === Prompt types ===
export type {
  CompletionHandler,
  CompletionRef,
  CompletionResult,
  PromptArgument,
  PromptDefinition,
  PromptHandler,
  PromptMessage,
  PromptMessageContent,
  PromptResult,
} from "./internal/prompt-types.js";

// === Resource types ===
export type {
  BlobResourceContent,
  ContentAnnotations,
  ResourceContent,
  ResourceDefinition,
  ResourceReadHandler,
  ResourceTemplateDefinition,
  ResourceTemplateReadHandler,
  TextResourceContent,
  TypedResourceTemplateDefinition,
  TypedResourceTemplateReadHandler,
} from "./internal/resource-types.js";

// === Server types (includes runtime values) ===
export {
  adaptHandler,
  McpError,
  TaggedError,
} from "./internal/server-types.js";
export type {
  InvokeToolOptions,
  McpHandlerContext,
  McpServer,
  McpServerOptions,
  ProgressReporter,
  Result,
} from "./internal/server-types.js";

// === Tool types (includes runtime value) ===
export { TOOL_ANNOTATIONS } from "./internal/tool-types.js";
export type {
  SerializedTool,
  ToolAnnotations,
  ToolDefinition,
} from "./internal/tool-types.js";
