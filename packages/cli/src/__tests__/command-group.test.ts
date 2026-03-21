import { describe, expect, test } from "bun:test";

import { command, commandGroup, createCLI } from "../command.js";

describe("commandGroup", () => {
  test("creates parent with child commands", () => {
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
    expect(group.commands.length).toBe(2);
    expect(group.commands[0]!.name()).toBe("add");
    expect(group.commands[1]!.name()).toBe("show");
  });

  test("works with register()", () => {
    const cli = createCLI({ name: "test", version: "0.1.0" });

    cli.register(
      commandGroup("entity", "Manage entities", [
        command("add")
          .description("Add")
          .action(async () => {}),
      ])
    );

    const registered = cli.program.commands.some((c) => c.name() === "entity");
    expect(registered).toBe(true);

    const entity = cli.program.commands.find((c) => c.name() === "entity");
    expect(entity?.commands.length).toBe(1);
    expect(entity?.commands[0]!.name()).toBe("add");
  });

  test("returns a Command instance (not CommandBuilder)", () => {
    const group = commandGroup("test", "Test", []);
    // Should be a raw Commander Command, which register() also accepts
    expect(group.name()).toBe("test");
    expect(typeof group.addCommand).toBe("function");
  });

  test("handles empty children array", () => {
    const group = commandGroup("empty", "Empty group", []);

    expect(group.name()).toBe("empty");
    expect(group.description()).toBe("Empty group");
    expect(group.commands.length).toBe(0);
  });
});
