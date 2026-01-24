/**
 * @outfitter/testing - MCP Harness
 *
 * Test harness for MCP (Model Context Protocol) servers.
 * Provides a high-level interface for invoking tools, listing tools,
 * searching by description, and loading fixtures for tests.
 *
 * @packageDocumentation
 */

import type { KitError, Result } from "@outfitter/contracts";
import {
	createMcpServer,
	type McpError,
	type McpServer,
	type SerializedTool,
	type ToolDefinition,
} from "@outfitter/mcp";
import { loadFixture } from "./fixtures.js";

// ============================================================================
// Types
// ============================================================================

/**
 * MCP tool response content.
 * Matches the MCP protocol shape used in the spec.
 */
export interface McpToolResponse {
	content: Array<{ type: "text" | "image"; text?: string; data?: string }>;
	isError?: boolean;
}

/**
 * Test harness for MCP servers.
 */
export interface McpHarness {
	/**
	 * Call a tool by name with input parameters.
	 * Returns the MCP-formatted response.
	 */
	callTool(
		name: string,
		input: Record<string, unknown>,
	): Promise<Result<McpToolResponse, InstanceType<typeof McpError>>>;

	/**
	 * List all registered tools with schemas.
	 */
	listTools(): SerializedTool[];

	/**
	 * Search tools by name or description (case-insensitive).
	 */
	searchTools(query: string): SerializedTool[];

	/**
	 * Load fixture data by name (relative to __fixtures__).
	 */
	loadFixture<T = string>(name: string): T;

	/**
	 * Reset harness state between tests.
	 */
	reset(): void;
}

export interface McpHarnessOptions {
	/** Base fixtures directory (defaults to `${process.cwd()}/__fixtures__`). */
	readonly fixturesDir?: string;
}

export interface McpTestHarnessOptions {
	/** Tools to register on the test MCP server. */
	readonly tools: ToolDefinition<unknown, unknown, KitError>[];
	/** Base fixtures directory (defaults to `${process.cwd()}/__fixtures__`). */
	readonly fixturesDir?: string;
	/** Optional server name for diagnostics. */
	readonly name?: string;
	/** Optional server version for diagnostics. */
	readonly version?: string;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Creates an MCP test harness from an MCP server.
 */
export function createMcpHarness(server: McpServer, options: McpHarnessOptions = {}): McpHarness {
	return {
		async callTool(
			name: string,
			input: Record<string, unknown>,
		): Promise<Result<McpToolResponse, InstanceType<typeof McpError>>> {
			return server.invokeTool<McpToolResponse>(name, input);
		},

		listTools(): SerializedTool[] {
			return server.getTools();
		},

		searchTools(query: string): SerializedTool[] {
			const normalized = query.trim().toLowerCase();
			const tools = server.getTools();

			if (normalized.length === 0) {
				return tools;
			}

			return tools.filter((tool) => {
				const nameMatch = tool.name.toLowerCase().includes(normalized);
				const descriptionMatch = tool.description.toLowerCase().includes(normalized);
				return nameMatch || descriptionMatch;
			});
		},

		loadFixture<T = string>(name: string): T {
			return loadFixture<T>(
				name,
				options.fixturesDir ? { fixturesDir: options.fixturesDir } : undefined,
			);
		},

		reset(): void {
			// No internal state to reset in the default harness.
		},
	};
}

/**
 * Creates an MCP test harness from tool definitions.
 *
 * This is a spec-compatible wrapper that builds a test server,
 * registers tools, and returns the standard MCP harness.
 */
export function createMCPTestHarness(options: McpTestHarnessOptions): McpHarness {
	const server = createMcpServer({
		name: options.name ?? "mcp-test",
		version: options.version ?? "0.0.0",
	});

	for (const tool of options.tools) {
		server.registerTool(tool);
	}

	return createMcpHarness(server, {
		...(options.fixturesDir !== undefined ? { fixturesDir: options.fixturesDir } : {}),
	});
}

/**
 * Alias for createMCPTestHarness to support alternate casing.
 */
export const createMcpTestHarness = createMCPTestHarness;
