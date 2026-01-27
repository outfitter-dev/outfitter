/**
 * Tests for CLI core helpers.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from "bun:test";
import { createCLI } from "../cli.js";
import { command } from "../command.js";

describe("createCLI()", () => {
  it("sets name and description on the program", () => {
    const cli = createCLI({
      name: "outfitter",
      version: "0.1.0-rc.0",
      description: "Outfitter CLI",
    });

    expect(cli.program.name()).toBe("outfitter");
    expect(cli.program.description()).toBe("Outfitter CLI");
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
});
