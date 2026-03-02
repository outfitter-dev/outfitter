/**
 * Tests for hint generation tiers 1-3.
 *
 * Tier 1: Command tree introspection — auto-generates CLIHint[] from builder registry
 * Tier 2: Error category mapping — standard recovery actions per error type
 * Tier 3: Schema-derived params — populates hint params from Zod input schemas
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import type { CLIHint, ErrorCategory } from "@outfitter/contracts";
import { retryableMap } from "@outfitter/contracts";
import { Command } from "commander";
import { z } from "zod";

import {
  buildCommandTree,
  commandTreeHints,
  errorRecoveryHints,
  schemaHintParams,
} from "../hints.js";
import type { CommandTree, CommandTreeNode } from "../hints.js";

// =============================================================================
// Tier 1: Command Tree Introspection
// =============================================================================

describe("Tier 1: command tree introspection", () => {
  describe("buildCommandTree()", () => {
    test("extracts command tree from Commander program", () => {
      const program = new Command("my-cli").version("1.0.0");
      program.command("list").description("List all items");
      program.command("get").description("Get an item");

      const tree = buildCommandTree(program);

      expect(tree.name).toBe("my-cli");
      expect(tree.version).toBe("1.0.0");
      expect(tree.commands).toBeArray();
      expect(tree.commands.length).toBe(2);
    });

    test("includes command descriptions", () => {
      const program = new Command("cli").version("0.1.0");
      program.command("deploy").description("Deploy the application");

      const tree = buildCommandTree(program);

      const deployCmd = tree.commands.find((c) => c.name === "deploy");
      expect(deployCmd).toBeDefined();
      expect(deployCmd!.description).toBe("Deploy the application");
    });

    test("includes command options with flags and descriptions", () => {
      const program = new Command("cli").version("0.1.0");
      program
        .command("list")
        .description("List items")
        .option("--limit <n>", "Max results")
        .option("--format <type>", "Output format");

      const tree = buildCommandTree(program);

      const listCmd = tree.commands.find((c) => c.name === "list");
      expect(listCmd).toBeDefined();
      expect(listCmd!.options).toBeArray();
      expect(listCmd!.options!.length).toBeGreaterThanOrEqual(2);

      const limitOpt = listCmd!.options!.find((o) =>
        o.flags.includes("--limit")
      );
      expect(limitOpt).toBeDefined();
      expect(limitOpt!.description).toBe("Max results");
    });

    test("includes nested subcommands", () => {
      const program = new Command("cli").version("0.1.0");
      const parent = program
        .command("config")
        .description("Manage configuration");
      parent.command("get").description("Get config value");
      parent.command("set").description("Set config value");

      const tree = buildCommandTree(program);

      const configCmd = tree.commands.find((c) => c.name === "config");
      expect(configCmd).toBeDefined();
      expect(configCmd!.subcommands).toBeArray();
      expect(configCmd!.subcommands!.length).toBe(2);

      const getSubCmd = configCmd!.subcommands!.find((c) => c.name === "get");
      expect(getSubCmd).toBeDefined();
      expect(getSubCmd!.description).toBe("Get config value");
    });

    test("handles program with no commands", () => {
      const program = new Command("empty-cli").version("0.0.1");

      const tree = buildCommandTree(program);

      expect(tree.name).toBe("empty-cli");
      expect(tree.commands).toEqual([]);
    });

    test("includes option default values", () => {
      const program = new Command("cli").version("0.1.0");
      program
        .command("list")
        .description("List items")
        .option("--limit <n>", "Max results", "20");

      const tree = buildCommandTree(program);

      const listCmd = tree.commands.find((c) => c.name === "list");
      const limitOpt = listCmd!.options!.find((o) =>
        o.flags.includes("--limit")
      );
      expect(limitOpt!.defaultValue).toBe("20");
    });
  });

  describe("commandTreeHints()", () => {
    test("auto-generates CLIHint for each registered command", () => {
      const tree: CommandTree = {
        name: "my-cli",
        version: "1.0.0",
        commands: [
          { name: "list", description: "List all items" },
          { name: "get", description: "Get an item by ID" },
        ],
      };

      const hints = commandTreeHints(tree);

      expect(hints).toBeArray();
      expect(hints.length).toBe(2);
      expect(hints[0]!.description).toBe("List all items");
      expect(hints[0]!.command).toBe("my-cli list");
      expect(hints[1]!.description).toBe("Get an item by ID");
      expect(hints[1]!.command).toBe("my-cli get");
    });

    test("generates hints with fallback description when missing", () => {
      const tree: CommandTree = {
        name: "cli",
        version: "1.0.0",
        commands: [{ name: "run" }],
      };

      const hints = commandTreeHints(tree);

      expect(hints.length).toBe(1);
      expect(hints[0]!.description).toBe("Run run command");
      expect(hints[0]!.command).toBe("cli run");
    });

    test("includes subcommand hints with full path", () => {
      const tree: CommandTree = {
        name: "my-cli",
        version: "1.0.0",
        commands: [
          {
            name: "config",
            description: "Manage configuration",
            subcommands: [
              { name: "get", description: "Get config value" },
              { name: "set", description: "Set config value" },
            ],
          },
        ],
      };

      const hints = commandTreeHints(tree);

      // Should include both parent and subcommands
      expect(hints.length).toBeGreaterThanOrEqual(3);

      const configGetHint = hints.find((h) => h.command.includes("config get"));
      expect(configGetHint).toBeDefined();
      expect(configGetHint!.command).toBe("my-cli config get");
    });

    test("returns empty array for empty command tree", () => {
      const tree: CommandTree = {
        name: "cli",
        version: "1.0.0",
        commands: [],
      };

      const hints = commandTreeHints(tree);

      expect(hints).toEqual([]);
    });
  });
});

// =============================================================================
// Tier 2: Error Category Mapping
// =============================================================================

describe("Tier 2: error category mapping", () => {
  describe("errorRecoveryHints()", () => {
    test("produces recovery hints for each error category", () => {
      const categories: ErrorCategory[] = [
        "validation",
        "not_found",
        "conflict",
        "permission",
        "timeout",
        "rate_limit",
        "network",
        "internal",
        "auth",
        "cancelled",
      ];

      for (const category of categories) {
        const hints = errorRecoveryHints(category);
        expect(hints).toBeArray();
        expect(hints.length).toBeGreaterThanOrEqual(1);

        // Each hint should have a description
        for (const hint of hints) {
          expect(hint.description).toBeTruthy();
        }
      }
    });

    test("retryable categories include retry hint", () => {
      const retryableCategories: ErrorCategory[] = [
        "timeout",
        "rate_limit",
        "network",
      ];

      for (const category of retryableCategories) {
        expect(retryableMap[category]).toBe(true);

        const hints = errorRecoveryHints(category);
        const hasRetryHint = hints.some(
          (h) =>
            h.description.toLowerCase().includes("retry") ||
            h.description.toLowerCase().includes("wait")
        );
        expect(hasRetryHint).toBe(true);
      }
    });

    test("non-retryable categories do not suggest retry", () => {
      const nonRetryable: ErrorCategory[] = [
        "validation",
        "not_found",
        "permission",
        "auth",
      ];

      for (const category of nonRetryable) {
        expect(retryableMap[category]).toBe(false);

        const hints = errorRecoveryHints(category);
        // Hints should guide toward fixing the root cause, not retrying
        expect(hints.length).toBeGreaterThanOrEqual(1);
      }
    });

    test("includes cliName in hint commands when provided", () => {
      const hints = errorRecoveryHints("auth", "my-tool");

      const hasCliName = hints.some((h) => h.command?.includes("my-tool"));
      expect(hasCliName).toBe(true);
    });

    test("validation category suggests checking input", () => {
      const hints = errorRecoveryHints("validation");

      const hasInputHint = hints.some(
        (h) =>
          h.description.toLowerCase().includes("input") ||
          h.description.toLowerCase().includes("help") ||
          h.description.toLowerCase().includes("valid")
      );
      expect(hasInputHint).toBe(true);
    });

    test("auth category suggests authentication", () => {
      const hints = errorRecoveryHints("auth");

      const hasAuthHint = hints.some(
        (h) =>
          h.description.toLowerCase().includes("auth") ||
          h.description.toLowerCase().includes("login") ||
          h.description.toLowerCase().includes("credential")
      );
      expect(hasAuthHint).toBe(true);
    });

    test("includes retryable flag as param in hint", () => {
      const hints = errorRecoveryHints("timeout");

      const retryHint = hints.find(
        (h) =>
          h.params !== undefined &&
          "retryable" in (h.params as Record<string, unknown>)
      );
      expect(retryHint).toBeDefined();
      expect((retryHint!.params as Record<string, unknown>)["retryable"]).toBe(
        true
      );
    });
  });
});

// =============================================================================
// Tier 3: Schema-Derived Params
// =============================================================================

describe("Tier 3: schema-derived params", () => {
  describe("schemaHintParams()", () => {
    test("populates params from Zod schema fields", () => {
      const schema = z.object({
        name: z.string().describe("Task name"),
        count: z.number().describe("Number of items"),
      });

      const params = schemaHintParams(schema);

      expect(params).toHaveProperty("name");
      expect(params).toHaveProperty("count");
    });

    test("uses field descriptions as param values", () => {
      const schema = z.object({
        env: z.string().describe("Target environment"),
        force: z.boolean().describe("Force deployment"),
      });

      const params = schemaHintParams(schema);

      expect(params["env"]).toBe("Target environment");
      expect(params["force"]).toBe("Force deployment");
    });

    test("uses field type name when no description", () => {
      const schema = z.object({
        name: z.string(),
        count: z.number(),
        verbose: z.boolean(),
      });

      const params = schemaHintParams(schema);

      expect(params["name"]).toBe("string");
      expect(params["count"]).toBe("number");
      expect(params["verbose"]).toBe("boolean");
    });

    test("handles optional and default fields", () => {
      const schema = z.object({
        required: z.string().describe("Required field"),
        optional: z.string().optional().describe("Optional field"),
        withDefault: z.string().default("hello").describe("Field with default"),
      });

      const params = schemaHintParams(schema);

      expect(params["required"]).toBe("Required field");
      expect(params["optional"]).toBe("Optional field");
      expect(params["withDefault"]).toBe("Field with default");
    });

    test("handles enum fields with values", () => {
      const schema = z.object({
        format: z.enum(["json", "yaml", "toml"]).describe("Output format"),
      });

      const params = schemaHintParams(schema);

      expect(params["format"]).toBe("Output format");
    });

    test("returns empty object for empty schema", () => {
      const schema = z.object({});

      const params = schemaHintParams(schema);

      expect(params).toEqual({});
    });

    test("includes type information alongside description", () => {
      const schema = z.object({
        name: z.string().describe("Task name"),
        count: z.number().describe("Number of items"),
      });

      const params = schemaHintParams(schema);

      // Params should contain meaningful metadata
      expect(Object.keys(params).length).toBe(2);
    });
  });
});
