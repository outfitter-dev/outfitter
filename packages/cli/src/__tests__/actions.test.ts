import { describe, expect, it } from "bun:test";
import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";
import { buildCliCommands } from "../actions.js";
import { createCLI } from "../cli.js";

describe("buildCliCommands", () => {
  it("registers and runs a simple action", async () => {
    let called = false;
    const registry = createActionRegistry().add(
      defineAction({
        id: "ping",
        description: "Ping action",
        surfaces: ["cli"],
        input: z.object({}),
        cli: { command: "ping" },
        handler: async () => {
          called = true;
          return Result.ok({ ok: true });
        },
      })
    );

    const cli = createCLI({
      name: "test",
      version: "0.0.0",
      onError: (error) => {
        throw error;
      },
      onExit: (code) => {
        throw new Error(`exit ${code}`);
      },
    });

    for (const command of buildCliCommands(registry)) {
      cli.register(command);
    }

    await cli.parse(["node", "test", "ping"]);

    expect(called).toBe(true);
  });

  it("supports grouped subcommands", async () => {
    let baseCalled = false;
    let subCalled = false;
    const registry = createActionRegistry()
      .add(
        defineAction({
          id: "init",
          surfaces: ["cli"],
          input: z.object({}),
          cli: { group: "init", command: "[directory]", mapInput: () => ({}) },
          handler: async () => {
            baseCalled = true;
            return Result.ok({ ok: true });
          },
        })
      )
      .add(
        defineAction({
          id: "init.cli",
          surfaces: ["cli"],
          input: z.object({}),
          cli: {
            group: "init",
            command: "cli [directory]",
            mapInput: () => ({}),
          },
          handler: async () => {
            subCalled = true;
            return Result.ok({ ok: true });
          },
        })
      );

    const cli = createCLI({
      name: "test",
      version: "0.0.0",
      onError: (error) => {
        throw error;
      },
      onExit: (code) => {
        throw new Error(`exit ${code}`);
      },
    });

    for (const command of buildCliCommands(registry)) {
      cli.register(command);
    }

    await cli.parse(["node", "test", "init", "cli"]);

    expect(baseCalled).toBe(false);
    expect(subCalled).toBe(true);
  });
});
