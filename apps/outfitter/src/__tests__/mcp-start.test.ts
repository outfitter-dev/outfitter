/**
 * Tests for `outfitter mcp start` — command registration and tool setup.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { createMcpServer } from "@outfitter/mcp";

import {
  createMcpCommand,
  MCP_TOOL_COUNT,
  registerMcpTools,
} from "../commands/mcp-start.js";

describe("mcp command group", () => {
  test("creates 'mcp' command group", () => {
    const command = createMcpCommand();
    expect(command.name()).toBe("mcp");
    expect(command.description()).toBe("MCP server management");
  });

  test("has 'start' subcommand", () => {
    const command = createMcpCommand();
    const startCmd = command.commands.find((c) => c.name() === "start");
    expect(startCmd).toBeDefined();
    expect(startCmd?.description()).toBe("Start MCP server (stdio transport)");
  });
});

describe("registerMcpTools", () => {
  test("registers the expected number of tools", () => {
    const server = createMcpServer({
      name: "test-outfitter",
      version: "0.0.0",
    });

    registerMcpTools(server);

    const tools = server.getTools();
    expect(tools).toHaveLength(MCP_TOOL_COUNT);
  });

  test("registers all expected tool names", () => {
    const server = createMcpServer({
      name: "test-outfitter",
      version: "0.0.0",
    });

    registerMcpTools(server);

    const toolNames = server.getTools().map((t) => t.name);
    expect(toolNames).toContain("search_docs");
    expect(toolNames).toContain("get_doc");
    expect(toolNames).toContain("list_docs");
    expect(toolNames).toContain("index_docs");
    expect(toolNames).toContain("list_actions");
    expect(toolNames).toContain("get_action");
  });

  test("all doc tools have readOnlyHint annotation", () => {
    const server = createMcpServer({
      name: "test-outfitter",
      version: "0.0.0",
    });

    registerMcpTools(server);

    const tools = server.getTools();
    const readOnlyTools = [
      "search_docs",
      "get_doc",
      "list_docs",
      "list_actions",
      "get_action",
    ];

    for (const name of readOnlyTools) {
      const tool = tools.find((t) => t.name === name);
      expect(tool?.annotations?.readOnlyHint).toBe(true);
    }
  });

  test("index_docs tool is not marked readOnly", () => {
    const server = createMcpServer({
      name: "test-outfitter",
      version: "0.0.0",
    });

    registerMcpTools(server);

    const tool = server.getTools().find((t) => t.name === "index_docs");
    expect(tool?.annotations?.readOnlyHint).not.toBe(true);
  });
});
