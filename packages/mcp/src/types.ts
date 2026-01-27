/**
 * @outfitter/mcp - Type Definitions
 *
 * Core types for building MCP (Model Context Protocol) servers with typed tools.
 *
 * @packageDocumentation
 */

import {
  type Handler,
  type HandlerContext,
  type Logger,
  type OutfitterError,
  type Result,
  type TaggedErrorClass,
  TaggedError as TaggedErrorImpl,
} from "@outfitter/contracts";
import type { z } from "zod";

// Re-export types for convenience
export type { Result } from "@outfitter/contracts";
// biome-ignore lint/performance/noBarrelFile: intentional re-export for API surface
export { TaggedError } from "@outfitter/contracts";

// Internal alias for use in this file
const TaggedError = TaggedErrorImpl;

// ============================================================================
// Server Options
// ============================================================================

/**
 * Configuration options for creating an MCP server.
 *
 * @example
 * ```typescript
 * const options: McpServerOptions = {
 *   name: "my-mcp-server",
 *   version: "1.0.0",
 *   logger: createLogger({ name: "mcp" }),
 * };
 *
 * const server = createMcpServer(options);
 * ```
 */
export interface McpServerOptions {
  /**
   * Server name, used in MCP protocol handshake.
   * Should be a short, descriptive identifier.
   */
  name: string;

  /**
   * Server version (semver format recommended).
   * Sent to clients during initialization.
   */
  version: string;

  /**
   * Optional logger instance for server logging.
   * If not provided, a no-op logger is used.
   */
  logger?: Logger;
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Definition of an MCP tool that can be invoked by clients.
 *
 * Tools are the primary way clients interact with MCP servers.
 * Each tool has a name, description, input schema (for validation),
 * and a handler function that processes requests.
 *
 * @typeParam TInput - The validated input type (inferred from Zod schema)
 * @typeParam TOutput - The success output type
 * @typeParam TError - The error type (must extend OutfitterError)
 *
 * @example
 * ```typescript
 * const getUserTool: ToolDefinition<
 *   { userId: string },
 *   { name: string; email: string },
 *   NotFoundError
 * > = {
 *   name: "get-user",
 *   description: "Retrieve a user by ID",
 *   inputSchema: z.object({ userId: z.string().uuid() }),
 *   handler: async (input, ctx) => {
 *     ctx.logger.debug("Fetching user", { userId: input.userId });
 *     const user = await db.users.find(input.userId);
 *     if (!user) {
 *       return Result.err(new NotFoundError({
 *         message: `User ${input.userId} not found`,
 *         resourceType: "user",
 *         resourceId: input.userId,
 *       }));
 *     }
 *     return Result.ok({ name: user.name, email: user.email });
 *   },
 * };
 * ```
 */
export interface ToolDefinition<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
> {
  /**
   * Unique tool name (kebab-case recommended).
   * Used by clients to invoke the tool.
   */
  name: string;

  /**
   * Human-readable description of what the tool does.
   * Shown to clients and used by LLMs to understand tool capabilities.
   */
  description: string;

  /**
   * Whether the tool should be deferred for tool search.
   * Defaults to true for domain tools; core tools set this to false.
   */
  deferLoading?: boolean;

  /**
   * Zod schema for validating and parsing input.
   * The schema defines the expected input structure.
   */
  inputSchema: z.ZodType<TInput>;

  /**
   * Handler function that processes the tool invocation.
   * Receives validated input and HandlerContext, returns Result.
   */
  handler: Handler<TInput, TOutput, TError>;
}

/**
 * Serialized tool information for MCP protocol.
 * This is the format sent to clients during tool listing.
 */
export interface SerializedTool {
  /** Tool name */
  name: string;

  /** Tool description */
  description: string;

  /** JSON Schema representation of the input schema */
  inputSchema: Record<string, unknown>;

  /** MCP tool-search hint: whether tool is deferred */
  defer_loading?: boolean;
}

// ============================================================================
// Resource Definition
// ============================================================================

/**
 * Definition of an MCP resource that can be read by clients.
 *
 * Resources represent data that clients can access, such as files,
 * database records, or API responses.
 *
 * @example
 * ```typescript
 * const configResource: ResourceDefinition = {
 *   uri: "file:///etc/app/config.json",
 *   name: "Application Config",
 *   description: "Main application configuration file",
 *   mimeType: "application/json",
 * };
 * ```
 */
export interface ResourceDefinition {
  /**
   * Unique resource URI.
   * Must be a valid URI (file://, https://, custom://, etc.).
   */
  uri: string;

  /**
   * Human-readable resource name.
   * Displayed to users in resource listings.
   */
  name: string;

  /**
   * Optional description of the resource.
   * Provides additional context about the resource contents.
   */
  description?: string;

  /**
   * Optional MIME type of the resource content.
   * Helps clients understand how to process the resource.
   */
  mimeType?: string;
}

// ============================================================================
// MCP Error
// ============================================================================

const McpErrorBase: TaggedErrorClass<
  "McpError",
  {
    message: string;
    code: number;
    context?: Record<string, unknown>;
  }
> = TaggedError("McpError")<{
  message: string;
  code: number;
  context?: Record<string, unknown>;
}>();

/**
 * MCP-specific error with JSON-RPC error code.
 *
 * Used when tool invocations fail or when there are protocol-level errors.
 * Follows the JSON-RPC 2.0 error object format.
 *
 * Standard error codes:
 * - `-32700`: Parse error
 * - `-32600`: Invalid request
 * - `-32601`: Method not found
 * - `-32602`: Invalid params
 * - `-32603`: Internal error
 * - `-32000` to `-32099`: Server errors (reserved)
 *
 * @example
 * ```typescript
 * const error = new McpError({
 *   message: "Tool not found: unknown-tool",
 *   code: -32601,
 *   context: { tool: "unknown-tool" },
 * });
 * ```
 */
export class McpError extends McpErrorBase {
  /** Error category for Outfitter error taxonomy compatibility */
  readonly category = "internal" as const;
}

// ============================================================================
// MCP Server Interface
// ============================================================================

/**
 * Options for invoking a tool.
 */
export interface InvokeToolOptions {
  /** Abort signal for cancellation */
  signal?: AbortSignal;

  /** Custom request ID (auto-generated if not provided) */
  requestId?: string;
}

/**
 * MCP Server instance.
 *
 * Provides methods for registering tools and resources, and for
 * starting/stopping the server.
 *
 * @example
 * ```typescript
 * const server = createMcpServer({
 *   name: "my-server",
 *   version: "1.0.0",
 * });
 *
 * server.registerTool(myTool);
 * server.registerResource(myResource);
 *
 * await server.start();
 * ```
 */
export interface McpServer {
  /** Server name */
  readonly name: string;

  /** Server version */
  readonly version: string;

  /**
   * Register a tool with the server.
   * @param tool - Tool definition to register
   */
  registerTool<TInput, TOutput, TError extends OutfitterError>(
    tool: ToolDefinition<TInput, TOutput, TError>
  ): void;

  /**
   * Register a resource with the server.
   * @param resource - Resource definition to register
   */
  registerResource(resource: ResourceDefinition): void;

  /**
   * Get all registered tools.
   * @returns Array of serialized tool information
   */
  getTools(): SerializedTool[];

  /**
   * Get all registered resources.
   * @returns Array of resource definitions
   */
  getResources(): ResourceDefinition[];

  /**
   * Invoke a tool by name.
   * @param name - Tool name
   * @param input - Tool input (will be validated)
   * @param options - Optional invocation options
   * @returns Result with tool output or McpError
   */
  invokeTool<T = unknown>(
    name: string,
    input: unknown,
    options?: InvokeToolOptions
  ): Promise<Result<T, InstanceType<typeof McpError>>>;

  /**
   * Start the MCP server.
   * Begins listening for client connections.
   */
  start(): Promise<void>;

  /**
   * Stop the MCP server.
   * Closes all connections and cleans up resources.
   */
  stop(): Promise<void>;
}

// ============================================================================
// Handler Context Extension
// ============================================================================

/**
 * Extended handler context for MCP tools.
 * Includes MCP-specific information in addition to standard HandlerContext.
 */
export interface McpHandlerContext extends HandlerContext {
  /** The name of the tool being invoked */
  toolName?: string;
}
