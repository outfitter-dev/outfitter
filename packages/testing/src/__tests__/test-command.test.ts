/**
 * @outfitter/testing - testCommand() Test Suite
 *
 * Verifies testCommand() wraps CLI execution capturing stdout,
 * stderr, and exitCode with no side effects on real process state.
 */

import { describe, expect, it } from "bun:test";

import { command, createCLI } from "@outfitter/cli/command";

import { testCommand } from "../test-command.js";

// ============================================================================
// Helpers
// ============================================================================

function makeCli() {
  return createCLI({ name: "test-cli", version: "1.0.0" });
}

// ============================================================================
// Tests
// ============================================================================

describe("testCommand()", () => {
  it("returns stdout, stderr, and exitCode from CLI execution", async () => {
    const cli = makeCli();
    cli.register(
      command("greet")
        .description("Say hello")
        .action(() => {
          console.log("hello world");
        })
    );

    const result = await testCommand(cli, ["greet"]);

    expect(result.stdout).toContain("hello world");
    expect(result.exitCode).toBe(0);
  });

  it("captures stderr output", async () => {
    const cli = makeCli();
    cli.register(
      command("warn")
        .description("Log a warning")
        .action(() => {
          console.error("something went wrong");
        })
    );

    const result = await testCommand(cli, ["warn"]);

    expect(result.stderr).toContain("something went wrong");
    expect(result.exitCode).toBe(0);
  });

  it("captures non-zero exit code for action errors", async () => {
    const cli = makeCli();
    cli.register(
      command("fail")
        .description("Throws an error")
        .action(() => {
          throw new Error("boom");
        })
    );

    const result = await testCommand(cli, ["fail"]);

    expect(result.exitCode).not.toBe(0);
  });

  it("captures exit code for unknown commands", async () => {
    const cli = makeCli();

    const result = await testCommand(cli, ["nonexistent"]);

    expect(result.exitCode).not.toBe(0);
  });

  it("restores process globals after execution", async () => {
    const cli = makeCli();
    cli.register(
      command("echo")
        .description("Echo a message")
        .action(() => {
          console.log("captured output");
        })
    );

    await testCommand(cli, ["echo"]);

    // Verify process.stdout.write, process.stderr.write, and
    // process.exit still function correctly after testCommand returns.
    // captureCLI restores them in its finally block.
    expect(typeof process.stdout.write).toBe("function");
    expect(typeof process.stderr.write).toBe("function");
    expect(typeof process.exit).toBe("function");

    // Verify stdout/stderr still work by checking they don't throw
    expect(() => process.stdout.write("")).not.toThrow();
    expect(() => process.stderr.write("")).not.toThrow();
  });

  it("does not leak captured output to real stdout", async () => {
    // Capture real stdout to verify no leakage
    const leaked: string[] = [];
    const originalWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      leaked.push(
        typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk)
      );
      return true;
    }) as typeof process.stdout.write;

    try {
      const cli = makeCli();
      cli.register(
        command("secret")
          .description("Secret output")
          .action(() => {
            console.log("should-not-leak");
          })
      );

      const result = await testCommand(cli, ["secret"]);

      expect(result.stdout).toContain("should-not-leak");
      // Verify nothing leaked to the real stdout override
      expect(leaked.join("")).not.toContain("should-not-leak");
    } finally {
      process.stdout.write = originalWrite as typeof process.stdout.write;
    }
  });

  it("works for --help flag (success path)", async () => {
    const cli = makeCli();

    const result = await testCommand(cli, ["--help"]);

    expect(result.stdout).toContain("test-cli");
    expect(result.exitCode).toBe(0);
  });

  it("works for --version flag", async () => {
    const cli = makeCli();

    const result = await testCommand(cli, ["--version"]);

    expect(result.stdout).toContain("1.0.0");
    expect(result.exitCode).toBe(0);
  });

  it("passes env option to the CLI execution context", async () => {
    const cli = makeCli();
    cli.register(
      command("env-check")
        .description("Print env var")
        .action(() => {
          console.log(process.env["TEST_CUSTOM_VAR"] ?? "undefined");
        })
    );

    const result = await testCommand(cli, ["env-check"], {
      env: { TEST_CUSTOM_VAR: "custom-value" },
    });

    expect(result.stdout).toContain("custom-value");

    // Env should be restored after call
    expect(process.env["TEST_CUSTOM_VAR"]).toBeUndefined();
  });

  it("restores env variables even when execution fails", async () => {
    const cli = makeCli();
    cli.register(
      command("env-fail")
        .description("Fails after reading env")
        .action(() => {
          console.log(process.env["TEST_FAIL_VAR"] ?? "missing");
          throw new Error("deliberate failure");
        })
    );

    const result = await testCommand(cli, ["env-fail"], {
      env: { TEST_FAIL_VAR: "temporary" },
    });

    expect(result.stdout).toContain("temporary");
    expect(result.exitCode).not.toBe(0);
    expect(process.env["TEST_FAIL_VAR"]).toBeUndefined();
  });

  it("restores env variables created by the command itself", async () => {
    const cli = makeCli();
    cli.register(
      command("leak")
        .description("Mutates process.env")
        .action(() => {
          process.env["TEST_CREATED_DURING_COMMAND"] = "leaked";
          console.log("done");
        })
    );

    const result = await testCommand(cli, ["leak"]);
    expect(result.exitCode).toBe(0);
    expect(process.env["TEST_CREATED_DURING_COMMAND"]).toBeUndefined();
  });

  it("serializes concurrent invocations to avoid global-state races", async () => {
    const cli = makeCli();
    cli.register(
      command("wait")
        .description("Wait briefly")
        .action(async () => {
          await new Promise((resolve) => setTimeout(resolve, 40));
          console.log("waited");
        })
    );

    const start = Date.now();
    const [a, b] = await Promise.all([
      testCommand(cli, ["wait"]),
      testCommand(cli, ["wait"]),
    ]);
    const elapsedMs = Date.now() - start;

    expect(a.stdout).toContain("waited");
    expect(b.stdout).toContain("waited");
    // If calls are serialized, elapsed time should be roughly cumulative.
    expect(elapsedMs).toBeGreaterThanOrEqual(70);
  });
});
