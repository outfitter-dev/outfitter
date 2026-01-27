/**
 * @outfitter/testing - MCP Harness Test Suite
 *
 * Verifies MCP harness behavior for tool invocation, listing,
 * searching, and fixture loading.
 */

import { describe, expect, it } from "bun:test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Result } from "@outfitter/contracts";
import {
  defineTool,
  McpError,
  type McpServer,
  type SerializedTool,
} from "@outfitter/mcp";
import { z } from "zod";
import {
  createMCPTestHarness,
  createMcpHarness,
  createMcpTestHarness,
  type McpToolResponse,
} from "../mcp-harness.js";

// ============================================================================
// Test Fixtures: Mock MCP Server
// ============================================================================

function createMockServer(
  tools: SerializedTool[],
  handlers: Record<
    string,
    (
      input: Record<string, unknown>
    ) => Result<McpToolResponse, InstanceType<typeof McpError>>
  >
): McpServer {
  return {
    name: "test-server",
    version: "0.0.0",
    registerTool() {
      // no-op for test mock
    },
    registerResource() {
      // no-op for test mock
    },
    getTools() {
      return tools;
    },
    getResources() {
      return [];
    },
    async invokeTool(name, input) {
      const handler = handlers[name];
      if (!handler) {
        return Result.err(
          new McpError({ message: `Tool not found: ${name}`, code: -32_601 })
        );
      }
      return handler(input as Record<string, unknown>);
    },
    async start() {
      // no-op for test mock
    },
    async stop() {
      // no-op for test mock
    },
  };
}

const fixturesDir = join(
  dirname(fileURLToPath(import.meta.url)),
  "__fixtures__"
);

// ============================================================================
// Tests
// ============================================================================

describe("createMcpHarness()", () => {
  it("creates a harness with expected methods", () => {
    const server = createMockServer([], {});
    const harness = createMcpHarness(server);

    expect(harness.callTool).toBeDefined();
    expect(harness.listTools).toBeDefined();
    expect(harness.searchTools).toBeDefined();
    expect(harness.loadFixture).toBeDefined();
    expect(harness.reset).toBeDefined();
  });
});

describe("createMCPTestHarness()", () => {
  it("builds a server from tool definitions", async () => {
    const tool = defineTool({
      name: "echo",
      description: "Echo input back",
      inputSchema: z.object({ value: z.string() }),
      handler: async (input) =>
        Result.ok({
          content: [{ type: "text", text: input.value }],
        }),
    });

    const harness = createMCPTestHarness({ tools: [tool] });
    const result = await harness.callTool("echo", { value: "hello" });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().content[0].text).toBe("hello");
  });

  it("supports alternate casing alias", () => {
    expect(createMcpTestHarness).toBe(createMCPTestHarness);
  });
});

describe("McpHarness tool invocation", () => {
  it("returns MCP-formatted content on success", async () => {
    const tools: SerializedTool[] = [
      {
        name: "add",
        description: "Add two numbers",
        inputSchema: { type: "object", properties: {} },
      },
    ];

    const server = createMockServer(tools, {
      add: (input) => {
        const { a, b } = input as { a: number; b: number };
        return Result.ok({
          content: [{ type: "text", text: JSON.stringify({ sum: a + b }) }],
        });
      },
    });

    const harness = createMcpHarness(server);
    const result = await harness.callTool("add", { a: 2, b: 3 });

    expect(result.isOk()).toBe(true);
    const data = JSON.parse(result.unwrap().content[0].text ?? "{}");
    expect(data.sum).toBe(5);
  });

  it("returns Err for unknown tools", async () => {
    const server = createMockServer([], {});
    const harness = createMcpHarness(server);

    const result = await harness.callTool("missing", {});

    expect(result.isErr()).toBe(true);
    expect(result.error.code).toBe(-32_601);
  });
});

describe("McpHarness discovery", () => {
  const tools: SerializedTool[] = [
    {
      name: "note_get",
      description: "Retrieve a note by ID",
      inputSchema: { type: "object", properties: { id: { type: "string" } } },
    },
    {
      name: "note_search",
      description: "Search notes by content",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string" } },
      },
    },
  ];

  it("lists all tools with schemas", () => {
    const server = createMockServer(tools, {});
    const harness = createMcpHarness(server);

    const list = harness.listTools();
    expect(list).toHaveLength(2);
    expect(list[0]?.inputSchema).toBeDefined();
  });

  it("searches tools by name or description", () => {
    const server = createMockServer(tools, {});
    const harness = createMcpHarness(server);

    expect(harness.searchTools("search")).toHaveLength(1);
    expect(harness.searchTools("note")).toHaveLength(2);
  });
});

describe("McpHarness fixtures", () => {
  it("loads fixtures from __fixtures__", () => {
    const server = createMockServer([], {});
    const harness = createMcpHarness(server, { fixturesDir });

    const note = harness.loadFixture<{ id: string; title: string }>(
      "mcp/notes.json"
    );
    expect(note.id).toBe("note-1");
  });

  it("reset is a no-op by default", () => {
    const server = createMockServer([], {});
    const harness = createMcpHarness(server);

    expect(() => harness.reset()).not.toThrow();
  });
});
