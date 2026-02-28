/**
 * @outfitter/testing - testCommand()
 *
 * High-level helper for testing CLI wiring. Executes a CLI instance
 * with given arguments and captures stdout, stderr, and exit code
 * without leaking side effects to the real process.
 *
 * Enhanced in v0.5 to support pre-parsed input, mock context injection,
 * and structured envelope parsing for builder-pattern commands.
 *
 * @packageDocumentation
 */

import type { CLI } from "@outfitter/cli/command";
import type { CommandEnvelope } from "@outfitter/cli/envelope";

import { type CliTestResult, captureCLI } from "./cli-helpers.js";

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

  /**
   * Pre-parsed input object to convert to CLI arguments.
   *
   * Each key-value pair is converted to a `--key value` argument:
   * - `string` → `--key value`
   * - `number` → `--key value` (stringified)
   * - `boolean` → `--key` (true) or omitted (false)
   * - `string[]` → repeated `--key value1 --key value2`
   *
   * Input args are appended after the explicit `args` parameter,
   * allowing both positional args and input overrides.
   *
   * @example
   * ```typescript
   * // Converts to: ["greet", "--name", "World"]
   * await testCommand(cli, ["greet"], { input: { name: "World" } });
   * ```
   */
  readonly input?: Readonly<Record<string, unknown>>;

  /**
   * Mock context object to inject into the command execution.
   *
   * When provided, the context is stored in a test injection point
   * and can be retrieved by context factories via `getTestContext()`.
   * The context is cleaned up after execution.
   *
   * @example
   * ```typescript
   * await testCommand(cli, ["status"], {
   *   context: { db: mockDb, config: testConfig },
   * });
   * ```
   */
  readonly context?: Readonly<Record<string, unknown>>;

  /**
   * Force JSON output mode by setting OUTFITTER_JSON=1.
   *
   * When true, the CLI produces JSON output which is automatically
   * parsed into the `envelope` field of the result.
   */
  readonly json?: boolean;
}

/**
 * Enhanced CLI test result with optional envelope parsing.
 *
 * Extends the base `CliTestResult` with an `envelope` field that
 * contains the parsed `CommandEnvelope` when JSON output is detected.
 */
export interface TestCommandResult extends CliTestResult {
  /**
   * Parsed command envelope from JSON output.
   *
   * Present when the command outputs a JSON envelope (either via
   * `runHandler()` with JSON format or when `json: true` is set).
   * Undefined for non-JSON output.
   */
  readonly envelope?: CommandEnvelope | undefined;
}

// ============================================================================
// Test Context Injection
// ============================================================================

/**
 * Module-level storage for test context injection.
 * Set by testCommand() before CLI execution, cleared afterward.
 */
let injectedTestContext: Record<string, unknown> | undefined;
let executionChain: Promise<void> = Promise.resolve();

/**
 * Retrieve the injected test context, if any.
 *
 * Context factories in builder-pattern commands can call this
 * to use the test-provided context instead of constructing a real one.
 *
 * @returns The injected context, or `undefined` if not in a test
 *
 * @example
 * ```typescript
 * // In your command definition:
 * command("status")
 *   .context(async (input) => {
 *     // Use test context if available, otherwise create real one
 *     const testCtx = getTestContext();
 *     if (testCtx) return testCtx;
 *     return { db: await connectDb() };
 *   })
 * ```
 */
export function getTestContext<
  T extends Record<string, unknown> = Record<string, unknown>,
>(): T | undefined {
  return injectedTestContext as T | undefined;
}

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
// Input Conversion
// ============================================================================

/**
 * Convert an input object to CLI arguments.
 *
 * @param input - Key-value pairs to convert to CLI flags
 * @returns Array of CLI argument strings
 */
function inputToArgs(input: Readonly<Record<string, unknown>>): string[] {
  const args: string[] = [];

  for (const [key, value] of Object.entries(input)) {
    const flag = `--${key.replace(/([A-Z])/g, "-$1").toLowerCase()}`;

    if (typeof value === "boolean") {
      if (value) {
        args.push(flag);
      }
      // false booleans are omitted (Commander treats absent flags as false)
    } else if (Array.isArray(value)) {
      for (const item of value) {
        args.push(flag, String(item));
      }
    } else if (value !== undefined && value !== null) {
      args.push(flag, String(value));
    }
  }

  return args;
}

// ============================================================================
// Envelope Parsing
// ============================================================================

/**
 * Attempt to parse a JSON envelope from stdout or stderr output.
 *
 * Tries stdout first (success envelopes), then stderr (error envelopes).
 * Returns undefined if no valid envelope JSON is found.
 */
function parseEnvelope(
  stdout: string,
  stderr: string
): CommandEnvelope | undefined {
  // Try stdout first (success path)
  const stdoutEnvelope = tryParseEnvelope(stdout);
  if (stdoutEnvelope) return stdoutEnvelope;

  // Try stderr (error path — runHandler writes error envelopes to stderr)
  const stderrEnvelope = tryParseEnvelope(stderr);
  if (stderrEnvelope) return stderrEnvelope;

  return undefined;
}

/**
 * Try to parse a single string as a JSON envelope.
 */
function tryParseEnvelope(text: string): CommandEnvelope | undefined {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{")) return undefined;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;

    // Validate it looks like a CommandEnvelope (has `ok` and `command` fields)
    if (
      typeof parsed["ok"] === "boolean" &&
      typeof parsed["command"] === "string"
    ) {
      return parsed as unknown as CommandEnvelope;
    }
  } catch {
    // Not valid JSON — ignore
  }

  return undefined;
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
 * ### v0.5 Enhancements
 *
 * - **`input`**: Pre-parsed input object auto-converted to CLI args.
 *   Keys become `--key value` flags, booleans become presence/absence flags.
 * - **`context`**: Mock context object injectable via `getTestContext()`.
 *   Context factories can use this to skip real resource construction in tests.
 * - **`json`**: Forces JSON output mode (OUTFITTER_JSON=1) so the result
 *   includes a parsed `envelope` field.
 * - **`envelope`**: Parsed `CommandEnvelope` from JSON output, available on
 *   the result for structured assertion.
 *
 * @param cli - A CLI instance created by `createCLI()`
 * @param args - Command-line arguments (without the program name prefix)
 * @param options - Optional configuration for the test execution
 * @returns Captured stdout, stderr, exitCode, and optional envelope
 *
 * @example
 * ```typescript
 * // Basic usage (backward compatible)
 * const result = await testCommand(cli, ["hello"]);
 * expect(result.stdout).toContain("Hello!");
 *
 * // With pre-parsed input
 * const result = await testCommand(cli, ["greet"], {
 *   input: { name: "World" },
 * });
 *
 * // With JSON envelope
 * const result = await testCommand(cli, ["info"], { json: true });
 * expect(result.envelope?.ok).toBe(true);
 * ```
 */
export async function testCommand(
  cli: CLI,
  args: string[],
  options?: TestCommandOptions
): Promise<TestCommandResult> {
  return withProcessLock(async () => {
    // Snapshot the full env so command-side mutations do not leak across tests.
    const originalEnv = { ...process.env };

    // Now apply environment modifications
    if (options?.env) {
      for (const [key, value] of Object.entries(options.env)) {
        process.env[key] = value;
      }
    }

    // Force JSON output if requested (applied after env overrides so json: true wins)
    if (options?.json) {
      process.env["OUTFITTER_JSON"] = "1";
    }

    // Inject test context if provided
    if (options?.context) {
      injectedTestContext = { ...options.context };
    }

    // Convert input object to CLI args and append to explicit args
    const inputArgs = options?.input ? inputToArgs(options.input) : [];
    const fullArgs = [...args, ...inputArgs];

    // Save process.argv so code that reads it (e.g., hasExplicitOutputFlag)
    // sees the test invocation args instead of the test runner's args.
    const savedArgv = process.argv;
    const testArgv = ["node", "test", ...fullArgs];
    process.argv = testArgv;

    try {
      // Commander expects argv in the format: ['node', 'program-name', ...args]
      // Use captureCLI which intercepts process.stdout.write, process.stderr.write,
      // process.exit, console.log, and console.error — then restores them all.
      const cliResult = await captureCLI(async () => {
        await cli.parse(testArgv);
      });

      // Try to parse envelope from JSON output
      const envelope = parseEnvelope(cliResult.stdout, cliResult.stderr);

      return {
        ...cliResult,
        envelope,
      };
    } finally {
      // Restore process.argv
      process.argv = savedArgv;

      // Remove keys created during execution
      for (const key of Object.keys(process.env)) {
        if (!(key in originalEnv)) {
          delete process.env[key];
        }
      }
      // Restore original env values
      for (const [key, value] of Object.entries(originalEnv)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }

      // Clear test context
      injectedTestContext = undefined;
    }
  });
}
