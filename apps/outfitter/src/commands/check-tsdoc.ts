/**
 * `outfitter check tsdoc` - Check TSDoc coverage on exported declarations.
 *
 * Thin wrapper that delegates to the `check-tsdoc` command in
 * `@outfitter/tooling`. Spawns the tooling CLI as a subprocess to
 * avoid `process.exit()` side effects in the action handler.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Result } from "@outfitter/contracts";
import type { CliOutputMode } from "../output-mode.js";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the check-tsdoc action handler. */
export interface CheckTsDocInput {
  readonly strict: boolean;
  readonly minCoverage: number;
  readonly cwd: string;
  readonly outputMode: CliOutputMode;
}

/** Result of running check-tsdoc. */
export interface CheckTsDocRunResult {
  readonly exitCode: number;
}

// ---------------------------------------------------------------------------
// Args builder (pure, testable)
// ---------------------------------------------------------------------------

/**
 * Build the CLI argument array for the tooling `check-tsdoc` command.
 *
 * @param input - Validated action input
 * @returns Argument array starting with the command name
 */
export function buildCheckTsdocArgs(input: CheckTsDocInput): string[] {
  const args: string[] = ["check-tsdoc"];

  if (input.strict) {
    args.push("--strict");
  }

  if (input.minCoverage > 0) {
    args.push("--min-coverage", String(input.minCoverage));
  }

  if (input.outputMode === "json" || input.outputMode === "jsonl") {
    args.push("--json");
  }

  return args;
}

// ---------------------------------------------------------------------------
// Tooling entrypoint resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the `@outfitter/tooling` CLI entrypoint path.
 *
 * Prefers the source entrypoint in monorepo dev so new commands are
 * immediately available without a build step.
 */
function resolveToolingEntrypoint(): string {
  const packageJsonPath = require.resolve("@outfitter/tooling/package.json");
  const packageRoot = dirname(packageJsonPath);

  const srcEntrypoint = join(packageRoot, "src", "cli", "index.ts");
  if (existsSync(srcEntrypoint)) {
    return srcEntrypoint;
  }

  const distEntrypoint = join(packageRoot, "dist", "cli", "index.js");
  if (existsSync(distEntrypoint)) {
    return distEntrypoint;
  }

  throw new Error(
    "Unable to resolve @outfitter/tooling CLI entrypoint (expected dist/cli/index.js or src/cli/index.ts)."
  );
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run the `check-tsdoc` command via the tooling CLI subprocess.
 *
 * @param input - Validated action input
 * @returns Result containing the subprocess exit code
 */
export async function runCheckTsdoc(
  input: CheckTsDocInput
): Promise<Result<CheckTsDocRunResult, Error>> {
  try {
    const entrypoint = resolveToolingEntrypoint();
    const args = buildCheckTsdocArgs(input);

    const child = Bun.spawn([process.execPath, entrypoint, ...args], {
      cwd: input.cwd,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });

    const exitCode = await child.exited;
    return Result.ok({ exitCode });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run check-tsdoc";
    return Result.err(new Error(message));
  }
}
