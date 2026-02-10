/**
 * Tests for CLI core helpers.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from "bun:test";
import { type CLI, command, createCLI } from "../command.js";

describe("createCLI()", () => {
  it("sets name and description on the program", () => {
    const cli: CLI = createCLI({
      name: "outfitter",
      version: "0.1.0-rc.0",
      description: "Outfitter CLI",
    });

    expect(cli.program.name()).toBe("outfitter");
    expect(cli.program.description()).toBe("Outfitter CLI");
  });

  it("awaits async onExit handlers", async () => {
    const exitCodes: number[] = [];
    const cli = createCLI({
      name: "outfitter",
      version: "0.1.0-rc.0",
      onExit: async (code) => {
        await Promise.resolve();
        exitCodes.push(code);
      },
    });

    cli.program.configureOutput({
      writeErr: () => undefined,
    });

    await cli.parse(["node", "outfitter", "--unknown-flag"]);
    expect(exitCodes).toEqual([1]);
  });
});

describe("command()", () => {
  it("registers commands on the program", () => {
    const cli = createCLI({ name: "test", version: "0.1.0-rc.0" });

    cli.register(
      command("hello")
        .description("Say hello")
        .action(() => {
          // no-op
        })
    );

    const registered = cli.program.commands.some(
      (cmd) => cmd.name() === "hello"
    );
    expect(registered).toBe(true);
  });

  it("normalizes command names when arguments are included", () => {
    const cli = createCLI({ name: "test", version: "0.1.0-rc.0" });

    cli.register(
      command("get <id>")
        .description("Get by id")
        .action(() => {
          // no-op
        })
    );

    const registered = cli.program.commands.some((cmd) => cmd.name() === "get");
    expect(registered).toBe(true);
  });

  it("parses command signature and preserves positional arguments", async () => {
    const cli = createCLI({ name: "test", version: "0.1.0-rc.0" });
    let receivedArgs: readonly string[] = [];

    cli.register(
      command("hello [name]")
        .description("Say hello")
        .action(async ({ args }) => {
          receivedArgs = args;
        })
    );

    await cli.parse(["node", "test", "hello", "World"]);

    const registered = cli.program.commands.find(
      (cmd) => cmd.name() === "hello"
    );
    expect(registered).toBeDefined();
    expect(registered?.name()).toBe("hello");
    expect(receivedArgs).toEqual(["World"]);
  });
});
