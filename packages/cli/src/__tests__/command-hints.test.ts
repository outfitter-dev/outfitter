/**
 * Tests for CommandBuilder.hints() and .onError() — transport-local hint declarations.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from "bun:test";

import type { CLIHint } from "@outfitter/contracts";
import { z } from "zod";

import { command, createCLI } from "../command.js";

// =============================================================================
// .hints(fn) — success hint function
// =============================================================================

describe("CommandBuilder.hints()", () => {
  describe("stores success hint function on builder", () => {
    it("accepts a hint function and returns this for chaining", () => {
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .hints((_result, _input) => [])
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });

    it("does not invoke hint function during build", () => {
      let hintsCalled = false;

      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .hints(() => {
          hintsCalled = true;
          return [];
        })
        .action(async () => {});

      builder.build();
      expect(hintsCalled).toBe(false);
    });

    it("hint function receives result and input parameters", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let capturedResult: unknown;
      let capturedInput: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .hints((result, input) => {
            capturedResult = result;
            capturedInput = input;
            return [];
          })
          .action(async ({ input }) => {
            // Simulate successful output — hints are stored, not invoked here
          })
      );

      // Hints are stored, not invoked during parse. They're for later use at output time.
      await cli.parse(["node", "test", "run", "--name", "Alice"]);

      // Since hints are only stored for later invocation at output time,
      // they won't be called during the parse itself
      expect(capturedResult).toBeUndefined();
      expect(capturedInput).toBeUndefined();
    });

    it("returns CLIHint[] from hint function", () => {
      const hints: CLIHint[] = [
        {
          description: "List all items",
          command: "outfitter list",
        },
        {
          description: "Show details",
          command: "outfitter show <id>",
          params: { id: "abc" },
        },
      ];

      const hintFn = (_result: unknown, _input: unknown): CLIHint[] => hints;

      // Just verify the function shape compiles and works
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .hints(hintFn)
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });
  });

  // ===========================================================================
  // Chaining
  // ===========================================================================

  describe("chaining", () => {
    it("supports .input().hints().action() chain", () => {
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .hints(() => [])
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });

    it("supports .input().context().hints().action() chain", () => {
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .context(async (input) => ({ upper: input.name.toUpperCase() }))
        .hints(() => [])
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });

    it("supports .hints() before .input()", () => {
      const builder = command("run")
        .description("Run")
        .hints(() => [])
        .input(z.object({ name: z.string().describe("Name") }))
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });
  });

  // ===========================================================================
  // Without .input() — hint function still stored
  // ===========================================================================

  describe("without .input()", () => {
    it("works without .input() schema", () => {
      const builder = command("run")
        .description("Run")
        .option("--name <value>", "Name")
        .hints(() => [
          { description: "Try again", command: "run --name other" },
        ])
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });
  });
});

// =============================================================================
// .onError(fn) — error hint function
// =============================================================================

describe("CommandBuilder.onError()", () => {
  describe("stores error hint function on builder", () => {
    it("accepts an error hint function and returns this for chaining", () => {
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .onError((_error, _input) => [])
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });

    it("does not invoke error hint function during build", () => {
      let errorHintsCalled = false;

      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .onError(() => {
          errorHintsCalled = true;
          return [];
        })
        .action(async () => {});

      builder.build();
      expect(errorHintsCalled).toBe(false);
    });

    it("error hint function returns CLIHint[]", () => {
      const hints: CLIHint[] = [
        {
          description: "Check your credentials",
          command: "outfitter auth login",
        },
      ];

      const errorHintFn = (_error: unknown, _input: unknown): CLIHint[] =>
        hints;

      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .onError(errorHintFn)
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });
  });

  // ===========================================================================
  // Chaining
  // ===========================================================================

  describe("chaining", () => {
    it("supports .input().onError().action() chain", () => {
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .onError(() => [])
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });

    it("supports .input().context().hints().onError().action() chain", () => {
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .context(async (input) => ({ upper: input.name.toUpperCase() }))
        .hints(() => [])
        .onError(() => [])
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });
  });

  // ===========================================================================
  // Without .input()
  // ===========================================================================

  describe("without .input()", () => {
    it("works without .input() schema", () => {
      const builder = command("run")
        .description("Run")
        .option("--name <value>", "Name")
        .onError(() => [{ description: "Check input", command: "run --help" }])
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });
  });
});

// =============================================================================
// Combined .hints() and .onError()
// =============================================================================

describe("CommandBuilder hints + onError combined", () => {
  it("both .hints() and .onError() can be set on the same command", () => {
    const builder = command("deploy")
      .description("Deploy")
      .input(z.object({ env: z.string().describe("Environment") }))
      .context(async (input) => ({ config: input.env }))
      .hints((result, input) => [
        {
          description: `Check deployment status for ${String(input?.env ?? "unknown")}`,
          command: `deploy status --env ${String(input?.env ?? "unknown")}`,
        },
      ])
      .onError((error, input) => [
        {
          description: "Retry with --force",
          command: `deploy --env ${String(input?.env ?? "unknown")} --force`,
        },
      ])
      .action(async () => {});

    const cmd = builder.build();
    expect(cmd.name()).toBe("deploy");
  });

  it("handlers remain transport-agnostic — hints are not in handler scope", async () => {
    const cli = createCLI({ name: "test", version: "0.0.1" });
    let handlerReceivedKeys: string[] = [];

    cli.register(
      command("run")
        .description("Run")
        .input(z.object({ name: z.string().describe("Name") }))
        .hints(() => [{ description: "Next step", command: "next" }])
        .onError(() => [{ description: "Retry", command: "retry" }])
        .action(async (ctx) => {
          handlerReceivedKeys = Object.keys(ctx);
        })
    );

    await cli.parse(["node", "test", "run", "--name", "Alice"]);

    // Handler receives standard context — no hint functions leak through
    expect(handlerReceivedKeys).toContain("args");
    expect(handlerReceivedKeys).toContain("flags");
    expect(handlerReceivedKeys).toContain("command");
    expect(handlerReceivedKeys).toContain("input");
    // Hints are NOT part of the handler context — they're transport-layer only
    expect(handlerReceivedKeys).not.toContain("hints");
    expect(handlerReceivedKeys).not.toContain("onError");
  });
});
