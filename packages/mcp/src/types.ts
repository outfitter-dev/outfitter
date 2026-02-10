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
   * If not provided, the server uses the Outfitter logger factory defaults.
   */
  logger?: Logger;

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
  defaultLogLevel?: import("./logging.js").McpLogLevel | null;
}

// ============================================================================
// Tool Annotations
// ============================================================================

/**
 * Behavioral hints for MCP tools.
 *
 * Annotations help clients understand tool behavior without invoking them.
 * All fields are optional — only include hints that apply.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/tools/#annotations
 */
export interface ToolAnnotations {
  /** When true, the tool does not modify any state. */
  readOnlyHint?: boolean;

  /** When true, the tool may perform destructive operations (e.g., deleting data). */
  destructiveHint?: boolean;

  /** When true, calling the tool multiple times with the same input has the same effect. */
  idempotentHint?: boolean;

  /** When true, the tool may interact with external systems beyond the server. */
  openWorldHint?: boolean;
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
   * Optional behavioral annotations for the tool.
   * Helps clients understand tool behavior without invoking it.
   */
  annotations?: ToolAnnotations;

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

  /** Behavioral annotations for the tool */
  annotations?: ToolAnnotations;
}

// ============================================================================
// Resource Definition
// ============================================================================

// ============================================================================
// Content Annotations
// ============================================================================

/**
 * Annotations for content items (resource content, prompt messages).
 *
 * Provides hints about content audience and priority.
 *
 * @see https://spec.modelcontextprotocol.io/specification/2025-03-26/server/utilities/annotations/
 */
export interface ContentAnnotations {
  /**
   * Who the content is intended for.
   * Can include "user", "assistant", or both.
   */
  audience?: Array<"user" | "assistant">;

  /**
   * Priority level from 0.0 (least) to 1.0 (most important).
   */
  priority?: number;
}

/**
 * Text content returned from a resource read.
 */
export interface TextResourceContent {
  /** Resource URI */
  uri: string;
  /** Text content */
  text: string;
  /** Optional MIME type */
  mimeType?: string;
  /** Optional content annotations */
  annotations?: ContentAnnotations;
}

/**
 * Binary (base64-encoded) content returned from a resource read.
 */
export interface BlobResourceContent {
  /** Resource URI */
  uri: string;
  /** Base64-encoded binary content */
  blob: string;
  /** Optional MIME type */
  mimeType?: string;
  /** Optional content annotations */
  annotations?: ContentAnnotations;
}

/**
 * Content returned from reading a resource.
 */
export type ResourceContent = TextResourceContent | BlobResourceContent;

/**
 * Handler for reading a resource's content.
 *
 * @param uri - The resource URI being read
 * @param ctx - Handler context with logger and requestId
 * @returns Array of resource content items
 */
export type ResourceReadHandler = (
  uri: string,
  ctx: HandlerContext
) => Promise<Result<ResourceContent[], OutfitterError>>;

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
 *   handler: async (uri, ctx) => {
 *     const content = await readFile(uri);
 *     return Result.ok([{ uri, text: content }]);
 *   },
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

  /**
   * Optional handler for reading the resource content.
   * If not provided, the resource is metadata-only.
   */
  handler?: ResourceReadHandler;
}

// ============================================================================
// Resource Templates
// ============================================================================

/**
 * Handler for reading a resource template's content.
 *
 * @param uri - The matched URI
 * @param variables - Extracted template variables
 * @param ctx - Handler context
 */
export type ResourceTemplateReadHandler = (
  uri: string,
  variables: Record<string, string>,
  ctx: HandlerContext
) => Promise<Result<ResourceContent[], OutfitterError>>;

/**
 * Definition of an MCP resource template with URI pattern matching.
 *
 * Templates use RFC 6570 Level 1 URI templates (e.g., `{param}`)
 * to match and extract variables from URIs.
 *
 * @example
 * ```typescript
 * const userTemplate: ResourceTemplateDefinition = {
 *   uriTemplate: "db:///users/{userId}/profile",
 *   name: "User Profile",
 *   handler: async (uri, variables) => {
 *     const profile = await getProfile(variables.userId);
 *     return Result.ok([{ uri, text: JSON.stringify(profile) }]);
 *   },
 * };
 * ```
 */
export interface ResourceTemplateDefinition {
  /** URI template with `{param}` placeholders (RFC 6570 Level 1). */
  uriTemplate: string;

  /** Human-readable name for the template. */
  name: string;

  /** Optional description. */
  description?: string;

  /** Optional MIME type. */
  mimeType?: string;

  /** Optional completion handlers keyed by parameter name. */
  complete?: Record<string, CompletionHandler>;

  /** Handler for reading matched resources. */
  handler: ResourceTemplateReadHandler;
}

// ============================================================================
// Prompt Definition
// ============================================================================

// ============================================================================
// Completions
// ============================================================================

/**
 * Result of a completion request.
 */
export interface CompletionResult {
  /** Completion values */
  values: string[];
  /** Total number of available values (for pagination) */
  total?: number;
  /** Whether there are more values */
  hasMore?: boolean;
}

/**
 * Handler for generating completions.
 */
export type CompletionHandler = (value: string) => Promise<CompletionResult>;

/**
 * Reference to a prompt or resource for completion.
 */
export type CompletionRef =
  | { type: "ref/prompt"; name: string }
  | { type: "ref/resource"; uri: string };

/**
 * Argument definition for a prompt.
 */
export interface PromptArgument {
  /** Argument name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Whether this argument is required */
  required?: boolean;
  /** Optional completion handler for this argument */
  complete?: CompletionHandler;
}

/**
 * Content block within a prompt message.
 */
export interface PromptMessageContent {
  /** Content type */
  type: "text";
  /** Text content */
  text: string;
  /** Optional content annotations */
  annotations?: ContentAnnotations;
}

/**
 * A message in a prompt response.
 */
export interface PromptMessage {
  /** Message role */
  role: "user" | "assistant";
  /** Message content */
  content: PromptMessageContent;
}

/**
 * Result returned from getting a prompt.
 */
export interface PromptResult {
  /** Prompt messages */
  messages: PromptMessage[];
  /** Optional description override */
  description?: string;
}

/**
 * Handler for generating prompt messages.
 */
export type PromptHandler = (
  args: Record<string, string | undefined>
) => Promise<Result<PromptResult, OutfitterError>>;

/**
 * Definition of an MCP prompt.
 *
 * Prompts are reusable templates that generate messages for LLMs.
 *
 * @example
 * ```typescript
 * const reviewPrompt: PromptDefinition = {
 *   name: "code-review",
 *   description: "Review code changes",
 *   arguments: [
 *     { name: "language", description: "Programming language", required: true },
 *   ],
 *   handler: async (args) => Result.ok({
 *     messages: [{ role: "user", content: { type: "text", text: `Review this ${args.language} code` } }],
 *   }),
 * };
 * ```
 */
export interface PromptDefinition {
  /** Unique prompt name */
  name: string;
  /** Human-readable description */
  description?: string;
  /** Prompt arguments */
  arguments: PromptArgument[];
  /** Handler to generate messages */
  handler: PromptHandler;
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

  /** Progress token from client for tracking progress */
  progressToken?: string | number;
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
   * Register a resource template with the server.
   * @param template - Resource template definition to register
   */
  registerResourceTemplate(template: ResourceTemplateDefinition): void;

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
   * Register a prompt with the server.
   * @param prompt - Prompt definition to register
   */
  registerPrompt(prompt: PromptDefinition): void;

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
   * Read a resource by URI.
   * @param uri - Resource URI
   * @returns Result with resource content or McpError
   */
  readResource(
    uri: string
  ): Promise<Result<ResourceContent[], InstanceType<typeof McpError>>>;

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
   * Subscribe to updates for a resource URI.
   * @param uri - Resource URI to subscribe to
   */
  subscribe(uri: string): void;

  /**
   * Unsubscribe from updates for a resource URI.
   * @param uri - Resource URI to unsubscribe from
   */
  unsubscribe(uri: string): void;

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
   * Notify connected clients that the resource list has changed.
   */
  notifyResourcesChanged(): void;

  /**
   * Notify connected clients that the prompt list has changed.
   */
  notifyPromptsChanged(): void;

  /**
   * Set the client-requested log level.
   * Only log messages at or above this level will be forwarded.
   * @param level - MCP log level string
   */
  setLogLevel?(level: string): void;

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
    level: import("./logging.js").McpLogLevel,
    data: unknown,
    loggerName?: string
  ): void;

  /**
   * Bind the SDK server instance for notifications.
   * Called internally by the transport layer.
   * @param sdkServer - The MCP SDK Server instance
   */
  // biome-ignore lint/suspicious/noExplicitAny: SDK Server type
  bindSdkServer?(sdkServer: any): void;

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

// ============================================================================
// Progress Reporting
// ============================================================================

/**
 * Reporter for sending progress updates to clients.
 */
export interface ProgressReporter {
  /**
   * Report progress for the current operation.
   * @param progress - Current progress value
   * @param total - Optional total value (for percentage calculation)
   * @param message - Optional human-readable status message
   */
  report(progress: number, total?: number, message?: string): void;
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

  /** Progress reporter, present when client provides a progressToken */
  progress?: ProgressReporter;
}
