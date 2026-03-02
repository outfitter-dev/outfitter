/**
 * @outfitter/testing - testCommand()
 *
 * High-level helper for testing CLI wiring. Executes a CLI instance
 * with given arguments and captures stdout, stderr, and exit code
 * without leaking side effects to the real process.
 *
 * @packageDocumentation
 */

import type { CLI } from "@outfitter/cli/command";

import { type CliTestResult, captureCLI } from "./cli-helpers.js";

let executionChain: Promise<void> = Promise.resolve();

async function withProcessLock<T>(run: () => Promise<T>): Promise<T> {
  const prior = executionChain;
  let release: (() => void) | undefined;
  executionChain = new Promise<void>((resolve) => {
    release = resolve;
  });

  await prior;
  try {
    return await run();
  } finally {
    release?.();
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Options for testCommand().
 */
export interface TestCommandOptions {
  /**
   * Environment variables to set during CLI execution.
   * Variables are restored to their original values after execution.
   */
  readonly env?: Readonly<Record<string, string>>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Execute a CLI instance with given arguments and capture output.
 *
 * Creates a fresh CLI instance from the same program, configured with
 * `onExit` to capture exit codes cleanly. Wraps `captureCLI()` to
 * intercept stdout, stderr, and process.exit during execution.
 * No side effects leak to real stdout, stderr, or process.exit.
 * Global process state is fully restored after each call.
 *
 * @param cli - A CLI instance created by `createCLI()`
 * @param args - Command-line arguments (without the program name prefix)
 * @param options - Optional configuration for the test execution
 * @returns Captured stdout, stderr, and exitCode
 *
 * @example
 * ```typescript
 * import { createCLI, command } from "@outfitter/cli/command";
 * import { testCommand } from "@outfitter/testing";
 *
 * const cli = createCLI({ name: "my-cli", version: "1.0.0" });
 * cli.register(command("hello").description("Say hi").action(() => {
 *   console.log("Hello!");
 * }));
 *
 * const result = await testCommand(cli, ["hello"]);
 * expect(result.stdout).toContain("Hello!");
 * expect(result.exitCode).toBe(0);
 * ```
 */
export async function testCommand(
  cli: CLI,
  args: string[],
  options?: TestCommandOptions
): Promise<CliTestResult> {
  return withProcessLock(async () => {
    // Snapshot full env so command-side mutations do not leak across tests.
    const originalEnv = { ...process.env };

    if (options?.env) {
      for (const [key, value] of Object.entries(options.env)) {
        process.env[key] = value;
      }
    }

    // Save process.argv so code that reads it (e.g., hasExplicitOutputFlag)
    // sees the test invocation args instead of the test runner's args.
    const savedArgv = process.argv;
    const testArgv = ["node", "test", ...args];
    process.argv = testArgv;

    try {
      // Commander expects argv in the format: ['node', 'program-name', ...args]
      // Use captureCLI which intercepts process.stdout.write, process.stderr.write,
      // process.exit, console.log, and console.error — then restores them all.
      return await captureCLI(async () => {
        await cli.parse(testArgv);
      });
    } finally {
      // Restore process.argv
      process.argv = savedArgv;

      // Remove keys created during execution.
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      }
      // Restore original env values.
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
}
