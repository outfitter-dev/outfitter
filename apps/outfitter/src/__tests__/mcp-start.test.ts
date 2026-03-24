/**
 * Tests for the `outfitter mcp start` command and MCP action definitions.
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { buildMcpTools } from "@outfitter/mcp";

import { outfitterActions } from "../actions.js";
import { createMcpCommand } from "../commands/mcp-start.js";

// ---------------------------------------------------------------------------
// MCP Action Registration
// ---------------------------------------------------------------------------

describe("MCP action registration", () => {
  test("registry contains mcp.docs.list action with mcp surface", () => {
    const action = outfitterActions.get("mcp.docs.list");
    expect(action).toBeDefined();
    expect(action?.surfaces).toContain("mcp");
  });

  test("registry contains mcp.docs.show action with mcp surface", () => {
    const action = outfitterActions.get("mcp.docs.show");
    expect(action).toBeDefined();
    expect(action?.surfaces).toContain("mcp");
  });

  test("registry contains mcp.docs.search action with mcp surface", () => {
    const action = outfitterActions.get("mcp.docs.search");
    expect(action).toBeDefined();
    expect(action?.surfaces).toContain("mcp");
  });

  test("MCP actions do not include cli surface", () => {
    for (const id of [
      "mcp.docs.list",
      "mcp.docs.show",
      "mcp.docs.search",
    ] as const) {
      const action = outfitterActions.get(id);
      expect(action?.surfaces).not.toContain("cli");
    }
  });
});

// ---------------------------------------------------------------------------
// MCP Tool Building
// ---------------------------------------------------------------------------

describe("buildMcpTools from registry", () => {
  test("builds one tool per mcp-surface action in the registry", () => {
    const tools = buildMcpTools(outfitterActions);
    const mcpActionCount = outfitterActions.forSurface("mcp").length;
    expect(tools).toHaveLength(mcpActionCount);
  });

  test("tool names match expected MCP tool names", () => {
    const tools = buildMcpTools(outfitterActions);
    const names = tools.map((t) => t.name).toSorted();
    expect(names).toEqual(["get_doc", "list_docs", "search_docs"]);
  });

  test("all docs tools have readOnlyHint annotation", () => {
    const tools = buildMcpTools(outfitterActions);
    for (const tool of tools) {
      expect(tool.annotations).toBeDefined();
      expect(tool.annotations?.readOnlyHint).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// MCP Command
// ---------------------------------------------------------------------------

describe("createMcpCommand", () => {
  test("creates mcp command with start subcommand", () => {
    const mcpCmd = createMcpCommand();
    expect(mcpCmd.name()).toBe("mcp");

    const subcommands = mcpCmd.commands.map((c) => c.name());
    expect(subcommands).toContain("start");
  });

  test("mcp command has description", () => {
    const mcpCmd = createMcpCommand();
    expect(mcpCmd.description()).toBeTruthy();
  });
});
