/**
 * @outfitter/mcp - Server Implementation
 *
 * MCP server that wraps @modelcontextprotocol/sdk and provides
 * typed tool registration with Result-based error handling.
 *
 * @packageDocumentation
 */

import { getEnvironment, getEnvironmentDefaults } from "@outfitter/config";
import type { HandlerContext, OutfitterError } from "@outfitter/contracts";
import { generateRequestId, Result } from "@outfitter/contracts";
import {
  createOutfitterLoggerFactory,
  createPrettyFormatter,
  type Sink,
} from "@outfitter/logging";
import type { z } from "zod";
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
} from "./types.js";

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
// Default Log Level Resolution
// ============================================================================

/** Valid MCP log levels for env var and option validation. */
const VALID_MCP_LOG_LEVELS: ReadonlySet<string> = new Set([
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency",
]);

/** Map from EnvironmentDefaults logLevel to McpLogLevel. */
const DEFAULTS_TO_MCP: Readonly<Record<string, McpLogLevel>> = {
  debug: "debug",
  info: "info",
  warn: "warning",
  error: "error",
};

function createDefaultMcpSink(): Sink {
  const formatter = createPrettyFormatter({ colors: false });
  return {
    formatter,
    write(record, formatted) {
      const serialized = formatted ?? formatter.format(record);
      const line = serialized.endsWith("\n") ? serialized : `${serialized}\n`;

      if (typeof process !== "undefined" && process.stderr?.write) {
        process.stderr.write(line);
      }
    },
  };
}

/**
 * Resolve the default client log level from the precedence chain.
 *
 * Precedence (highest wins):
 * 1. `OUTFITTER_LOG_LEVEL` environment variable
 * 2. `options.defaultLogLevel` (validated against MCP levels)
 * 3. Environment profile (`OUTFITTER_ENV`)
 * 4. `null` (no forwarding)
 */
function resolveDefaultLogLevel(options: McpServerOptions): McpLogLevel | null {
  // 1. OUTFITTER_LOG_LEVEL env var (highest precedence)
  const envLogLevel = process.env["OUTFITTER_LOG_LEVEL"];
  if (envLogLevel !== undefined && VALID_MCP_LOG_LEVELS.has(envLogLevel)) {
    return envLogLevel as McpLogLevel;
  }

  // 2. options.defaultLogLevel (validated)
  if (
    options.defaultLogLevel !== undefined &&
    (options.defaultLogLevel === null ||
      VALID_MCP_LOG_LEVELS.has(options.defaultLogLevel))
  ) {
    return options.defaultLogLevel;
  }
  // Invalid defaultLogLevel values fall through to profile

  // 3. Environment profile (map from config convention to MCP convention)
  const env = getEnvironment();
  const defaults = getEnvironmentDefaults(env);
  if (defaults.logLevel !== null) {
    const mapped = DEFAULTS_TO_MCP[defaults.logLevel];
    if (mapped !== undefined) {
      return mapped;
    }
  }

  // 4. Default: no forwarding
  return null;
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
  // biome-ignore lint/suspicious/noExplicitAny: SDK Server type from @modelcontextprotocol/sdk
  let sdkServer: any = null;
  const subscriptions = new Set<string>();
  let clientLogLevel: McpLogLevel | null = resolveDefaultLogLevel(options);

  // Create handler context for tool invocations
  function createHandlerContext(
    toolName: string,
    requestId: string,
    signal?: AbortSignal,
    progressToken?: string | number
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

    // Add progress reporter when token is present and SDK server is bound
    if (progressToken !== undefined && sdkServer) {
      (ctx as { progress?: unknown }).progress = {
        report(progress: number, total?: number, message?: string) {
          sdkServer?.notification?.({
            method: "notifications/progress",
            params: {
              progressToken,
              progress,
              ...(total !== undefined ? { total } : {}),
              ...(message ? { message } : {}),
            },
          });
        },
      };
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

    // biome-ignore lint/suspicious/noExplicitAny: SDK Server type
    bindSdkServer(server: any): void {
      sdkServer = server;
      clientLogLevel = resolveDefaultLogLevel(options);
      logger.debug("SDK server bound for notifications");
    },

    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
    async start(): Promise<void> {
      logger.info("MCP server starting", { name, version, tools: tools.size });
      // In a full implementation, this would start the transport layer
      // For now, we just log the start
    },

    // biome-ignore lint/suspicious/useAwait: interface requires Promise return type
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
