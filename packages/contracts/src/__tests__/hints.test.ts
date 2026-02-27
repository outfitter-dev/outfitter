import { describe, expect, it } from "bun:test";

import type { ActionHint, CLIHint, MCPHint } from "../hints.js";

describe("hint types", () => {
  describe("ActionHint", () => {
    it("accepts description with no params", () => {
      const hint: ActionHint = {
        description: "Try running the command again",
      };

      expect(hint.description).toBe("Try running the command again");
      expect(hint.params).toBeUndefined();
    });

    it("accepts description with params", () => {
      const hint: ActionHint = {
        description: "Retry with different options",
        params: { retryCount: 3, verbose: true },
      };

      expect(hint.description).toBe("Retry with different options");
      expect(hint.params).toEqual({ retryCount: 3, verbose: true });
    });
  });

  describe("CLIHint", () => {
    it("extends ActionHint with command", () => {
      const hint: CLIHint = {
        description: "Run the lint command to check formatting",
        command: "outfitter lint --fix",
      };

      expect(hint.description).toBe("Run the lint command to check formatting");
      expect(hint.command).toBe("outfitter lint --fix");
      expect(hint.params).toBeUndefined();
    });

    it("accepts command with params", () => {
      const hint: CLIHint = {
        description: "Check specific package",
        command: "outfitter check --package @outfitter/cli",
        params: { package: "@outfitter/cli" },
      };

      expect(hint.command).toBe("outfitter check --package @outfitter/cli");
      expect(hint.params).toEqual({ package: "@outfitter/cli" });
    });

    it("is assignable to ActionHint", () => {
      const cliHint: CLIHint = {
        description: "Run check",
        command: "outfitter check",
      };

      // CLIHint extends ActionHint, so this assignment must work
      const actionHint: ActionHint = cliHint;
      expect(actionHint.description).toBe("Run check");
    });
  });

  describe("MCPHint", () => {
    it("extends ActionHint with tool", () => {
      const hint: MCPHint = {
        description: "Use the search tool to find resources",
        tool: "search",
      };

      expect(hint.description).toBe("Use the search tool to find resources");
      expect(hint.tool).toBe("search");
      expect(hint.input).toBeUndefined();
    });

    it("accepts tool with input", () => {
      const hint: MCPHint = {
        description: "Search for notes matching the query",
        tool: "search-notes",
        input: { query: "architecture", limit: 10 },
      };

      expect(hint.tool).toBe("search-notes");
      expect(hint.input).toEqual({ query: "architecture", limit: 10 });
    });

    it("accepts tool with params and input", () => {
      const hint: MCPHint = {
        description: "Use tool with full context",
        tool: "get-resource",
        input: { id: "abc123" },
        params: { format: "json" },
      };

      expect(hint.tool).toBe("get-resource");
      expect(hint.input).toEqual({ id: "abc123" });
      expect(hint.params).toEqual({ format: "json" });
    });

    it("is assignable to ActionHint", () => {
      const mcpHint: MCPHint = {
        description: "Use tool",
        tool: "my-tool",
      };

      // MCPHint extends ActionHint, so this assignment must work
      const actionHint: ActionHint = mcpHint;
      expect(actionHint.description).toBe("Use tool");
    });
  });
});
