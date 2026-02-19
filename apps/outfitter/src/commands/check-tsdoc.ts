/**
 * `outfitter check tsdoc` - Check TSDoc coverage on exported declarations.
 *
 * Delegates to the pure analysis function in `@outfitter/tooling` and
 * handles output formatting.
 *
 * @packageDocumentation
 */

import { Result } from "@outfitter/contracts";
import {
  analyzeCheckTsdoc,
  printCheckTsdocHuman,
  type TsDocCheckResult,
} from "@outfitter/tooling";
import type { CliOutputMode } from "../output-mode.js";

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

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Run TSDoc coverage analysis and format output.
 *
 * @param input - Validated action input
 * @returns Result containing the coverage analysis
 */
export function runCheckTsdoc(
  input: CheckTsDocInput
): Result<TsDocCheckResult, Error> {
  const result = analyzeCheckTsdoc({
    strict: input.strict,
    minCoverage: input.minCoverage,
  });

  if (!result) {
    return Result.err(
      new Error("No packages found with src/index.ts entry points.")
    );
  }

  if (input.outputMode === "json" || input.outputMode === "jsonl") {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    printCheckTsdocHuman(result, {
      strict: input.strict,
      minCoverage: input.minCoverage,
    });
  }

  return Result.ok(result);
}
