/**
 * Tests for CommandBuilder.context() — async context factory.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from "bun:test";

import { z } from "zod";

import { command, createCLI } from "../command.js";

// =============================================================================
// .context(factory) — basic usage
// =============================================================================

describe("CommandBuilder.context()", () => {
  describe("receives validated input from .input() schema", () => {
    it("passes validated input to context factory", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let factoryReceived: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .context(async (input) => {
            factoryReceived = input;
            return { greeting: `Hello, ${input.name}` };
          })
          .action(async () => {})
      );

      await cli.parse(["node", "test", "run", "--name", "Alice"]);
      expect(factoryReceived).toEqual({ name: "Alice" });
    });

    it("passes context object to handler alongside input", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedCtx: unknown;
      let receivedInput: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .context(async (input) => ({
            greeting: `Hello, ${input.name}`,
          }))
          .action(async ({ input, ctx }) => {
            receivedInput = input;
            receivedCtx = ctx;
          })
      );

      await cli.parse(["node", "test", "run", "--name", "Alice"]);
      expect(receivedInput).toEqual({ name: "Alice" });
      expect(receivedCtx).toEqual({ greeting: "Hello, Alice" });
    });
  });

  // ===========================================================================
  // Without .input() — receives raw flags
  // ===========================================================================

  describe("works without .input()", () => {
    it("receives raw parsed flags when no schema", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let factoryReceived: unknown;

      cli.register(
        command("run")
          .description("Run")
          .option("--name <value>", "Name")
          .context(async (flags) => {
            factoryReceived = flags;
            return { ready: true };
          })
          .action(async () => {})
      );

      await cli.parse(["node", "test", "run", "--name", "Bob"]);
      expect(factoryReceived).toHaveProperty("name", "Bob");
    });

    it("passes context to handler without .input()", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedCtx: unknown;

      cli.register(
        command("run")
          .description("Run")
          .option("--count <n>", "Count")
          .context(async () => ({ dbConnected: true }))
          .action(async ({ ctx }) => {
            receivedCtx = ctx;
          })
      );

      await cli.parse(["node", "test", "run", "--count", "5"]);
      expect(receivedCtx).toEqual({ dbConnected: true });
    });
  });

  // ===========================================================================
  // Async factory
  // ===========================================================================

  describe("async context factory", () => {
    it("supports async factory functions", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedCtx: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ id: z.string().describe("ID") }))
          .context(async (input) => {
            // Simulate async work
            await new Promise((resolve) => setTimeout(resolve, 1));
            return { record: { id: input.id, loaded: true } };
          })
          .action(async ({ ctx }) => {
            receivedCtx = ctx;
          })
      );

      await cli.parse(["node", "test", "run", "--id", "abc123"]);
      expect(receivedCtx).toEqual({
        record: { id: "abc123", loaded: true },
      });
    });

    it("supports synchronous factory functions", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedCtx: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .context((input) => ({ upper: input.name.toUpperCase() }))
          .action(async ({ ctx }) => {
            receivedCtx = ctx;
          })
      );

      await cli.parse(["node", "test", "run", "--name", "alice"]);
      expect(receivedCtx).toEqual({ upper: "ALICE" });
    });
  });

  // ===========================================================================
  // Error handling
  // ===========================================================================

  describe("error handling", () => {
    it("catches context factory errors and produces exit codes", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let handlerCalled = false;
      const stderrChunks: string[] = [];
      const originalWrite = process.stderr.write.bind(process.stderr);
      const originalExit = process.exit;
      let capturedExitCode: number | undefined;

      // Mock stderr
      process.stderr.write = ((chunk: string | Uint8Array) => {
        stderrChunks.push(String(chunk));
        return true;
      }) as typeof process.stderr.write;

      // Mock process.exit
      // @ts-expect-error - mocking process.exit
      process.exit = (code?: number): never => {
        capturedExitCode = code;
        throw new Error(`process.exit(${code}) called`);
      };

      try {
        cli.register(
          command("run")
            .description("Run")
            .input(z.object({ name: z.string().describe("Name") }))
            .context(async () => {
              throw new Error("Database connection failed");
            })
            .action(async () => {
              handlerCalled = true;
            })
        );

        await cli
          .parse(["node", "test", "run", "--name", "Alice"])
          .catch(() => {});
      } finally {
        process.stderr.write = originalWrite;
        process.exit = originalExit;
      }

      expect(handlerCalled).toBe(false);
      expect(capturedExitCode).toBe(1);
      expect(stderrChunks.join("")).toContain("Database connection failed");
    });

    it("maps OutfitterError categories to exit codes", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      const originalWrite = process.stderr.write.bind(process.stderr);
      const originalExit = process.exit;
      let firstExitCode: number | undefined;

      // Mock stderr
      process.stderr.write = (() => true) as typeof process.stderr.write;

      // Mock process.exit — capture first call only (Commander may call again)
      // @ts-expect-error - mocking process.exit
      process.exit = (code?: number): never => {
        if (firstExitCode === undefined) {
          firstExitCode = code;
        }
        throw new Error(`process.exit(${code}) called`);
      };

      try {
        // Create an error with a category (duck-typed OutfitterError)
        const authError = Object.assign(new Error("Unauthorized"), {
          _tag: "AuthError",
          category: "auth" as const,
        });

        cli.register(
          command("run")
            .description("Run")
            .context(async () => {
              throw authError;
            })
            .action(async () => {})
        );

        await cli.parse(["node", "test", "run"]).catch(() => {});
      } finally {
        process.stderr.write = originalWrite;
        process.exit = originalExit;
      }

      // auth category → exit code 9
      expect(firstExitCode).toBe(9);
    });

    it("does not call handler when context factory throws", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let handlerCalled = false;
      const originalWrite = process.stderr.write.bind(process.stderr);
      const originalExit = process.exit;

      process.stderr.write = (() => true) as typeof process.stderr.write;
      // @ts-expect-error - mocking process.exit
      process.exit = (code?: number): never => {
        throw new Error(`process.exit(${code}) called`);
      };

      try {
        cli.register(
          command("run")
            .description("Run")
            .context(async () => {
              throw new Error("Context failed");
            })
            .action(async () => {
              handlerCalled = true;
            })
        );

        await cli.parse(["node", "test", "run"]).catch(() => {});
      } finally {
        process.stderr.write = originalWrite;
        process.exit = originalExit;
      }

      expect(handlerCalled).toBe(false);
    });
  });

  // ===========================================================================
  // Chaining
  // ===========================================================================

  describe("chaining", () => {
    it("supports .input().context().action() chain", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedCtx: unknown;

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .context(async (input) => ({ upper: input.name.toUpperCase() }))
          .action(async ({ ctx }) => {
            receivedCtx = ctx;
          })
      );

      await cli.parse(["node", "test", "run", "--name", "alice"]);
      expect(receivedCtx).toEqual({ upper: "ALICE" });
    });

    it("supports .context() before .input()", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedCtx: unknown;

      // context declared before input — should still receive validated input
      cli.register(
        command("run")
          .description("Run")
          .context(async (input: Record<string, unknown>) => ({
            hasName: "name" in input,
          }))
          .input(z.object({ name: z.string().describe("Name") }))
          .action(async ({ ctx }) => {
            receivedCtx = ctx;
          })
      );

      await cli.parse(["node", "test", "run", "--name", "Alice"]);
      expect(receivedCtx).toEqual({ hasName: true });
    });

    it("returns this for fluent chaining", () => {
      const builder = command("run")
        .description("Run")
        .input(z.object({ name: z.string() }))
        .context(async (input) => ({ upper: input.name.toUpperCase() }))
        .action(async () => {});

      const cmd = builder.build();
      expect(cmd.name()).toBe("run");
    });
  });

  // ===========================================================================
  // Context is undefined when no .context() is used
  // ===========================================================================

  describe("without .context()", () => {
    it("ctx is undefined when .context() not called", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedCtx: unknown = "sentinel";

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .action(async ({ ctx }) => {
            receivedCtx = ctx;
          })
      );

      await cli.parse(["node", "test", "run", "--name", "Alice"]);
      expect(receivedCtx).toBeUndefined();
    });
  });

  // ===========================================================================
  // Action context includes all expected fields
  // ===========================================================================

  describe("action context fields", () => {
    it("provides args, flags, command, input, and ctx", async () => {
      const cli = createCLI({ name: "test", version: "0.0.1" });
      let receivedKeys: string[] = [];

      cli.register(
        command("run")
          .description("Run")
          .input(z.object({ name: z.string().describe("Name") }))
          .context(async () => ({ ready: true }))
          .action(async (actionCtx) => {
            receivedKeys = Object.keys(actionCtx);
          })
      );

      await cli.parse(["node", "test", "run", "--name", "Alice"]);
      expect(receivedKeys).toContain("args");
      expect(receivedKeys).toContain("flags");
      expect(receivedKeys).toContain("command");
      expect(receivedKeys).toContain("input");
      expect(receivedKeys).toContain("ctx");
    });
  });
});
