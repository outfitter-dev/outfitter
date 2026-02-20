/**
 * `outfitter check tsdoc` - Check TSDoc coverage on exported declarations.
 *
 * Delegates to the pure analysis function in `@outfitter/tooling`.
 * Resolves source entrypoints in monorepo dev to avoid requiring a build step.
 *
 * @packageDocumentation
 */

import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { Result, ValidationError } from "@outfitter/contracts";
import type { TsDocCheckResult } from "@outfitter/tooling";
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
  readonly jq: string | undefined;
}

// ---------------------------------------------------------------------------
// Jq helper
// ---------------------------------------------------------------------------

/**
 * Apply a jq expression to JSON data using the system `jq` binary.
 *
 * @param data - Data to filter
 * @param expr - jq expression
 * @returns Filtered output string, or the original JSON if jq fails
 */
async function applyJq(data: unknown, expr: string): Promise<string> {
  const json = JSON.stringify(data);
  const proc = Bun.spawn(["jq", expr], {
    stdin: new Response(json),
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    process.stderr.write(`jq error: ${stderr.trim()}\n`);
    return `${JSON.stringify(data, null, 2)}\n`;
  }

  return stdout;
}

type ToolingCheckTsdocModule = Pick<
  typeof import("@outfitter/tooling"),
  "analyzeCheckTsdoc" | "printCheckTsdocHuman"
>;

let toolingCheckTsdocModule: Promise<ToolingCheckTsdocModule> | undefined;

/**
 * Resolve the `@outfitter/tooling` entrypoint.
 *
 * Prefers source in monorepo development to avoid requiring dist builds.
 */
function resolveToolingEntrypoint(): string {
  const packageJsonPath = require.resolve("@outfitter/tooling/package.json");
  const packageRoot = dirname(packageJsonPath);

  const srcEntrypoint = join(packageRoot, "src", "index.ts");
  if (existsSync(srcEntrypoint)) {
    return srcEntrypoint;
  }

  const distEntrypoint = join(packageRoot, "dist", "index.js");
  if (existsSync(distEntrypoint)) {
    return distEntrypoint;
  }

  throw new Error(
    "Unable to resolve @outfitter/tooling entrypoint (expected src/index.ts or dist/index.js)."
  );
}

function loadToolingCheckTsdocModule(): Promise<ToolingCheckTsdocModule> {
  if (!toolingCheckTsdocModule) {
    toolingCheckTsdocModule = import(
      pathToFileURL(resolveToolingEntrypoint()).href
    ) as Promise<ToolingCheckTsdocModule>;
  }

  return toolingCheckTsdocModule;
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
export async function runCheckTsdoc(
  input: CheckTsDocInput
): Promise<Result<TsDocCheckResult, Error>> {
  try {
    const tooling = await loadToolingCheckTsdocModule();
    const result = tooling.analyzeCheckTsdoc({
      strict: input.strict,
      minCoverage: input.minCoverage,
      cwd: input.cwd,
    });

    if (!result) {
      return Result.err(
        ValidationError.fromMessage(
          "No packages found with src/index.ts entry points.",
          { cwd: input.cwd }
        )
      );
    }

    if (input.jq) {
      const filtered = await applyJq(result, input.jq);
      process.stdout.write(filtered);
    } else if (input.outputMode === "json" || input.outputMode === "jsonl") {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    } else {
      tooling.printCheckTsdocHuman(result, {
        strict: input.strict,
        minCoverage: input.minCoverage,
      });
    }

    return Result.ok(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run check-tsdoc";
    return Result.err(new Error(message));
  }
}
