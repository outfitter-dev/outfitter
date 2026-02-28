/**
 * @outfitter/testing - Enhanced testCommand() Test Suite
 *
 * Verifies testCommand() enhancements for v0.5 builder pattern:
 * - Pre-parsed input (schema-validated) via options
 * - Mock context injection via options
 * - Envelope with hints in return value
 * - Backward compatible with existing tests
 */

import { describe, expect, it } from "bun:test";

import { command, createCLI } from "@outfitter/cli/command";
import { runHandler } from "@outfitter/cli/envelope";
import { Result, ValidationError } from "@outfitter/contracts";
import type { CLIHint } from "@outfitter/contracts";
import { z } from "zod";

import { getTestContext, testCommand } from "../test-command.js";

// ============================================================================
// Helpers
// ============================================================================

function makeCli() {
  return createCLI({ name: "test-cli", version: "1.0.0" });
}

// ============================================================================
// Input Conversion Tests
// ============================================================================

describe("testCommand() — input option", () => {
  it("converts input object to CLI args", async () => {
    const cli = makeCli();
    cli.register(
      command("greet")
        .description("Greet someone")
        .input(z.object({ name: z.string().describe("Who to greet") }))
        .action(({ input }) => {
          console.log(`Hello, ${input?.name}!`);
        })
    );

    const result = await testCommand(cli, ["greet"], {
      input: { name: "World" },
    });

    expect(result.stdout).toContain("Hello, World!");
    expect(result.exitCode).toBe(0);
  });

  it("converts boolean input values to flags", async () => {
    const cli = makeCli();
    cli.register(
      command("run")
        .description("Run something")
        .input(
          z.object({
            verbose: z.boolean().default(false).describe("Verbose output"),
          })
        )
        .action(({ input }) => {
          console.log(`verbose: ${input?.verbose}`);
        })
    );

    const result = await testCommand(cli, ["run"], {
      input: { verbose: true },
    });

    expect(result.stdout).toContain("verbose: true");
    expect(result.exitCode).toBe(0);
  });

  it("converts number input values to string args", async () => {
    const cli = makeCli();
    cli.register(
      command("count")
        .description("Count items")
        .input(
          z.object({
            limit: z.number().default(10).describe("Max items"),
          })
        )
        .action(({ input }) => {
          console.log(`limit: ${input?.limit}`);
        })
    );

    const result = await testCommand(cli, ["count"], {
      input: { limit: 42 },
    });

    expect(result.stdout).toContain("limit: 42");
    expect(result.exitCode).toBe(0);
  });

  it("merges input args with explicit args", async () => {
    const cli = makeCli();
    cli.register(
      command("deploy")
        .description("Deploy something")
        .input(
          z.object({
            env: z.string().describe("Environment"),
          })
        )
        .option("--dry-run", "Simulate the deployment")
        .action(({ input, flags }) => {
          console.log(
            `env: ${input?.env}, dry: ${(flags as Record<string, unknown>)["dryRun"]}`
          );
        })
    );

    const result = await testCommand(cli, ["deploy", "--dry-run"], {
      input: { env: "staging" },
    });

    expect(result.stdout).toContain("env: staging");
    expect(result.stdout).toContain("dry: true");
    expect(result.exitCode).toBe(0);
  });
});

// ============================================================================
// Context Injection Tests
// ============================================================================

describe("testCommand() — context option", () => {
  it("injects mock context retrievable via getTestContext()", async () => {
    const cli = makeCli();
    cli.register(
      command("status")
        .description("Show status")
        .context(async () => {
          // In real tests, context factories use getTestContext() to pick up injected context
          const testCtx = getTestContext<{ db: string }>();
          if (testCtx) return testCtx;
          return { db: "real-db-connection" };
        })
        .action(({ ctx }) => {
          console.log(`db: ${(ctx as { db: string }).db}`);
        })
    );

    const result = await testCommand(cli, ["status"], {
      context: { db: "test-db" },
    });

    expect(result.stdout).toContain("test-db");
    expect(result.exitCode).toBe(0);
  });

  it("getTestContext() returns undefined outside testCommand()", () => {
    expect(getTestContext()).toBeUndefined();
  });

  it("cleans up injected context after execution", async () => {
    const cli = makeCli();
    cli.register(
      command("noop")
        .description("No-op")
        .action(() => {
          // getTestContext should be available during execution
          const ctx = getTestContext();
          console.log(`has-ctx: ${ctx !== undefined}`);
        })
    );

    await testCommand(cli, ["noop"], {
      context: { key: "value" },
    });

    // Should be cleaned up after testCommand returns
    expect(getTestContext()).toBeUndefined();
  });
});

// ============================================================================
// Envelope Tests
// ============================================================================

describe("testCommand() — envelope return", () => {
  it("returns parsed envelope from JSON output", async () => {
    const cli = makeCli();
    cli.register(
      command("info")
        .description("Show info")
        .action(async () => {
          await runHandler({
            command: "info",
            handler: async () => Result.ok({ status: "healthy" }),
            format: "json",
          });
        })
    );

    const result = await testCommand(cli, ["info"]);

    expect(result.envelope).toBeDefined();
    expect(result.envelope?.ok).toBe(true);
    if (result.envelope?.ok) {
      expect(result.envelope.result).toEqual({ status: "healthy" });
    }
  });

  it("returns envelope with hints from JSON output", async () => {
    const hints: CLIHint[] = [
      { description: "Check status", command: "status --verbose" },
    ];

    const cli = makeCli();
    cli.register(
      command("deploy")
        .description("Deploy app")
        .action(async () => {
          await runHandler({
            command: "deploy",
            handler: async () => Result.ok({ deployed: true }),
            format: "json",
            hints: () => hints,
          });
        })
    );

    const result = await testCommand(cli, ["deploy"]);

    expect(result.envelope).toBeDefined();
    expect(result.envelope?.ok).toBe(true);
    expect(result.envelope?.hints).toBeDefined();
    expect(result.envelope?.hints).toHaveLength(1);
    expect(result.envelope?.hints?.[0]?.command).toBe("status --verbose");
  });

  it("returns error envelope for failed commands", async () => {
    const cli = makeCli();
    cli.register(
      command("fail")
        .description("Fail on purpose")
        .action(async () => {
          await runHandler({
            command: "fail",
            handler: async () =>
              Result.err(new ValidationError({ message: "bad input" })),
            format: "json",
          });
        })
    );

    const result = await testCommand(cli, ["fail"]);

    expect(result.envelope).toBeDefined();
    expect(result.envelope?.ok).toBe(false);
    if (!result.envelope?.ok) {
      expect(result.envelope?.error.category).toBe("validation");
      expect(result.envelope?.error.message).toBe("bad input");
    }
  });

  it("returns undefined envelope for non-JSON output", async () => {
    const cli = makeCli();
    cli.register(
      command("hello")
        .description("Say hello")
        .action(() => {
          console.log("Hello!");
        })
    );

    const result = await testCommand(cli, ["hello"]);

    expect(result.envelope).toBeUndefined();
    expect(result.stdout).toContain("Hello!");
  });

  it("forces JSON output when json option is true", async () => {
    const cli = makeCli();
    cli.register(
      command("info")
        .description("Show info")
        .action(async () => {
          await runHandler({
            command: "info",
            handler: async () => Result.ok({ version: "1.0" }),
          });
        })
    );

    const result = await testCommand(cli, ["info"], { json: true });

    expect(result.envelope).toBeDefined();
    expect(result.envelope?.ok).toBe(true);
  });
});

// ============================================================================
// Backward Compatibility Tests
// ============================================================================

describe("testCommand() — backward compatibility", () => {
  it("works without any new options (existing behavior)", async () => {
    const cli = makeCli();
    cli.register(
      command("echo")
        .description("Echo message")
        .action(() => {
          console.log("existing behavior");
        })
    );

    const result = await testCommand(cli, ["echo"]);

    expect(result.stdout).toContain("existing behavior");
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
  });

  it("env option still works alongside new options", async () => {
    const cli = makeCli();
    cli.register(
      command("env-test")
        .description("Check env")
        .action(() => {
          console.log(process.env["MY_TEST_VAR"] ?? "missing");
        })
    );

    const result = await testCommand(cli, ["env-test"], {
      env: { MY_TEST_VAR: "present" },
    });

    expect(result.stdout).toContain("present");
    expect(process.env["MY_TEST_VAR"]).toBeUndefined();
  });

  it("restores OUTFITTER_JSON when env and json both set it", async () => {
    // Regression: when options.env includes OUTFITTER_JSON and options.json
    // is also true, the backup value must be the original (pre-modification)
    // value, not the value set by options.env.
    const originalValue = process.env["OUTFITTER_JSON"];

    const cli = makeCli();
    cli.register(
      command("json-test")
        .description("Check JSON env")
        .action(async () => {
          await runHandler({
            command: "json-test",
            handler: async () => Result.ok({ tested: true }),
          });
        })
    );

    const result = await testCommand(cli, ["json-test"], {
      env: { OUTFITTER_JSON: "0" },
      json: true,
    });

    // json: true should win (OUTFITTER_JSON=1 during execution)
    expect(result.envelope).toBeDefined();
    expect(result.envelope?.ok).toBe(true);

    // After execution, OUTFITTER_JSON should be restored to its original value
    expect(process.env["OUTFITTER_JSON"]).toBe(originalValue);
  });
});
