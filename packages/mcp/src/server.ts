/* oxlint-disable outfitter/max-file-lines -- Cohesive server factory; remaining code is a single tightly-coupled block with no further extractable seams */
/**
 * @outfitter/mcp - Server Implementation
 *
 * MCP server that wraps @modelcontextprotocol/sdk and provides
 * typed tool registration with Result-based error handling.
 *
 * @packageDocumentation
 */

import type { HandlerContext, OutfitterError } from "@outfitter/contracts";
import {
  formatZodIssues,
  generateRequestId,
  Result,
  ValidationError,
} from "@outfitter/contracts";
import { createOutfitterLoggerFactory } from "@outfitter/logging";
import type { z } from "zod";

import {
  createHandlerContext,
  translateError,
} from "./internal/handler-adapters.js";
import {
  createDefaultMcpSink,
  resolveDefaultLogLevel,
} from "./internal/log-config.js";
import { matchUriTemplate } from "./internal/uri-template.js";
import { type McpLogLevel, shouldEmitLog } from "./logging.js";
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
  type TypedResourceTemplateDefinition,
} from "./types.js";

// ============================================================================
// Tool Storage
// ============================================================================

/**
 * Internal tool storage with handler reference.
 */
interface StoredTool {
  annotations?: ToolAnnotations;
  deferLoading: boolean;
  description: string;
  handler: (
    input: unknown,
    ctx: HandlerContext
  ) => Promise<Result<unknown, OutfitterError>>;
  inputSchema: unknown;
  name: string;
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
 * - Resource registration
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
  let loggerFactory: ReturnType<typeof createOutfitterLoggerFactory> | null =
    null;
  const logger =
    providedLogger ??
    (() => {
      loggerFactory = createOutfitterLoggerFactory({
        defaults: { sinks: [createDefaultMcpSink()] },
      });
      return loggerFactory.createLogger({
        name: "mcp",
        context: { serverName: name, serverVersion: version, surface: "mcp" },
      });
    })();

  // Tool, resource, template, and prompt storage
  const tools = new Map<string, StoredTool>();
  const resources = new Map<string, ResourceDefinition>();
  const resourceTemplates = new Map<string, ResourceTemplateDefinition>();
  const prompts = new Map<string, PromptDefinition>();

  // SDK server binding for notifications
  // oxlint-disable-next-line typescript/no-explicit-any -- SDK Server type from @modelcontextprotocol/sdk
  let sdkServer: any = null;
  const subscriptions = new Set<string>();
  let clientLogLevel: McpLogLevel | null = resolveDefaultLogLevel(options);

  /** Deps object passed to the extracted createHandlerContext helper. */
  const handlerDeps = {
    logger,
    get sdkServer() {
      return sdkServer;
    },
  };

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
      if (sdkServer) {
        sdkServer.sendToolListChanged?.();
      }
    },

    registerResource(resource: ResourceDefinition): void {
      logger.debug("Registering resource", {
        uri: resource.uri,
        name: resource.name,
      });
      resources.set(resource.uri, resource);
      logger.info("Resource registered", { uri: resource.uri });
      if (sdkServer) {
        sdkServer.sendResourceListChanged?.();
      }
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
      if (sdkServer) {
        sdkServer.sendResourceListChanged?.();
      }
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
      if (sdkServer) {
        sdkServer.sendPromptListChanged?.();
      }
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
        const ctx = createHandlerContext(
          uri,
          requestId,
          handlerDeps,
          undefined,
          undefined,
          {
            resource: uri,
            requestId,
          }
        );

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
          const templateCtx = createHandlerContext(
            uri,
            templateRequestId,
            handlerDeps,
            undefined,
            undefined,
            { resource: uri, requestId: templateRequestId }
          );

          try {
            const result = await template.handler(uri, variables, templateCtx);
            if (result.isErr()) {
              logger.warn("Resource template handler returned error", {
                uri,
                requestId: templateRequestId,
                error: result.error._tag,
              });
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
        const errorMessages = formatZodIssues(parseResult.error.issues);

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
        handlerDeps,
        invokeOptions?.signal,
        invokeOptions?.progressToken
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

    subscribe(uri: string): void {
      subscriptions.add(uri);
      logger.debug("Resource subscription added", { uri });
    },

    unsubscribe(uri: string): void {
      subscriptions.delete(uri);
      logger.debug("Resource subscription removed", { uri });
    },

    notifyResourceUpdated(uri: string): void {
      if (subscriptions.has(uri)) {
        sdkServer?.sendResourceUpdated?.({ uri });
      }
    },

    notifyToolsChanged(): void {
      sdkServer?.sendToolListChanged?.();
    },

    notifyResourcesChanged(): void {
      sdkServer?.sendResourceListChanged?.();
    },

    notifyPromptsChanged(): void {
      sdkServer?.sendPromptListChanged?.();
    },

    setLogLevel(level: string): void {
      clientLogLevel = level as McpLogLevel;
      logger.debug("Client log level set", { level });
    },

    sendLogMessage(
      level: McpLogLevel,
      data: unknown,
      loggerName?: string
    ): void {
      if (
        !sdkServer ||
        clientLogLevel === null ||
        !shouldEmitLog(level, clientLogLevel)
      ) {
        return;
      }

      const params: { level: McpLogLevel; data: unknown; logger?: string } = {
        level,
        data,
      };

      if (loggerName !== undefined) {
        params.logger = loggerName;
      }

      sdkServer.sendLoggingMessage?.(params);
    },

    // oxlint-disable-next-line typescript/no-explicit-any -- SDK Server type
    bindSdkServer(server: any): void {
      sdkServer = server;
      clientLogLevel = resolveDefaultLogLevel(options);
      logger.debug("SDK server bound for notifications");
    },

    // oxlint-disable-next-line require-await, typescript/require-await -- interface requires Promise return type
    async start(): Promise<void> {
      logger.info("MCP server starting", { name, version, tools: tools.size });
      // In a full implementation, this would start the transport layer
      // For now, we just log the start
    },

    async stop(): Promise<void> {
      logger.info("MCP server stopping", { name, version });
      if (loggerFactory !== null) {
        await loggerFactory.flush();
      }
      // In a full implementation, this would stop the transport layer
      // For now, we just log the stop
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
 * Define a resource template with optional Zod schema validation.
 *
 * When `paramSchema` is provided, URI template variables are validated
 * and coerced before handler invocation — parallel to how `defineTool()`
 * validates input via `inputSchema`. Invalid parameters produce an
 * McpError with code -32602 (Invalid params) and the handler is never called.
 *
 * @param definition - Resource template definition with optional `paramSchema`
 * @returns A `ResourceTemplateDefinition` compatible with `registerResourceTemplate()`
 *
 * @example
 * ```typescript
 * // With Zod schema validation (recommended for typed params)
 * const userTemplate = defineResourceTemplate({
 *   uriTemplate: "db:///users/{userId}/posts/{postId}",
 *   name: "User Post",
 *   paramSchema: z.object({
 *     userId: z.string().min(1),
 *     postId: z.coerce.number().int().positive(),
 *   }),
 *   handler: async (uri, params, ctx) => {
 *     // params is typed as { userId: string; postId: number }
 *     return Result.ok([{ uri, text: JSON.stringify(params) }]);
 *   },
 * });
 *
 * // Without schema (backward compatible)
 * const simpleTemplate = defineResourceTemplate({
 *   uriTemplate: "db:///items/{itemId}",
 *   name: "Item",
 *   handler: async (uri, variables) =>
 *     Result.ok([{ uri, text: variables.itemId }]),
 * });
 * ```
 */
export function defineResourceTemplate<TParams>(
  definition: TypedResourceTemplateDefinition<TParams>
): ResourceTemplateDefinition;
export function defineResourceTemplate(
  definition: ResourceTemplateDefinition
): ResourceTemplateDefinition;
export function defineResourceTemplate<TParams>(
  definition:
    | TypedResourceTemplateDefinition<TParams>
    | ResourceTemplateDefinition
): ResourceTemplateDefinition {
  // When paramSchema is present, wrap handler with validation
  if ("paramSchema" in definition && definition.paramSchema !== undefined) {
    const { paramSchema, handler: typedHandler, ...rest } = definition;

    const wrappedHandler: ResourceTemplateDefinition["handler"] = async (
      uri,
      variables,
      ctx
    ) => {
      const parseResult = paramSchema.safeParse(variables);
      if (!parseResult.success) {
        const errorMessages = formatZodIssues(parseResult.error.issues);

        return Result.err(
          new ValidationError({
            message: `Invalid resource parameters: ${errorMessages}`,
            field: "params",
          })
        );
      }

      return typedHandler(uri, parseResult.data as TParams, ctx);
    };

    return { ...rest, handler: wrappedHandler };
  }

  return definition as ResourceTemplateDefinition;
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
