/**
 * @outfitter/mcp - Server Implementation
 *
 * MCP server that wraps @modelcontextprotocol/sdk and provides
 * typed tool registration with Result-based error handling.
 *
 * @packageDocumentation
 */

import { Result } from "@outfitter/contracts";
import type { Logger, KitError, HandlerContext } from "@outfitter/contracts";
import { generateRequestId } from "@outfitter/contracts";
import { zodToJsonSchema } from "./schema.js";
import {
	type McpServerOptions,
	type ToolDefinition,
	type ResourceDefinition,
	type McpServer,
	type SerializedTool,
	type InvokeToolOptions,
	McpError,
} from "./types.js";

// ============================================================================
// No-Op Logger
// ============================================================================

/**
 * Creates a no-op logger that discards all log messages.
 * Used when no logger is provided to the server.
 */
function createNoOpLogger(): Logger {
	const noop = () => {};
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
	// biome-ignore lint/suspicious/noExplicitAny: Handler types vary
	handler: (input: any, ctx: HandlerContext) => Promise<Result<unknown, KitError>>;
	// biome-ignore lint/suspicious/noExplicitAny: Zod schema type
	zodSchema: any;
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
 * - Automatic error translation from KitError to McpError
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

	// Tool and resource storage
	const tools = new Map<string, StoredTool>();
	const resources: ResourceDefinition[] = [];

	// Create handler context for tool invocations
	function createHandlerContext(
		toolName: string,
		requestId: string,
		signal?: AbortSignal,
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

	// Translate KitError to McpError
	function translateError(error: KitError): InstanceType<typeof McpError> {
		// Map error categories to JSON-RPC error codes
		const codeMap: Record<string, number> = {
			validation: -32602, // Invalid params
			not_found: -32601, // Method not found (closest fit)
			permission: -32600, // Invalid request
			internal: -32603, // Internal error
			timeout: -32603,
			network: -32603,
			rate_limit: -32603,
			auth: -32600,
			conflict: -32603,
			cancelled: -32603,
		};

		const code = codeMap[error.category] ?? -32603;

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

		registerTool<TInput, TOutput, TError extends KitError>(
			tool: ToolDefinition<TInput, TOutput, TError>,
		): void {
			logger.debug("Registering tool", { name: tool.name });

			const jsonSchema = zodToJsonSchema(tool.inputSchema);
			const handler: StoredTool["handler"] = (input, ctx) => tool.handler(input as TInput, ctx);

			tools.set(tool.name, {
				name: tool.name,
				description: tool.description,
				inputSchema: jsonSchema,
				handler,
				zodSchema: tool.inputSchema,
			});

			logger.info("Tool registered", { name: tool.name });
		},

		registerResource(resource: ResourceDefinition): void {
			logger.debug("Registering resource", { uri: resource.uri, name: resource.name });
			resources.push(resource);
			logger.info("Resource registered", { uri: resource.uri });
		},

		getTools(): SerializedTool[] {
			return Array.from(tools.values()).map((tool) => ({
				name: tool.name,
				description: tool.description,
				inputSchema: tool.inputSchema as Record<string, unknown>,
			}));
		},

		getResources(): ResourceDefinition[] {
			return [...resources];
		},

		async invokeTool<T = unknown>(
			toolName: string,
			input: unknown,
			invokeOptions?: InvokeToolOptions,
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
						code: -32601,
						context: { tool: toolName },
					}),
				);
			}

			// Validate input
			const parseResult = tool.zodSchema.safeParse(input);
			if (!parseResult.success) {
				const errorMessages = parseResult.error.issues
					.map(
						(issue: { path: (string | number)[]; message: string }) =>
							`${issue.path.join(".")}: ${issue.message}`,
					)
					.join("; ");

				logger.warn("Input validation failed", {
					tool: toolName,
					requestId,
					errors: errorMessages,
				});

				return Result.err(
					new McpError({
						message: `Invalid input: ${errorMessages}`,
						code: -32602,
						context: {
							tool: toolName,
							validationErrors: parseResult.error.issues,
						},
					}),
				);
			}

			// Create handler context
			const ctx = createHandlerContext(toolName, requestId, invokeOptions?.signal);

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

				logger.debug("Tool completed successfully", { tool: toolName, requestId });
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
						code: -32603,
						context: {
							tool: toolName,
							thrown: true,
						},
					}),
				);
			}
		},

		async start(): Promise<void> {
			logger.info("MCP server starting", { name, version, tools: tools.size });
			// In a full implementation, this would start the transport layer
			// For now, we just log the start
		},

		async stop(): Promise<void> {
			logger.info("MCP server stopping", { name, version });
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
export function defineTool<TInput, TOutput, TError extends KitError = KitError>(
	definition: ToolDefinition<TInput, TOutput, TError>,
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
export function defineResource(definition: ResourceDefinition): ResourceDefinition {
	return definition;
}
