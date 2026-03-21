/**
 * Tests for commandGroup() declarative command grouping.
 */

import { describe, expect, test } from "bun:test";

import { Command } from "commander";
import { z } from "zod";

import { command, commandGroup } from "../command.js";

describe("commandGroup", () => {
  test("creates parent with child subcommands", () => {
    const group = commandGroup("entity", "Manage entities", [
      command("add")
        .description("Add entity")
        .action(async () => {}),
      command("show")
        .description("Show entity")
        .action(async () => {}),
    ]);

    expect(group.name()).toBe("entity");
    expect(group.description()).toBe("Manage entities");

    const names = group.commands.map((c) => c.name());
    expect(names).toEqual(["add", "show"]);
  });

  test("returns a Commander Command (registrable directly)", () => {
    const group = commandGroup("test", "Test", [
      command("sub")
        .description("Sub")
        .action(async () => {}),
    ]);

    // Should be a Commander Command, not a CommandBuilder
    expect(group).toBeInstanceOf(Command);
    expect(typeof group.addCommand).toBe("function");
  });

  test("handles empty children array", () => {
    const group = commandGroup("empty", "Empty group", []);
    expect(group.name()).toBe("empty");
    expect(group.commands).toHaveLength(0);
  });

  test("children with typed input schemas derive flags", () => {
    const schema = z.object({ query: z.string().describe("Search query") });

    const group = commandGroup("search", "Search commands", [
      command("full")
        .description("Full search")
        .input(schema)
        .action(async () => {}),
    ]);

    const fullCmd = group.commands[0]!;
    expect(fullCmd.options.some((o) => o.long === "--query")).toBe(true);
  });
});
