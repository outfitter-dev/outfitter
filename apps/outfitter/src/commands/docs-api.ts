/**
 * `outfitter docs api` - Extract API reference from TSDoc coverage data.
 *
 * Thin wrapper around `runCheckTsdoc` that presents TSDoc coverage
 * as API documentation rather than a quality check. Reuses the same
 * analysis infrastructure with a docs-oriented output format.
 *
 * @packageDocumentation
 */

import { relative } from "node:path";

import { output } from "@outfitter/cli";
import { InternalError, Result, ValidationError } from "@outfitter/contracts";
import type { TsDocCheckResult } from "@outfitter/tooling";
import { createTheme } from "@outfitter/tui/render";

import type { CliOutputMode } from "../output-mode.js";
import { resolveStructuredOutputMode } from "../output-mode.js";
import { runCheckTsdoc } from "./check-tsdoc.js";
import { applyJq } from "./jq-utils.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Validated input for the docs.api action handler. */
export interface DocsApiInput {
  readonly cwd: string;
  readonly jq: string | undefined;
  readonly level: "documented" | "partial" | "undocumented" | undefined;
  readonly outputMode: CliOutputMode;
  readonly packages: readonly string[];
}

interface DocsApiDependencies {
  readonly runCheckTsdoc?: typeof runCheckTsdoc;
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

/**
 * Extract API reference from TSDoc coverage data.
 *
 * Delegates to `runCheckTsdoc` with sensible defaults for documentation
 * output (non-strict, full declaration detail, no minimum coverage).
 *
 * @param input - Validated action input
 * @returns Result containing the TSDoc check result shaped as API reference
 */
export async function runDocsApi(
  input: DocsApiInput,
  dependencies?: DocsApiDependencies
): Promise<Result<TsDocCheckResult, ValidationError | InternalError>> {
  const runCheck = dependencies?.runCheckTsdoc ?? runCheckTsdoc;
  const result = await runCheck({
    cwd: input.cwd,
    emitOutput: false,
    jq: input.jq,
    level: input.level,
    minCoverage: 0,
    outputMode: input.outputMode,
    packages: input.packages,
    strict: false,
    summary: false,
  });

  if (result.isErr()) {
    if (result.error instanceof ValidationError) {
      return Result.err(result.error);
    }
    if (result.error instanceof InternalError) {
      return Result.err(result.error);
    }

    return Result.err(
      new InternalError({
        message: result.error.message,
        context: { action: "docs.api" },
      })
    );
  }

  return Result.ok(result.value);
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Print API reference results in the appropriate output format.
 *
 * For structured modes (JSON/JSONL), delegates to the standard output
 * helper. For human mode, formats as an API reference listing grouped
 * by package.
 *
 * @param result - The TSDoc check result
 * @param options - Output formatting options
 */
export async function printDocsApiResults(
  result: TsDocCheckResult,
  options?: { mode?: CliOutputMode; jq?: string | undefined }
): Promise<void> {
  const structuredMode = resolveStructuredOutputMode(options?.mode);

  if (structuredMode) {
    if (options?.jq) {
      const filtered = await applyJq(result, options.jq, {
        compact: structuredMode === "jsonl",
      });
      process.stdout.write(filtered);
    } else {
      await output(result, { mode: structuredMode });
    }
    return;
  }

  const theme = createTheme();
  const lines: string[] = [];
  const totalDeclarations = result.summary.total;

  if (totalDeclarations === 0) {
    lines.push(theme.muted("No API declarations found."));
    await output(lines, { mode: "human" });
    return;
  }

  lines.push("");
  lines.push(`API Reference (${totalDeclarations} declarations)`);
  lines.push("=".repeat(60));

  const sortedPackages = [...result.packages].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  for (const pkg of sortedPackages) {
    if (pkg.declarations.length === 0) {
      continue;
    }

    lines.push("");
    lines.push(`${pkg.name} ${theme.muted(`(${pkg.percentage}% documented)`)}`);
    lines.push("-".repeat(40));

    for (const decl of pkg.declarations) {
      let levelTag: string;
      if (decl.level === "documented") {
        levelTag = theme.success("[doc]");
      } else if (decl.level === "partial") {
        levelTag = theme.warning("[partial]");
      } else {
        levelTag = theme.error("[none]");
      }
      const location = theme.muted(
        `${relative(pkg.path, decl.file)}:${decl.line}`
      );
      lines.push(`  ${levelTag} ${decl.kind} ${decl.name}  ${location}`);
    }
  }

  lines.push("");

  await output(lines, { mode: "human" });
}
