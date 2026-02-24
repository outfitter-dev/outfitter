/**
 * Tests for CLI core helpers.
 *
 * @packageDocumentation
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

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

describe("--json env var bridge", () => {
  let originalJson: string | undefined;

  beforeEach(() => {
    originalJson = process.env["OUTFITTER_JSON"];
    delete process.env["OUTFITTER_JSON"];
  });

  afterEach(() => {
    if (originalJson === undefined) {
      delete process.env["OUTFITTER_JSON"];
    } else {
      process.env["OUTFITTER_JSON"] = originalJson;
    }
  });

  it("global --json sets OUTFITTER_JSON env var", async () => {
    const cli = createCLI({ name: "test", version: "0.1.0-rc.0" });
    let envValue: string | undefined;

    cli.register(
      command("hello")
        .description("Say hello")
        .action(async () => {
          envValue = process.env["OUTFITTER_JSON"];
        })
    );

    await cli.parse(["node", "test", "--json", "hello"]);
    expect(envValue).toBe("1");
  });

  it("restores OUTFITTER_JSON after --json parse", async () => {
    const cli = createCLI({ name: "test", version: "0.1.0-rc.0" });

    cli.register(
      command("hello")
        .description("Say hello")
        .action(async () => undefined)
    );

    await cli.parse(["node", "test", "--json", "hello"]);
    expect(process.env["OUTFITTER_JSON"]).toBeUndefined();
  });

  it("restores existing OUTFITTER_JSON value after --json parse", async () => {
    process.env["OUTFITTER_JSON"] = "0";
    const cli = createCLI({ name: "test", version: "0.1.0-rc.0" });

    cli.register(
      command("hello")
        .description("Say hello")
        .action(async () => undefined)
    );

    await cli.parse(["node", "test", "--json", "hello"]);
    expect(process.env["OUTFITTER_JSON"]).toBe("0");
  });

  it("does not leak --json into subsequent parse calls", async () => {
    const cli = createCLI({ name: "test", version: "0.1.0-rc.0" });
    const envValues: (string | undefined)[] = [];

    cli.register(
      command("hello")
        .description("Say hello")
        .action(async () => {
          envValues.push(process.env["OUTFITTER_JSON"]);
        })
    );

    await cli.parse(["node", "test", "--json", "hello"]);
    await cli.parse(["node", "test", "hello"]);

    expect(envValues).toEqual(["1", undefined]);
  });

  it("does not set OUTFITTER_JSON when --json is not passed", async () => {
    const cli = createCLI({ name: "test", version: "0.1.0-rc.0" });
    let envValue: string | undefined;

    cli.register(
      command("hello")
        .description("Say hello")
        .action(async () => {
          envValue = process.env["OUTFITTER_JSON"];
        })
    );

    await cli.parse(["node", "test", "hello"]);
    expect(envValue).toBeUndefined();
  });
});
