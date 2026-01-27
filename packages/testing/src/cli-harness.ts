/**
 * @outfitter/testing - CLI Harness
 *
 * Test harness for executing and capturing CLI command output.
 * Provides a simple interface for running CLI commands in tests
 * and capturing their stdout, stderr, and exit code.
 *
 * @packageDocumentation
 */

import { spawn } from "node:child_process";
import { constants } from "node:os";

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
    run(args: string[]): Promise<CliResult> {
      return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
          shell: false,
          stdio: ["pipe", "pipe", "pipe"],
        });

        // Close stdin immediately so commands waiting for EOF don't hang
        child.stdin.end();

        const stdoutChunks: Uint8Array[] = [];
        const stderrChunks: Uint8Array[] = [];

        child.stdout.on("data", (chunk: Uint8Array) => {
          stdoutChunks.push(chunk);
        });

        child.stderr.on("data", (chunk: Uint8Array) => {
          stderrChunks.push(chunk);
        });

        child.on("error", (err) => {
          reject(err);
        });

        child.on("close", (exitCode, signal) => {
          const decoder = new TextDecoder("utf-8");

          // Determine exit code:
          // - If exitCode is provided, use it
          // - If process was killed by signal, use 128 + signal number (Unix convention)
          // - If signal is unknown, fall back to 1 (general error)
          let finalExitCode: number;
          if (exitCode !== null) {
            finalExitCode = exitCode;
          } else if (signal !== null) {
            const signalNumber =
              constants.signals[signal as keyof typeof constants.signals];
            finalExitCode = signalNumber !== undefined ? 128 + signalNumber : 1;
          } else {
            finalExitCode = 1;
          }

          resolve({
            stdout: decoder.decode(concatUint8Arrays(stdoutChunks)),
            stderr: decoder.decode(concatUint8Arrays(stderrChunks)),
            exitCode: finalExitCode,
          });
        });
      });
    },
  };
}

/**
 * Concatenates multiple Uint8Array chunks into a single Uint8Array.
 */
function concatUint8Arrays(chunks: Uint8Array[]): Uint8Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
