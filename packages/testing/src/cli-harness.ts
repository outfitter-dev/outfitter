/**
 * @outfitter/testing - CLI Harness
 *
 * Test harness for executing and capturing CLI command output.
 * Provides a simple interface for running CLI commands in tests
 * and capturing their stdout, stderr, and exit code.
 *
 * @packageDocumentation
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a CLI command execution.
 *
 * Contains the captured output streams and exit code from the command.
 */
export interface CliResult {
  /** Standard output from the command */
  stdout: string;
  /** Standard error output from the command */
  stderr: string;
  /** Exit code from the command (0 typically indicates success) */
  exitCode: number;
}

/**
 * Harness for executing CLI commands in tests.
 *
 * Provides a simple interface to run a pre-configured command
 * with various arguments and capture the results.
 */
export interface CliHarness {
  /**
   * Runs the command with the given arguments.
   *
   * @param args - Command-line arguments to pass to the command
   * @returns Promise resolving to the execution result
   */
  run(args: string[]): Promise<CliResult>;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Creates a CLI harness for testing command-line tools.
 *
 * The harness wraps a command and provides a simple interface for
 * executing it with different arguments, capturing stdout, stderr,
 * and exit code for assertions.
 *
 * @param command - The command to execute (e.g., "echo", "node", "./bin/cli")
 * @returns A CliHarness instance for running the command
 *
 * @example
 * ```typescript
 * const harness = createCliHarness("./bin/my-cli");
 *
 * // Test help output
 * const helpResult = await harness.run(["--help"]);
 * expect(helpResult.stdout).toContain("Usage:");
 * expect(helpResult.exitCode).toBe(0);
 *
 * // Test error case
 * const errorResult = await harness.run(["--invalid-flag"]);
 * expect(errorResult.stderr).toContain("Unknown option");
 * expect(errorResult.exitCode).toBe(1);
 * ```
 */
export function createCliHarness(command: string): CliHarness {
  return {
    async run(args: string[]): Promise<CliResult> {
      const child = Bun.spawn([command, ...args], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      });

      // Close stdin immediately so commands waiting for EOF don't hang
      child.stdin?.end();

      const stdoutPromise = child.stdout
        ? new Response(child.stdout).text()
        : Promise.resolve("");
      const stderrPromise = child.stderr
        ? new Response(child.stderr).text()
        : Promise.resolve("");
      const exitCodePromise = child.exited;

      const [stdout, stderr, exitCode] = await Promise.all([
        stdoutPromise,
        stderrPromise,
        exitCodePromise,
      ]);

      return {
        stdout,
        stderr,
        exitCode: typeof exitCode === "number" ? exitCode : 1,
      };
    },
  };
}
