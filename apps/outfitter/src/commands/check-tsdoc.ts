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
import { dirname, join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { Result, ValidationError } from "@outfitter/contracts";
import type {
  CoverageLevel,
  DeclarationCoverage,
  PackageCoverage,
  TsDocCheckResult,
} from "@outfitter/tooling";
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
  readonly summary: boolean;
  readonly level: CoverageLevel | undefined;
  readonly packages: readonly string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Calculate coverage statistics from declaration results.
 *
 * Matches `@outfitter/tooling` semantics where `partial` counts as half credit.
 */
function calculateCoverage(declarations: readonly DeclarationCoverage[]): {
  documented: number;
  partial: number;
  undocumented: number;
  total: number;
  percentage: number;
} {
  const total = declarations.length;
  if (total === 0) {
    return {
      documented: 0,
      partial: 0,
      undocumented: 0,
      total: 0,
      percentage: 100,
    };
  }

  const documented = declarations.filter(
    (d) => d.level === "documented"
  ).length;
  const partial = declarations.filter((d) => d.level === "partial").length;
  const undocumented = declarations.filter(
    (d) => d.level === "undocumented"
  ).length;

  const score = documented + partial * 0.5;
  const percentage = Math.round((score / total) * 100);

  return { documented, partial, undocumented, total, percentage };
}

/** Recalculate count fields from a declarations array. */
function recalculateCounts(
  pkg: PackageCoverage,
  declarations: readonly DeclarationCoverage[]
): PackageCoverage {
  const coverage = calculateCoverage(declarations);
  return {
    ...pkg,
    declarations,
    ...coverage,
  };
}

/**
 * Apply `--level` and `--package` filters and recompute aggregate fields.
 *
 * `ok` is recomputed from the filtered summary when strict mode is enabled.
 */
function filterResult(
  result: TsDocCheckResult,
  options: {
    level: CoverageLevel | undefined;
    packageNames: readonly string[];
    strict: boolean;
    minCoverage: number;
  }
): TsDocCheckResult {
  let packages = [...result.packages];

  if (options.packageNames.length > 0) {
    const names = new Set(options.packageNames);
    packages = packages.filter((pkg) => names.has(pkg.name));
  }

  if (options.level) {
    packages = packages.map((pkg) => {
      const declarations = pkg.declarations.filter(
        (d) => d.level === options.level
      );
      return recalculateCounts(pkg, declarations);
    });
  }

  const summary = calculateCoverage(
    packages.flatMap((pkg) => pkg.declarations)
  );
  const ok = options.strict ? summary.percentage >= options.minCoverage : true;

  return {
    ok,
    packages,
    summary,
  };
}

/**
 * Strip declaration detail for compact output while preserving schema shape.
 *
 * This keeps `check.tsdoc` output contract-compatible in JSON/JQ modes.
 */
function summarizeResult(result: TsDocCheckResult): TsDocCheckResult {
  return {
    ok: result.ok,
    packages: result.packages.map((pkg) => ({
      ...pkg,
      declarations: [],
    })),
    summary: result.summary,
  };
}

/**
 * Emit type-discriminated JSONL lines for progressive consumption.
 *
 * Line order: meta -> summary -> package (per pkg) -> declaration (per decl).
 * When `summary` is true, declaration lines are suppressed.
 */
function emitJsonlLines(result: TsDocCheckResult, summary: boolean): unknown[] {
  const lines: unknown[] = [];

  lines.push({ type: "meta", version: "1.0.0", ok: result.ok });
  lines.push({ type: "summary", ...result.summary });

  const sortedPackages = [...result.packages].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const pkg of sortedPackages) {
    lines.push({
      type: "package",
      name: pkg.name,
      percentage: pkg.percentage,
      documented: pkg.documented,
      partial: pkg.partial,
      undocumented: pkg.undocumented,
      total: pkg.total,
    });
  }

  if (!summary) {
    for (const pkg of sortedPackages) {
      for (const decl of pkg.declarations) {
        lines.push({
          type: "declaration",
          package: pkg.name,
          name: decl.name,
          kind: decl.kind,
          level: decl.level,
          file: relative(pkg.path, decl.file),
          line: decl.line,
        });
      }
    }
  }

  return lines;
}

/** Ensure each emitted JSONL record is a single compact line of valid JSON. */
function normalizeJsonlRecord(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return JSON.stringify(text);
  }
}

/**
 * Apply a jq expression to JSON data using the system `jq` binary.
 *
 * @param data - Data to filter
 * @param expr - jq expression
 * @param options - jq output controls
 * @returns Filtered output string, or the original JSON if jq fails
 */
async function applyJq(
  data: unknown,
  expr: string,
  options?: { compact?: boolean }
): Promise<string> {
  try {
    const json = JSON.stringify(data);
    const args = ["jq", ...(options?.compact ? ["-c"] : []), expr];
    const proc = Bun.spawn(args, {
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
      return options?.compact
        ? `${JSON.stringify(data)}\n`
        : `${JSON.stringify(data, null, 2)}\n`;
    }

    return stdout;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown jq execution error";
    const missingBinary = /enoent|not found/i.test(message);
    if (missingBinary) {
      process.stderr.write(
        "jq is not installed. Install jq or omit --jq to continue.\n"
      );
    } else {
      process.stderr.write(`jq execution error: ${message}\n`);
    }
    return options?.compact
      ? `${JSON.stringify(data)}\n`
      : `${JSON.stringify(data, null, 2)}\n`;
  }
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
    const rawResult = tooling.analyzeCheckTsdoc({
      strict: input.strict,
      minCoverage: input.minCoverage,
      cwd: input.cwd,
    });

    if (!rawResult) {
      return Result.err(
        ValidationError.fromMessage(
          "No packages found with src/index.ts entry points.",
          { cwd: input.cwd }
        )
      );
    }

    const hasFilters = input.level !== undefined || input.packages.length > 0;
    const filteredResult = hasFilters
      ? filterResult(rawResult, {
          level: input.level,
          packageNames: input.packages,
          strict: input.strict,
          minCoverage: input.minCoverage,
        })
      : rawResult;

    const outputData = input.summary
      ? summarizeResult(filteredResult)
      : filteredResult;

    if (input.outputMode === "jsonl") {
      const lines = emitJsonlLines(filteredResult, input.summary);

      if (input.jq) {
        for (const line of lines) {
          const filtered = await applyJq(line, input.jq, { compact: true });
          for (const rawLine of filtered.split(/\r?\n/)) {
            const trimmed = rawLine.trim();
            if (!trimmed) {
              continue;
            }
            process.stdout.write(`${normalizeJsonlRecord(trimmed)}\n`);
          }
        }
      } else {
        for (const line of lines) {
          process.stdout.write(`${JSON.stringify(line)}\n`);
        }
      }
    } else if (input.jq) {
      const filtered = await applyJq(outputData, input.jq);
      process.stdout.write(filtered);
    } else if (input.outputMode === "json") {
      process.stdout.write(`${JSON.stringify(outputData, null, 2)}\n`);
    } else {
      tooling.printCheckTsdocHuman(outputData, {
        strict: input.strict,
        minCoverage: input.minCoverage,
      });
    }

    return Result.ok(outputData);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to run check-tsdoc";
    return Result.err(new Error(message));
  }
}
