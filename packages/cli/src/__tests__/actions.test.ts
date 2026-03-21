import { describe, expect, it } from "bun:test";

import {
  createActionRegistry,
  defineAction,
  Result,
} from "@outfitter/contracts";
import { z } from "zod";

import {
  actionCliPresets,
  type ActionResultContext,
  buildCliCommands,
} from "../actions.js";
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

  describe("auto-derived Zod flags (OS-600)", () => {
    it("derives CLI flags from Zod input schema", async () => {
      let captured: Record<string, unknown> | undefined;
      const registry = createActionRegistry().add(
        defineAction({
          id: "deploy",
          description: "Deploy action",
          surfaces: ["cli"],
          input: z.object({
            target: z.string().describe("Deploy target"),
            verbose: z.boolean().default(false).describe("Verbose output"),
            retries: z.number().default(3).describe("Retry count"),
          }),
          cli: { command: "deploy" },
          handler: async (input) => {
            captured = input as Record<string, unknown>;
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

      const commands = buildCliCommands(registry);
      for (const command of commands) {
        cli.register(command);
      }

      await cli.parse([
        "node",
        "test",
        "deploy",
        "--target",
        "staging",
        "--verbose",
        "--retries",
        "5",
      ]);

      expect(captured).toEqual({
        target: "staging",
        verbose: true,
        retries: 5,
      });
    });

    it("explicit cli.options take precedence over derived flags", async () => {
      let captured: Record<string, unknown> | undefined;
      const registry = createActionRegistry().add(
        defineAction({
          id: "build",
          description: "Build action",
          surfaces: ["cli"],
          input: z.object({
            outputDir: z.string().default("dist").describe("Output directory"),
            watch: z.boolean().default(false).describe("Watch mode"),
          }),
          cli: {
            command: "build",
            options: [
              {
                flags: "-o, --output-dir <dir>",
                description: "Custom output directory",
                defaultValue: "build",
              },
            ],
          },
          handler: async (input) => {
            captured = input as Record<string, unknown>;
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

      const commands = buildCliCommands(registry);
      for (const command of commands) {
        cli.register(command);
      }

      // --output-dir uses the explicit default "build", not schema default "dist"
      // --watch is derived from schema
      await cli.parse(["node", "test", "build", "--watch"]);

      expect(captured).toEqual({
        outputDir: "build",
        watch: true,
      });
    });

    it("converts camelCase schema fields to kebab-case flags", async () => {
      let captured: Record<string, unknown> | undefined;
      const registry = createActionRegistry().add(
        defineAction({
          id: "config",
          description: "Config action",
          surfaces: ["cli"],
          input: z.object({
            outputDir: z.string().describe("Output directory"),
            dryRun: z.boolean().default(false),
            maxRetryCount: z.number().default(1),
          }),
          cli: { command: "config" },
          handler: async (input) => {
            captured = input as Record<string, unknown>;
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

      const commands = buildCliCommands(registry);
      for (const command of commands) {
        cli.register(command);
      }

      await cli.parse([
        "node",
        "test",
        "config",
        "--output-dir",
        "/tmp/out",
        "--dry-run",
        "--max-retry-count",
        "5",
      ]);

      expect(captured).toEqual({
        outputDir: "/tmp/out",
        dryRun: true,
        maxRetryCount: 5,
      });
    });
  });

  describe("onResult callback (OS-601)", () => {
    it("receives success results", async () => {
      let resultCtx: ActionResultContext | undefined;
      const registry = createActionRegistry().add(
        defineAction({
          id: "greet",
          description: "Greet action",
          surfaces: ["cli"],
          input: z.object({
            name: z.string().default("world"),
          }),
          cli: { command: "greet" },
          handler: async (input) => {
            const typed = input as { name: string };
            return Result.ok({ message: `Hello, ${typed.name}` });
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

      const commands = buildCliCommands(registry, {
        onResult: (ctx) => {
          resultCtx = ctx;
        },
      });
      for (const command of commands) {
        cli.register(command);
      }

      await cli.parse(["node", "test", "greet", "--name", "Alice"]);

      expect(resultCtx).toBeDefined();
      expect(resultCtx!.action.id).toBe("greet");
      expect(resultCtx!.result.isOk()).toBe(true);
      expect(resultCtx!.result.isOk() && resultCtx!.result.value).toEqual({
        message: "Hello, Alice",
      });
    });

    it("receives error results without throwing", async () => {
      let resultCtx: ActionResultContext | undefined;
      const registry = createActionRegistry().add(
        defineAction({
          id: "fail",
          description: "Fail action",
          surfaces: ["cli"],
          input: z.object({}),
          cli: { command: "fail" },
          handler: async () => {
            return Result.err(new Error("something broke"));
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

      const commands = buildCliCommands(registry, {
        onResult: (ctx) => {
          resultCtx = ctx;
        },
      });
      for (const command of commands) {
        cli.register(command);
      }

      // Should NOT throw because onResult is provided
      await cli.parse(["node", "test", "fail"]);

      expect(resultCtx).toBeDefined();
      expect(resultCtx!.result.isErr()).toBe(true);
      expect(resultCtx!.result.error).toBeInstanceOf(Error);
    });

    it("throws on error when no onResult is provided (backward compat)", async () => {
      const registry = createActionRegistry().add(
        defineAction({
          id: "boom",
          description: "Boom action",
          surfaces: ["cli"],
          input: z.object({}),
          cli: { command: "boom" },
          handler: async () => {
            return Result.err(new Error("kaboom"));
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

      const commands = buildCliCommands(registry);
      for (const command of commands) {
        cli.register(command);
      }

      await expect(cli.parse(["node", "test", "boom"])).rejects.toThrow(
        "kaboom"
      );
    });
  });
});
