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

// =============================================================================
// Zod flag derivation (OS-600)
// =============================================================================

describe("buildCliCommands Zod flag derivation", () => {
  it("auto-derives CLI flags from Zod input schema", async () => {
    let captured: unknown;
    const registry = createActionRegistry().add(
      defineAction({
        id: "search",
        description: "Search",
        surfaces: ["cli"],
        input: z.object({
          query: z.string().describe("Search query"),
          limit: z.number().default(25).describe("Max results"),
        }),
        cli: { command: "search" },
        handler: async (input) => {
          captured = input;
          return Result.ok({ results: [] });
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

    await cli.parse(["node", "test", "search", "--query", "hello"]);

    expect(captured).toEqual({ query: "hello", limit: 25 });
  });

  it("auto-derives number flags with argParser coercion", async () => {
    let captured: unknown;
    const registry = createActionRegistry().add(
      defineAction({
        id: "search2",
        description: "Search with limit",
        surfaces: ["cli"],
        input: z.object({
          query: z.string().describe("Search query"),
          limit: z.number().default(25).describe("Max results"),
        }),
        cli: { command: "search2" },
        handler: async (input) => {
          captured = input;
          return Result.ok({ results: [] });
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

    await cli.parse([
      "node",
      "test",
      "search2",
      "--query",
      "hello",
      "--limit",
      "50",
    ]);

    // Commander's argParser(Number) should coerce "50" to 50
    expect(captured).toEqual({ query: "hello", limit: 50 });
  });

  it("explicit cli.options override schema-derived flags", async () => {
    let captured: unknown;
    const registry = createActionRegistry().add(
      defineAction({
        id: "list",
        description: "List items",
        surfaces: ["cli"],
        input: z.object({
          count: z.coerce.number().default(10),
        }),
        cli: {
          command: "list",
          options: [
            {
              flags: "--count <n>",
              description: "Custom count desc",
              defaultValue: "5",
            },
          ],
        },
        handler: async (input) => {
          captured = input;
          return Result.ok({ items: [] });
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

    // The explicit option should be registered (not duplicated by schema derivation)
    await cli.parse(["node", "test", "list", "--count", "3"]);

    expect(captured).toEqual({ count: 3 });
  });

  it("boolean schema fields derive as flags", async () => {
    let captured: unknown;
    const registry = createActionRegistry().add(
      defineAction({
        id: "check",
        description: "Check",
        surfaces: ["cli"],
        input: z.object({
          verbose: z.boolean().default(false).describe("Verbose output"),
        }),
        cli: { command: "check" },
        handler: async (input) => {
          captured = input;
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

    await cli.parse(["node", "test", "check", "--verbose"]);

    expect(captured).toEqual({ verbose: true });
  });
});

// =============================================================================
// onResult callback (OS-601)
// =============================================================================

describe("buildCliCommands onResult callback", () => {
  it("receives handler result on success", async () => {
    let resultCtx: unknown;
    const registry = createActionRegistry().add(
      defineAction({
        id: "greet",
        description: "Greet",
        surfaces: ["cli"],
        input: z.object({}),
        cli: { command: "greet" },
        handler: async () => {
          return Result.ok({ greeting: "hello" });
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

    for (const command of buildCliCommands(registry, {
      onResult: (ctx) => {
        resultCtx = ctx;
      },
    })) {
      cli.register(command);
    }

    await cli.parse(["node", "test", "greet"]);

    expect(resultCtx).toBeDefined();
    const ctx = resultCtx as {
      result: { isOk: () => boolean; value: unknown };
    };
    expect(ctx.result.isOk()).toBe(true);
    expect(ctx.result.value).toEqual({ greeting: "hello" });
  });

  it("receives handler result on error (does not throw)", async () => {
    let resultCtx: unknown;
    const registry = createActionRegistry().add(
      defineAction({
        id: "fail",
        description: "Fail",
        surfaces: ["cli"],
        input: z.object({}),
        cli: { command: "fail" },
        handler: async () => {
          return Result.err(new Error("boom"));
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

    for (const command of buildCliCommands(registry, {
      onResult: (ctx) => {
        resultCtx = ctx;
      },
    })) {
      cli.register(command);
    }

    // Should not throw — onResult handles the error
    await cli.parse(["node", "test", "fail"]);

    expect(resultCtx).toBeDefined();
    const ctx = resultCtx as {
      result: { isErr: () => boolean; error: Error };
    };
    expect(ctx.result.isErr()).toBe(true);
    expect(ctx.result.error.message).toBe("boom");
  });

  it("includes action and input in result context", async () => {
    let resultCtx: unknown;
    const registry = createActionRegistry().add(
      defineAction({
        id: "echo",
        description: "Echo",
        surfaces: ["cli"],
        input: z.object({
          message: z.string().describe("Message"),
        }),
        cli: { command: "echo" },
        handler: async (input) => {
          return Result.ok({ echoed: (input as { message: string }).message });
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

    for (const command of buildCliCommands(registry, {
      onResult: (ctx) => {
        resultCtx = ctx;
      },
    })) {
      cli.register(command);
    }

    await cli.parse(["node", "test", "echo", "--message", "hi"]);

    expect(resultCtx).toBeDefined();
    const ctx = resultCtx as {
      action: { id: string };
      input: { message: string };
    };
    expect(ctx.action.id).toBe("echo");
    expect(ctx.input).toEqual({ message: "hi" });
  });
});
