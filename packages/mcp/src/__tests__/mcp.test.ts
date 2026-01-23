/**
 * TDD Tests for @outfitter/mcp
 *
 * Tests cover:
 * - Type Definitions (compile-time checks)
 * - Server Creation
 * - Tool Registration and Invocation
 * - Resource Definition
 * - Error Translation
 * - HandlerContext Passing
 * - Pagination Support
 */
import { describe, expect, it } from "bun:test";
import { Result, ValidationError, NotFoundError, InternalError } from "@outfitter/contracts";
import { createLogger } from "@outfitter/logging";
import { z } from "zod";
import {
	type McpServerOptions,
	type ToolDefinition,
	type ResourceDefinition,
	McpError,
	createMcpServer,
	defineTool,
	defineResource,
} from "../index.js";

// ============================================================================
// Type Definition Tests
// ============================================================================

describe("Type Definitions", () => {
	it("McpServerOptions has required fields", () => {
		const options: McpServerOptions = {
			name: "test-server",
			version: "1.0.0",
		};

		expect(options.name).toBe("test-server");
		expect(options.version).toBe("1.0.0");
	});

	it("McpServerOptions accepts optional logger", () => {
		const logger = createLogger({ name: "test" });
		const options: McpServerOptions = {
			name: "test-server",
			version: "1.0.0",
			logger,
		};

		expect(options.logger).toBeDefined();
	});

	it("ToolDefinition has required fields", () => {
		const tool: ToolDefinition<
			{ id: string },
			{ name: string },
			InstanceType<typeof NotFoundError>
		> = {
			name: "get-item",
			description: "Get an item by ID",
			inputSchema: z.object({ id: z.string() }),
			handler: async (input, _ctx) => {
				return Result.ok({ name: `Item ${input.id}` });
			},
		};

		expect(tool.name).toBe("get-item");
		expect(tool.description).toBe("Get an item by ID");
		expect(tool.inputSchema).toBeDefined();
		expect(typeof tool.handler).toBe("function");
	});

	it("ResourceDefinition has required fields", () => {
		const resource: ResourceDefinition = {
			uri: "file:///path/to/resource",
			name: "My Resource",
		};

		expect(resource.uri).toBe("file:///path/to/resource");
		expect(resource.name).toBe("My Resource");
	});

	it("ResourceDefinition accepts optional fields", () => {
		const resource: ResourceDefinition = {
			uri: "file:///data.json",
			name: "Data File",
			description: "A JSON data file",
			mimeType: "application/json",
		};

		expect(resource.description).toBe("A JSON data file");
		expect(resource.mimeType).toBe("application/json");
	});

	it("McpError extends TaggedError", () => {
		const error = new McpError({
			message: "Tool not found",
			code: -32601,
		});

		expect(error.message).toBe("Tool not found");
		expect(error.code).toBe(-32601);
		expect(error._tag).toBe("McpError");
	});
});

// ============================================================================
// Server Creation Tests
// ============================================================================

describe("Server Creation", () => {
	it("createMcpServer returns an McpServer instance", () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		expect(server).toBeDefined();
		expect(typeof server.registerTool).toBe("function");
		expect(typeof server.registerResource).toBe("function");
	});

	it("McpServer has name and version properties", () => {
		const server = createMcpServer({
			name: "my-server",
			version: "2.0.0",
		});

		expect(server.name).toBe("my-server");
		expect(server.version).toBe("2.0.0");
	});

	it("McpServer accepts custom logger", () => {
		const logger = createLogger({ name: "mcp-test" });
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
			logger,
		});

		expect(server).toBeDefined();
	});

	it("McpServer has start and stop methods", () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		expect(typeof server.start).toBe("function");
		expect(typeof server.stop).toBe("function");
	});

	it("McpServer has getTools and getResources methods", () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		expect(typeof server.getTools).toBe("function");
		expect(typeof server.getResources).toBe("function");
	});
});

// ============================================================================
// Tool Registration Tests
// ============================================================================

describe("Tool Registration", () => {
	it("defineTool returns the tool definition", () => {
		const tool = defineTool({
			name: "echo",
			description: "Echo the input",
			inputSchema: z.object({ message: z.string() }),
			handler: async (input, _ctx) => Result.ok({ echo: input.message }),
		});

		expect(tool.name).toBe("echo");
		expect(tool.description).toBe("Echo the input");
	});

	it("registerTool adds tool to server", () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool = defineTool({
			name: "greet",
			description: "Greet a person",
			inputSchema: z.object({ name: z.string() }),
			handler: async (input, _ctx) => Result.ok({ greeting: `Hello, ${input.name}!` }),
		});

		server.registerTool(tool);

		const tools = server.getTools();
		expect(tools.length).toBe(1);
		expect(tools[0].name).toBe("greet");
	});

	it("multiple tools can be registered", () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool1 = defineTool({
			name: "tool1",
			description: "First tool",
			inputSchema: z.object({}),
			handler: async (_input, _ctx) => Result.ok({ result: 1 }),
		});

		const tool2 = defineTool({
			name: "tool2",
			description: "Second tool",
			inputSchema: z.object({}),
			handler: async (_input, _ctx) => Result.ok({ result: 2 }),
		});

		server.registerTool(tool1);
		server.registerTool(tool2);

		const tools = server.getTools();
		expect(tools.length).toBe(2);
	});
});

// ============================================================================
// Tool Invocation Tests
// ============================================================================

describe("Tool Invocation", () => {
	it("invokeTool executes handler with input", async () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool = defineTool({
			name: "add",
			description: "Add two numbers",
			inputSchema: z.object({ a: z.number(), b: z.number() }),
			handler: async (input, _ctx) => Result.ok({ sum: input.a + input.b }),
		});

		server.registerTool(tool);

		const result = await server.invokeTool("add", { a: 2, b: 3 });

		expect(result.isOk()).toBe(true);
		if (result.isOk()) {
			expect(result.value.sum).toBe(5);
		}
	});

	it("invokeTool validates input against schema", async () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool = defineTool({
			name: "strict-tool",
			description: "Requires specific input",
			inputSchema: z.object({ id: z.string().min(3) }),
			handler: async (input, _ctx) => Result.ok({ id: input.id }),
		});

		server.registerTool(tool);

		const result = await server.invokeTool("strict-tool", { id: "ab" });

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error._tag).toBe("McpError");
		}
	});

	it("invokeTool returns error for unknown tool", async () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const result = await server.invokeTool("nonexistent", {});

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.message).toContain("not found");
		}
	});

	it("handler receives HandlerContext with logger", async () => {
		let receivedContext: unknown = null;

		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool = defineTool({
			name: "context-test",
			description: "Test context passing",
			inputSchema: z.object({}),
			handler: async (_input, ctx) => {
				receivedContext = ctx;
				return Result.ok({ received: true });
			},
		});

		server.registerTool(tool);

		await server.invokeTool("context-test", {});

		expect(receivedContext).toBeDefined();
		expect((receivedContext as { logger: unknown }).logger).toBeDefined();
		expect((receivedContext as { requestId: string }).requestId).toBeDefined();
		expect((receivedContext as { cwd: string }).cwd).toBeDefined();
	});

	it("handler receives signal in context", async () => {
		let receivedSignal: AbortSignal | undefined;

		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool = defineTool({
			name: "signal-test",
			description: "Test signal passing",
			inputSchema: z.object({}),
			handler: async (_input, ctx) => {
				receivedSignal = ctx.signal;
				return Result.ok({ received: true });
			},
		});

		server.registerTool(tool);

		const controller = new AbortController();
		await server.invokeTool("signal-test", {}, { signal: controller.signal });

		expect(receivedSignal).toBeDefined();
	});
});

// ============================================================================
// Error Translation Tests
// ============================================================================

describe("Error Translation", () => {
	it("ValidationError translates to MCP error format", async () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool = defineTool({
			name: "validation-error-tool",
			description: "Returns a validation error",
			inputSchema: z.object({}),
			handler: async (_input, _ctx) => {
				return Result.err(
					new ValidationError({
						message: "Invalid input",
						field: "email",
					}),
				);
			},
		});

		server.registerTool(tool);

		const result = await server.invokeTool("validation-error-tool", {});

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error._tag).toBe("McpError");
			expect(result.error.message).toContain("Invalid input");
		}
	});

	it("NotFoundError translates to MCP error format", async () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool = defineTool({
			name: "not-found-tool",
			description: "Returns a not found error",
			inputSchema: z.object({ id: z.string() }),
			handler: async (input, _ctx) => {
				return Result.err(
					new NotFoundError({
						message: `Item ${input.id} not found`,
						resourceType: "item",
						resourceId: input.id,
					}),
				);
			},
		});

		server.registerTool(tool);

		const result = await server.invokeTool("not-found-tool", { id: "abc123" });

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error.message).toContain("abc123");
			expect(result.error.message).toContain("not found");
		}
	});

	it("InternalError translates to MCP error format", async () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const tool = defineTool({
			name: "internal-error-tool",
			description: "Returns an internal error",
			inputSchema: z.object({}),
			handler: async (_input, _ctx) => {
				return Result.err(
					new InternalError({
						message: "Unexpected database error",
					}),
				);
			},
		});

		server.registerTool(tool);

		const result = await server.invokeTool("internal-error-tool", {});

		expect(result.isErr()).toBe(true);
		if (result.isErr()) {
			expect(result.error._tag).toBe("McpError");
		}
	});

	it("McpError includes error code", () => {
		const error = new McpError({
			message: "Method not found",
			code: -32601,
		});

		expect(error.code).toBe(-32601);
	});

	it("McpError includes optional context", () => {
		const error = new McpError({
			message: "Invalid params",
			code: -32602,
			context: { param: "id", reason: "must be string" },
		});

		expect(error.context).toBeDefined();
		expect(error.context?.param).toBe("id");
	});
});

// ============================================================================
// Resource Definition Tests
// ============================================================================

describe("Resource Definition", () => {
	it("defineResource returns the resource definition", () => {
		const resource = defineResource({
			uri: "file:///config.json",
			name: "Config File",
			description: "Application configuration",
			mimeType: "application/json",
		});

		expect(resource.uri).toBe("file:///config.json");
		expect(resource.name).toBe("Config File");
	});

	it("registerResource adds resource to server", () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const resource = defineResource({
			uri: "file:///data.txt",
			name: "Data File",
		});

		server.registerResource(resource);

		const resources = server.getResources();
		expect(resources.length).toBe(1);
		expect(resources[0].uri).toBe("file:///data.txt");
	});

	it("multiple resources can be registered", () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		server.registerResource(defineResource({ uri: "file:///a.txt", name: "A" }));
		server.registerResource(defineResource({ uri: "file:///b.txt", name: "B" }));

		const resources = server.getResources();
		expect(resources.length).toBe(2);
	});
});

// ============================================================================
// Pagination Support Tests
// ============================================================================

describe("Pagination Support", () => {
	it("tool can return paginated results with cursor", async () => {
		const server = createMcpServer({
			name: "test-server",
			version: "1.0.0",
		});

		const items = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));

		const tool = defineTool({
			name: "list-items",
			description: "List items with pagination",
			inputSchema: z.object({
				cursor: z.string().optional(),
				limit: z.number().default(10),
			}),
			handler: async (input, _ctx) => {
				const offset = input.cursor ? Number.parseInt(input.cursor, 10) : 0;
				const limit = input.limit;
				const page = items.slice(offset, offset + limit);
				const nextCursor = offset + limit < items.length ? String(offset + limit) : null;

				return Result.ok({
					items: page,
					nextCursor,
					hasMore: nextCursor !== null,
				});
			},
		});

		server.registerTool(tool);

		// First page
		const result1 = await server.invokeTool("list-items", { limit: 10 });
		expect(result1.isOk()).toBe(true);
		if (result1.isOk()) {
			expect(result1.value.items.length).toBe(10);
			expect(result1.value.nextCursor).toBe("10");
			expect(result1.value.hasMore).toBe(true);
		}

		// Second page
		const result2 = await server.invokeTool("list-items", { cursor: "10", limit: 10 });
		expect(result2.isOk()).toBe(true);
		if (result2.isOk()) {
			expect(result2.value.items.length).toBe(10);
			expect(result2.value.items[0].id).toBe(11);
		}
	});
});

// ============================================================================
// Integration Tests
// ============================================================================

describe("Integration", () => {
	it("full workflow: create server, register tools, invoke", async () => {
		const server = createMcpServer({
			name: "calculator",
			version: "1.0.0",
		});

		// Register multiple tools
		server.registerTool(
			defineTool({
				name: "add",
				description: "Add numbers",
				inputSchema: z.object({ a: z.number(), b: z.number() }),
				handler: async (input) => Result.ok({ result: input.a + input.b }),
			}),
		);

		server.registerTool(
			defineTool({
				name: "multiply",
				description: "Multiply numbers",
				inputSchema: z.object({ a: z.number(), b: z.number() }),
				handler: async (input) => Result.ok({ result: input.a * input.b }),
			}),
		);

		// Verify tools registered
		expect(server.getTools().length).toBe(2);

		// Invoke tools
		const addResult = await server.invokeTool("add", { a: 5, b: 3 });
		expect(addResult.isOk()).toBe(true);
		if (addResult.isOk()) {
			expect(addResult.value.result).toBe(8);
		}

		const mulResult = await server.invokeTool("multiply", { a: 4, b: 7 });
		expect(mulResult.isOk()).toBe(true);
		if (mulResult.isOk()) {
			expect(mulResult.value.result).toBe(28);
		}
	});
});
