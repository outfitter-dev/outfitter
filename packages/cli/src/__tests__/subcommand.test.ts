/**
 * Tests for CommandBuilder.subcommand() nested command support.
 *
 * Covers:
 * - Parent command with nested subcommands via .subcommand()
 * - Chainable .subcommand() calls
 * - Works with register() on a CLI instance
 * - Parent without action acts as group command
 * - Parent with action and subcommands (default + sub-paths)
 *
 * @packageDocumentation
 */

import { describe, expect, test } from "bun:test";

import { command, createCLI } from "../command.js";

// =============================================================================
// .subcommand() — nested command registration
// =============================================================================

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

    expect(parent.name()).toBe("entity");
    expect(parent.commands.length).toBe(2);
    expect(parent.commands[0]!.name()).toBe("add");
    expect(parent.commands[1]!.name()).toBe("show");
  });

  test("subcommand calls are chainable", () => {
    const builder = command("entity")
      .description("Manage entities")
      .subcommand(
        command("add")
          .description("Add")
          .action(async () => {})
      )
      .subcommand(
        command("show")
          .description("Show")
          .action(async () => {})
      );

    // Should return same builder for chaining — verify it builds successfully
    const cmd = builder.build();
    expect(cmd.name()).toBe("entity");
    expect(cmd.commands.length).toBe(2);
  });

  test("works with register()", () => {
    const cli = createCLI({
      name: "test",
      version: "0.1.0",
      onExit: () => {},
    });

    cli.register(
      command("entity")
        .description("Manage entities")
        .subcommand(
          command("add")
            .description("Add")
            .action(async () => {})
        )
    );

    const registered = cli.program.commands.some((c) => c.name() === "entity");
    expect(registered).toBe(true);

    const entityCmd = cli.program.commands.find((c) => c.name() === "entity");
    expect(entityCmd).toBeDefined();
    expect(entityCmd!.commands.length).toBe(1);
    expect(entityCmd!.commands[0]!.name()).toBe("add");
  });

  test("parent without action acts as group command", () => {
    const parent = command("config")
      .description("Manage configuration")
      .subcommand(
        command("get")
          .description("Get a value")
          .action(async () => {})
      )
      .subcommand(
        command("set")
          .description("Set a value")
          .action(async () => {})
      )
      .build();

    expect(parent.name()).toBe("config");
    expect(parent.commands.length).toBe(2);
  });

  test("parent with action and subcommands both work", () => {
    let parentCalled = false;

    const parent = command("status")
      .description("Show status")
      .action(async () => {
        parentCalled = true;
      })
      .subcommand(
        command("detail")
          .description("Detailed status")
          .action(async () => {})
      )
      .build();

    expect(parent.name()).toBe("status");
    expect(parent.commands.length).toBe(1);
    expect(parent.commands[0]!.name()).toBe("detail");
    // parentCalled is not invoked here — just verifying structure
    expect(parentCalled).toBe(false);
  });

  test("chains with other builder methods", () => {
    const cmd = command("resource")
      .description("Manage resources")
      .readOnly(true)
      .subcommand(
        command("list")
          .description("List resources")
          .readOnly(true)
          .action(async () => {})
      )
      .subcommand(
        command("get <id>")
          .description("Get a resource")
          .readOnly(true)
          .action(async () => {})
      )
      .build();

    expect(cmd.name()).toBe("resource");
    expect(cmd.commands.length).toBe(2);
    expect(cmd.commands[0]!.name()).toBe("list");
    expect(cmd.commands[1]!.name()).toBe("get");
  });
});
