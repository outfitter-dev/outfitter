/**
 * Tests for CommandBuilder.subcommand() nested command support.
 *
 * Covers:
 * - Parent command with nested subcommands via .subcommand()
 * - Chainable .subcommand() calls
 * - Subcommands with typed .input() schemas
 * - Build output includes subcommands as Commander children
 * - Parent with action and subcommands (default + sub-paths)
 */

import { describe, expect, test } from "bun:test";

import { z } from "zod";

import { command } from "../command.js";

// .subcommand() — nested command registration
// ─────────────────────────────────────────────

describe("CommandBuilder.subcommand()", () => {
  test("builds parent with nested subcommands", () => {
    const parent = command("entity")
      .description("Manage entities")
      .subcommand(
        command("add")
          .description("Add entity")
          .action(async () => {})
      )
      .subcommand(
        command("show")
          .description("Show entity")
          .action(async () => {})
      )
      .build();

    const names = parent.commands.map((c) => c.name());
    expect(names).toEqual(["add", "show"]);
  });

  test("subcommand calls are chainable (returns this)", () => {
    const original = command("parent").description("Parent");
    const chained = original.subcommand(
      command("a")
        .description("A")
        .action(async () => {})
    );

    // .subcommand() must return the same builder instance
    expect(chained).toBe(original);
    const parent = chained.build();
    expect(parent.commands).toHaveLength(1);
  });

  test("subcommands with typed input schemas", () => {
    const schema = z.object({ name: z.string() });

    const parent = command("entity")
      .description("Manage entities")
      .subcommand(
        command("add")
          .description("Add entity")
          .input(schema)
          .action(async () => {})
      )
      .build();

    expect(parent.commands).toHaveLength(1);
    expect(parent.commands[0]!.name()).toBe("add");
    // Schema-derived flag should be present on the subcommand
    const addOpts = parent.commands[0]!.options;
    expect(addOpts.some((o) => o.long === "--name")).toBe(true);
  });

  test("parent with action serves as default alongside subcommands", () => {
    const parent = command("config")
      .description("Manage configuration")
      .action(async () => {
        // Default action when no subcommand given
      })
      .subcommand(
        command("get")
          .description("Get value")
          .action(async () => {})
      )
      .subcommand(
        command("set")
          .description("Set value")
          .action(async () => {})
      )
      .build();

    expect(parent.commands).toHaveLength(2);
    const names = parent.commands.map((c) => c.name());
    expect(names).toEqual(["get", "set"]);
  });

  test("deeply nested subcommands", () => {
    const root = command("root")
      .description("Root")
      .subcommand(
        command("level1")
          .description("Level 1")
          .subcommand(
            command("level2")
              .description("Level 2")
              .action(async () => {})
          )
      )
      .build();

    expect(root.commands).toHaveLength(1);
    expect(root.commands[0]!.commands).toHaveLength(1);
    expect(root.commands[0]!.commands[0]!.name()).toBe("level2");
  });

  test("subcommands preserve safety metadata", () => {
    const parent = command("db")
      .description("Database operations")
      .subcommand(
        command("drop")
          .description("Drop table")
          .destructive(true)
          .action(async () => {})
      )
      .build();

    const drop = parent.commands[0]!;
    expect(drop.options.some((o) => o.long === "--dry-run")).toBe(true);
  });

  test("build() is idempotent — repeated calls do not duplicate subcommands", () => {
    const builder = command("parent")
      .description("Parent")
      .subcommand(
        command("sub")
          .description("Sub")
          .action(async () => {})
      );

    const first = builder.build();
    const second = builder.build();

    expect(first).toBe(second);
    expect(first.commands).toHaveLength(1);
  });
});
