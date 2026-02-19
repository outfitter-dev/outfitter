import { describe, expect, it } from "bun:test";
import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";
import { actionCliPresets, buildCliCommands } from "../actions.js";
import { createCLI } from "../cli.js";
import { booleanFlagPreset, cwdPreset, dryRunPreset } from "../flags.js";

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

  it("adapts presets to action CLI options and mapInput resolution", async () => {
    let captured:
      | {
          cwd: string;
          dryRun: boolean;
          guide: boolean;
        }
      | undefined;

    const cliPresets = actionCliPresets(
      cwdPreset(),
      dryRunPreset(),
      booleanFlagPreset({
        id: "guide",
        key: "guide",
        flags: "--guide",
        description: "Show migration guidance",
      })
    );

    const registry = createActionRegistry().add(
      defineAction({
        id: "upgrade",
        surfaces: ["cli"],
        input: z.object({
          cwd: z.string(),
          dryRun: z.boolean(),
          guide: z.boolean(),
        }),
        cli: {
          command: "upgrade",
          options: [...cliPresets.options],
          mapInput: (context) => cliPresets.resolve(context),
        },
        handler: async (input) => {
          captured = input as { cwd: string; dryRun: boolean; guide: boolean };
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

    await cli.parse(["node", "test", "upgrade", "--dry-run", "--guide"]);

    expect(captured).toEqual({
      cwd: process.cwd(),
      dryRun: true,
      guide: true,
    });
  });
});
