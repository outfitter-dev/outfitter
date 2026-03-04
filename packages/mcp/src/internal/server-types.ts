/**
 * Server-related type definitions for MCP servers.
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

import type {
  CompletionRef,
  CompletionResult,
  PromptArgument,
  PromptDefinition,
  PromptResult,
} from "./prompt-types.js";
import type {
  ResourceContent,
  ResourceDefinition,
  ResourceTemplateDefinition,
} from "./resource-types.js";
import type { SerializedTool, ToolDefinition } from "./tool-types.js";

// Re-export types for convenience
export type { Result } from "@outfitter/contracts";
// eslint-disable-next-line oxc/no-barrel-file -- intentional re-export for API surface
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
   * Default MCP log level for client-facing log forwarding.
   *
   * Precedence (highest wins):
   * 1. `OUTFITTER_LOG_LEVEL` environment variable
   * 2. This option
   * 3. Environment profile (`OUTFITTER_ENV`)
   * 4. `null` (no forwarding until client opts in)
   *
   * Set to `null` to explicitly disable forwarding regardless of environment.
   * The MCP client can always override via `logging/setLevel`.
   */
  defaultLogLevel?: import("../logging.js").McpLogLevel | null;

  /**
   * Optional logger instance for server logging.
   * If not provided, the server uses the Outfitter logger factory defaults.
   */
  logger?: Logger;
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
// Invoke Tool Options
// ============================================================================

/**
 * Options for invoking a tool.
 */
export interface InvokeToolOptions {
  /** Progress token from client for tracking progress */
  progressToken?: string | number;

  /** Custom request ID (auto-generated if not provided) */
  requestId?: string;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

// ============================================================================
// MCP Server Interface
// ============================================================================

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
  /**
   * Bind the SDK server instance for notifications.
   * Called internally by the transport layer.
   * @param sdkServer - The MCP SDK Server instance
   */
  // eslint-disable-next-line typescript/no-explicit-any -- SDK Server type
  bindSdkServer?(sdkServer: any): void;

  /**
   * Complete an argument value.
   * @param ref - Reference to the prompt or resource template
   * @param argumentName - Name of the argument to complete
   * @param value - Current value to complete
   * @returns Result with completion values or McpError
   */
  complete(
    ref: CompletionRef,
    argumentName: string,
    value: string
  ): Promise<Result<CompletionResult, InstanceType<typeof McpError>>>;

  /**
   * Get a specific prompt's messages.
   * @param name - Prompt name
   * @param args - Prompt arguments
   * @returns Result with prompt result or McpError
   */
  getPrompt(
    name: string,
    args: Record<string, string | undefined>
  ): Promise<Result<PromptResult, InstanceType<typeof McpError>>>;

  /**
   * Get all registered prompts.
   * @returns Array of prompt definitions (without handlers)
   */
  getPrompts(): Array<{
    name: string;
    description?: string;
    arguments: PromptArgument[];
  }>;

  /**
   * Get all registered resources.
   * @returns Array of resource definitions
   */
  getResources(): ResourceDefinition[];

  /**
   * Get all registered resource templates.
   * @returns Array of resource template definitions
   */
  getResourceTemplates(): ResourceTemplateDefinition[];

  /**
   * Get all registered tools.
   * @returns Array of serialized tool information
   */
  getTools(): SerializedTool[];

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
  /** Server name */
  readonly name: string;

  /**
   * Notify connected clients that the prompt list has changed.
   */
  notifyPromptsChanged(): void;

  /**
   * Notify connected clients that the resource list has changed.
   */
  notifyResourcesChanged(): void;

  /**
   * Notify connected clients that a specific resource has been updated.
   * Only emits for subscribed URIs.
   * @param uri - URI of the updated resource
   */
  notifyResourceUpdated(uri: string): void;

  /**
   * Notify connected clients that the tool list has changed.
   */
  notifyToolsChanged(): void;

  /**
   * Read a resource by URI.
   * @param uri - Resource URI
   * @returns Result with resource content or McpError
   */
  readResource(
    uri: string
  ): Promise<Result<ResourceContent[], InstanceType<typeof McpError>>>;

  /**
   * Register a prompt with the server.
   * @param prompt - Prompt definition to register
   */
  registerPrompt(prompt: PromptDefinition): void;

  /**
   * Register a resource with the server.
   * @param resource - Resource definition to register
   */
  registerResource(resource: ResourceDefinition): void;

  /**
   * Register a resource template with the server.
   * @param template - Resource template definition to register
   */
  registerResourceTemplate(template: ResourceTemplateDefinition): void;

  /**
   * Register a tool with the server.
   * @param tool - Tool definition to register
   */
  registerTool<TInput, TOutput, TError extends OutfitterError>(
    tool: ToolDefinition<TInput, TOutput, TError>
  ): void;

  /**
   * Send a log message to connected clients.
   * Filters by the client-requested log level threshold.
   * No-op if no SDK server is bound or if the message is below the threshold.
   *
   * @param level - MCP log level for the message
   * @param data - Log data (string, object, or any serializable value)
   * @param loggerName - Optional logger name for client-side filtering
   */
  sendLogMessage(
    level: import("../logging.js").McpLogLevel,
    data: unknown,
    loggerName?: string
  ): void;

  /**
   * Set the client-requested log level.
   * Only log messages at or above this level will be forwarded.
   * @param level - MCP log level string
   */
  setLogLevel?(level: string): void;

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

  /**
   * Subscribe to updates for a resource URI.
   * @param uri - Resource URI to subscribe to
   */
  subscribe(uri: string): void;

  /**
   * Unsubscribe from updates for a resource URI.
   * @param uri - Resource URI to unsubscribe from
   */
  unsubscribe(uri: string): void;

  /** Server version */
  readonly version: string;
}

// ============================================================================
// Handler Context Extension
// ============================================================================

type HandlerProgress = HandlerContext extends { progress?: infer P }
  ? P
  : never;

type LegacyProgressReporter = {
  report(progress: number, total?: number, message?: string): void;
};

/**
 * Backward-compatible progress reporter type.
 *
 * - When `HandlerContext.progress` exists (streaming branches), this becomes
 *   `ProgressCallback & { report(...) }`.
 * - When it does not exist (older branches), this falls back to
 *   `{ report(...) }`.
 */
export type ProgressReporter = [HandlerProgress] extends [never]
  ? LegacyProgressReporter
  : NonNullable<HandlerProgress> & LegacyProgressReporter;

/**
 * Extended handler context for MCP tools.
 * Includes MCP-specific information in addition to standard HandlerContext.
 */
export interface McpHandlerContext extends Omit<HandlerContext, "progress"> {
  /** Progress reporter, present when client provides a progressToken */
  progress?: ProgressReporter;
  /** The name of the tool being invoked */
  toolName?: string;
}

// ============================================================================
// Handler Adapter
// ============================================================================

/**
 * Adapt a handler with a domain error type for use with MCP tools.
 *
 * MCP tool definitions constrain `TError extends OutfitterError`. When your
 * handler returns domain-specific errors that extend `Error` but not
 * `OutfitterError`, use this function instead of an unsafe cast:
 *
 * ```typescript
 * import { adaptHandler } from "@outfitter/mcp";
 *
 * const tool = defineTool({
 *   name: "my-tool",
 *   inputSchema: z.object({ id: z.string() }),
 *   handler: adaptHandler(myDomainHandler),
 * });
 * ```
 */
export function adaptHandler<TInput, TOutput, TError extends Error>(
  handler: (
    input: TInput,
    ctx: HandlerContext
  ) => Promise<Result<TOutput, TError>>
): Handler<TInput, TOutput, OutfitterError> {
  return handler as unknown as Handler<TInput, TOutput, OutfitterError>;
}
