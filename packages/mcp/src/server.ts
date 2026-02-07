/**
 * @outfitter/mcp - Server Implementation
 *
 * MCP server that wraps @modelcontextprotocol/sdk and provides
 * typed tool registration with Result-based error handling.
 *
 * @packageDocumentation
 */

import type {
  HandlerContext,
  Logger,
  OutfitterError,
} from "@outfitter/contracts";
import { generateRequestId, Result } from "@outfitter/contracts";
import type { z } from "zod";
import { zodToJsonSchema } from "./schema.js";
import {
  type CompletionRef,
  type CompletionResult,
  type InvokeToolOptions,
  McpError,
  type McpServer,
  type McpServerOptions,
  type PromptArgument,
  type PromptDefinition,
  type PromptResult,
  type ResourceContent,
  type ResourceDefinition,
  type ResourceTemplateDefinition,
  type SerializedTool,
  type ToolAnnotations,
  type ToolDefinition,
} from "./types.js";

// ============================================================================
// No-Op Logger
// ============================================================================

/**
 * Creates a no-op logger that discards all log messages.
 * Used when no logger is provided to the server.
 */
function createNoOpLogger(): Logger {
  const noop = () => {
    // intentional no-op
  };
  return {
    trace: noop,
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
    fatal: noop,
    child: () => createNoOpLogger(),
  };
}

// ============================================================================
// Tool Storage
// ============================================================================

/**
 * Internal tool storage with handler reference.
 */
interface StoredTool {
  name: string;
  description: string;
  inputSchema: unknown;
  deferLoading: boolean;
  annotations?: ToolAnnotations;
  handler: (
    input: unknown,
    ctx: HandlerContext
  ) => Promise<Result<unknown, OutfitterError>>;
  zodSchema: z.ZodTypeAny;
}

// ============================================================================
// Server Implementation
// ============================================================================

/**
 * Create an MCP server instance.
 *
 * The server provides:
 * - Tool registration with Zod schema validation
 * - Resource registration with read handlers
 * - Resource template registration with URI pattern matching
 * - Tool invocation with Result-based error handling
 * - Automatic error translation from OutfitterError to McpError
 *
 * @param options - Server configuration options
 * @returns Configured McpServer instance
 *
 * @example
 * ```typescript
 * const server = createMcpServer({
 *   name: "calculator",
 *   version: "1.0.0",
 *   logger: createLogger({ name: "mcp" }),
 * });
 *
 * server.registerTool(defineTool({
 *   name: "add",
 *   description: "Add two numbers",
 *   inputSchema: z.object({ a: z.number(), b: z.number() }),
 *   handler: async (input) => Result.ok({ sum: input.a + input.b }),
 * }));
 *
 * const result = await server.invokeTool("add", { a: 2, b: 3 });
 * if (result.isOk()) {
 *   console.log(result.value.sum); // 5
 * }
 * ```
 */
export function createMcpServer(options: McpServerOptions): McpServer {
  const { name, version, logger: providedLogger } = options;
  const logger = providedLogger ?? createNoOpLogger();

  // Tool, resource, template, and prompt storage
  const tools = new Map<string, StoredTool>();
  const resources = new Map<string, ResourceDefinition>();
  const resourceTemplates = new Map<string, ResourceTemplateDefinition>();
  const prompts = new Map<string, PromptDefinition>();

  // Create handler context for tool invocations
  function createHandlerContext(
    toolName: string,
    requestId: string,
    signal?: AbortSignal
  ): HandlerContext {
    const ctx: HandlerContext = {
      requestId,
      logger: logger.child({ tool: toolName, requestId }),
      cwd: process.cwd(),
      env: process.env as Record<string, string | undefined>,
    };

    // Only add signal if it's defined (exactOptionalPropertyTypes)
    if (signal !== undefined) {
      ctx.signal = signal;
    }

    return ctx;
  }

  // Translate OutfitterError to McpError
  function translateError(
    error: OutfitterError
  ): InstanceType<typeof McpError> {
    // Map error categories to JSON-RPC error codes
    const codeMap: Record<string, number> = {
      validation: -32_602, // Invalid params
      not_found: -32_601, // Method not found (closest fit)
      permission: -32_600, // Invalid request
      internal: -32_603, // Internal error
      timeout: -32_603,
      network: -32_603,
      rate_limit: -32_603,
      auth: -32_600,
      conflict: -32_603,
      cancelled: -32_603,
    };

    const code = codeMap[error.category] ?? -32_603;

    return new McpError({
      message: error.message,
      code,
      context: {
        originalTag: error._tag,
        category: error.category,
      },
    });
  }

  const server: McpServer = {
    name,
    version,

    registerTool<TInput, TOutput, TError extends OutfitterError>(
      tool: ToolDefinition<TInput, TOutput, TError>
    ): void {
      logger.debug("Registering tool", { name: tool.name });

      const description = tool.description?.trim() ?? "";
      if (description.length < 8) {
        logger.warn("Tool description may be too short for search discovery", {
          name: tool.name,
          description,
        });
      }

      const jsonSchema = zodToJsonSchema(tool.inputSchema);
      const handler: StoredTool["handler"] = (input, ctx) =>
        tool.handler(input as TInput, ctx);
      const deferLoading = tool.deferLoading ?? true;

      const stored: StoredTool = {
        name: tool.name,
        description,
        inputSchema: jsonSchema,
        deferLoading,
        handler,
        zodSchema: tool.inputSchema,
      };
      if (tool.annotations !== undefined) {
        stored.annotations = tool.annotations;
      }
      tools.set(tool.name, stored);

      logger.info("Tool registered", { name: tool.name });
    },

    registerResource(resource: ResourceDefinition): void {
      logger.debug("Registering resource", {
        uri: resource.uri,
        name: resource.name,
      });
      resources.set(resource.uri, resource);
      logger.info("Resource registered", { uri: resource.uri });
    },

    registerResourceTemplate(template: ResourceTemplateDefinition): void {
      logger.debug("Registering resource template", {
        uriTemplate: template.uriTemplate,
        name: template.name,
      });
      resourceTemplates.set(template.uriTemplate, template);
      logger.info("Resource template registered", {
        uriTemplate: template.uriTemplate,
      });
    },

    getTools(): SerializedTool[] {
      return Array.from(tools.values()).map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema as Record<string, unknown>,
        defer_loading: tool.deferLoading,
        ...(tool.annotations ? { annotations: tool.annotations } : {}),
      }));
    },

    getResources(): ResourceDefinition[] {
      return Array.from(resources.values());
    },

    getResourceTemplates(): ResourceTemplateDefinition[] {
      return Array.from(resourceTemplates.values());
    },

    async complete(
      ref: CompletionRef,
      argumentName: string,
      value: string
    ): Promise<Result<CompletionResult, InstanceType<typeof McpError>>> {
      if (ref.type === "ref/prompt") {
        const prompt = prompts.get(ref.name);
        if (!prompt) {
          return Result.err(
            new McpError({
              message: `Prompt not found: ${ref.name}`,
              code: -32_601,
              context: { prompt: ref.name },
            })
          );
        }

        const arg = prompt.arguments.find((a) => a.name === argumentName);
        if (!arg?.complete) {
          return Result.ok({ values: [] });
        }

        try {
          const result = await arg.complete(value);
          return Result.ok(result);
        } catch (error) {
          return Result.err(
            new McpError({
              message: error instanceof Error ? error.message : "Unknown error",
              code: -32_603,
              context: {
                prompt: ref.name,
                argument: argumentName,
                thrown: true,
              },
            })
          );
        }
      }

      if (ref.type === "ref/resource") {
        const template = resourceTemplates.get(ref.uri);
        if (!template) {
          return Result.err(
            new McpError({
              message: `Resource template not found: ${ref.uri}`,
              code: -32_601,
              context: { uri: ref.uri },
            })
          );
        }

        const handler = template.complete?.[argumentName];
        if (!handler) {
          return Result.ok({ values: [] });
        }

        try {
          const result = await handler(value);
          return Result.ok(result);
        } catch (error) {
          return Result.err(
            new McpError({
              message: error instanceof Error ? error.message : "Unknown error",
              code: -32_603,
              context: { uri: ref.uri, argument: argumentName, thrown: true },
            })
          );
        }
      }

      return Result.err(
        new McpError({
          message: "Invalid completion reference type",
          code: -32_602,
          context: { ref },
        })
      );
    },

    registerPrompt(prompt: PromptDefinition): void {
      logger.debug("Registering prompt", { name: prompt.name });
      prompts.set(prompt.name, prompt);
      logger.info("Prompt registered", { name: prompt.name });
    },

    getPrompts(): Array<{
      name: string;
      description?: string;
      arguments: PromptArgument[];
    }> {
      return Array.from(prompts.values()).map((p) => ({
        name: p.name,
        ...(p.description ? { description: p.description } : {}),
        arguments: p.arguments,
      }));
    },

    async getPrompt(
      promptName: string,
      args: Record<string, string | undefined>
    ): Promise<Result<PromptResult, InstanceType<typeof McpError>>> {
      const prompt = prompts.get(promptName);
      if (!prompt) {
        return Result.err(
          new McpError({
            message: `Prompt not found: ${promptName}`,
            code: -32_601,
            context: { prompt: promptName },
          })
        );
      }

      // Validate required arguments
      for (const arg of prompt.arguments) {
        if (
          arg.required &&
          (args[arg.name] === undefined || args[arg.name] === "")
        ) {
          return Result.err(
            new McpError({
              message: `Missing required argument: ${arg.name}`,
              code: -32_602,
              context: { prompt: promptName, argument: arg.name },
            })
          );
        }
      }

      try {
        const result = await prompt.handler(args);
        if (result.isErr()) {
          return Result.err(translateError(result.error));
        }
        return Result.ok(result.value);
      } catch (error) {
        return Result.err(
          new McpError({
            message: error instanceof Error ? error.message : "Unknown error",
            code: -32_603,
            context: { prompt: promptName, thrown: true },
          })
        );
      }
    },

    async readResource(
      uri: string
    ): Promise<Result<ResourceContent[], InstanceType<typeof McpError>>> {
      // Try exact resource match first
      const resource = resources.get(uri);
      if (resource) {
        if (!resource.handler) {
          return Result.err(
            new McpError({
              message: `Resource not readable: ${uri}`,
              code: -32_002,
              context: { uri },
            })
          );
        }

        const requestId = generateRequestId();
        const ctx: HandlerContext = {
          requestId,
          logger: logger.child({ resource: uri, requestId }),
          cwd: process.cwd(),
          env: process.env as Record<string, string | undefined>,
        };

        try {
          const result = await resource.handler(uri, ctx);
          if (result.isErr()) {
            return Result.err(translateError(result.error));
          }
          return Result.ok(result.value);
        } catch (error) {
          return Result.err(
            new McpError({
              message: error instanceof Error ? error.message : "Unknown error",
              code: -32_603,
              context: { uri, thrown: true },
            })
          );
        }
      }

      // Try template matching
      for (const template of resourceTemplates.values()) {
        const variables = matchUriTemplate(template.uriTemplate, uri);
        if (variables) {
          const templateRequestId = generateRequestId();
          const templateCtx: HandlerContext = {
            requestId: templateRequestId,
            logger: logger.child({
              resource: uri,
              requestId: templateRequestId,
            }),
            cwd: process.cwd(),
            env: process.env as Record<string, string | undefined>,
          };

          try {
            const result = await template.handler(uri, variables, templateCtx);
            if (result.isErr()) {
              return Result.err(translateError(result.error));
            }
            return Result.ok(result.value);
          } catch (error) {
            return Result.err(
              new McpError({
                message:
                  error instanceof Error ? error.message : "Unknown error",
                code: -32_603,
                context: { uri, thrown: true },
              })
            );
          }
        }
      }

      return Result.err(
        new McpError({
          message: `Resource not found: ${uri}`,
          code: -32_002,
          context: { uri },
        })
      );
    },

    async invokeTool<T = unknown>(
      toolName: string,
      input: unknown,
      invokeOptions?: InvokeToolOptions
    ): Promise<Result<T, InstanceType<typeof McpError>>> {
      const requestId = invokeOptions?.requestId ?? generateRequestId();

      logger.debug("Invoking tool", { tool: toolName, requestId });

      // Find tool
      const tool = tools.get(toolName);
      if (!tool) {
        logger.warn("Tool not found", { tool: toolName, requestId });
        return Result.err(
          new McpError({
            message: `Tool not found: ${toolName}`,
            code: -32_601,
            context: { tool: toolName },
          })
        );
      }

      // Validate input
      const parseResult = tool.zodSchema.safeParse(input);
      if (!parseResult.success) {
        const errorMessages = parseResult.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ");

        logger.warn("Input validation failed", {
          tool: toolName,
          requestId,
          errors: errorMessages,
        });

        return Result.err(
          new McpError({
            message: `Invalid input: ${errorMessages}`,
            code: -32_602,
            context: {
              tool: toolName,
              validationErrors: parseResult.error.issues,
            },
          })
        );
      }

      // Create handler context
      const ctx = createHandlerContext(
        toolName,
        requestId,
        invokeOptions?.signal
      );

      // Invoke handler
      try {
        const result = await tool.handler(parseResult.data, ctx);

        if (result.isErr()) {
          logger.debug("Tool returned error", {
            tool: toolName,
            requestId,
            error: result.error._tag,
          });
          return Result.err(translateError(result.error));
        }

        logger.debug("Tool completed successfully", {
          tool: toolName,
          requestId,
        });
        return Result.ok(result.value as T);
      } catch (error) {
        logger.error("Tool threw exception", {
          tool: toolName,
          requestId,
          error: error instanceof Error ? error.message : String(error),
        });

        return Result.err(
          new McpError({
            message: error instanceof Error ? error.message : "Unknown error",
            code: -32_603,
            context: {
              tool: toolName,
              thrown: true,
            },
          })
        );
      }
    },

    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
    async start(): Promise<void> {
      logger.info("MCP server starting", { name, version, tools: tools.size });
    },

    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
    async stop(): Promise<void> {
      logger.info("MCP server stopping", { name, version });
    },
  };

  return server;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Define a typed tool.
 *
 * This is a helper function that provides better type inference
 * when creating tool definitions.
 *
 * @param definition - Tool definition object
 * @returns The same tool definition with inferred types
 *
 * @example
 * ```typescript
 * const echoTool = defineTool({
 *   name: "echo",
 *   description: "Echo the input message",
 *   inputSchema: z.object({ message: z.string() }),
 *   handler: async (input, ctx) => {
 *     ctx.logger.debug("Echoing message");
 *     return Result.ok({ echo: input.message });
 *   },
 * });
 * ```
 */
export function defineTool<
  TInput,
  TOutput,
  TError extends OutfitterError = OutfitterError,
>(
  definition: ToolDefinition<TInput, TOutput, TError>
): ToolDefinition<TInput, TOutput, TError> {
  return definition;
}

/**
 * Match a URI against a RFC 6570 Level 1 URI template.
 *
 * Extracts named variables from `{param}` segments.
 * Returns null if the URI doesn't match the template.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchUriTemplate(
  template: string,
  uri: string
): Record<string, string> | null {
  // Split template into literal segments and {param} placeholders,
  // escape literal segments to avoid regex metacharacter issues
  const paramNames: string[] = [];
  const parts = template.split(/(\{[^}]+\})/);
  const regexSource = parts
    .map((part) => {
      const paramMatch = part.match(/^\{([^}]+)\}$/);
      if (paramMatch?.[1]) {
        paramNames.push(paramMatch[1]);
        return "([^/]+)";
      }
      return escapeRegex(part);
    })
    .join("");

  const regex = new RegExp(`^${regexSource}$`);
  const match = uri.match(regex);

  if (!match) {
    return null;
  }

  const variables: Record<string, string> = {};
  for (let i = 0; i < paramNames.length; i++) {
    const name = paramNames[i];
    const value = match[i + 1];
    if (name !== undefined && value !== undefined) {
      variables[name] = value;
    }
  }

  return variables;
}

/**
 * Define a resource.
 *
 * This is a helper function for creating resource definitions
 * with consistent typing.
 *
 * @param definition - Resource definition object
 * @returns The same resource definition
 *
 * @example
 * ```typescript
 * const configResource = defineResource({
 *   uri: "file:///etc/app/config.json",
 *   name: "Application Config",
 *   description: "Main configuration file",
 *   mimeType: "application/json",
 * });
 * ```
 */
export function defineResource(
  definition: ResourceDefinition
): ResourceDefinition {
  return definition;
}

/**
 * Define a resource template.
 *
 * Helper function for creating resource template definitions
 * with URI pattern matching.
 *
 * @param definition - Resource template definition object
 * @returns The same resource template definition
 */
export function defineResourceTemplate(
  definition: ResourceTemplateDefinition
): ResourceTemplateDefinition {
  return definition;
}

/**
 * Define a prompt.
 *
 * Helper function for creating prompt definitions
 * with consistent typing.
 *
 * @param definition - Prompt definition object
 * @returns The same prompt definition
 */
export function definePrompt(definition: PromptDefinition): PromptDefinition {
  return definition;
}
